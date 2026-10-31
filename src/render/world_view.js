import { createRealmTerrain, overviewLevel } from "render/realm_terrain";
import { createRealmOverlay } from "render/realm_overlay";
import { inspectRealm } from "game/realm_map";
import { villageArea } from "game/settlement_details";
import { label } from "render/labels";
import { commonBoundary } from "render/customs_bounds";
import { resourcePermission } from "game/village_customs";
import { occupiedHomes } from "game/home";
import { displayName } from "game/knowledge";
import { fenceFootprints, fenceRevision } from "game/fences";
import * as THREE from "three";

import { Hex, HEX_SIZE } from "game/map";
import { entityExists, fullEntity } from "game/entities";
import { topController } from "game/playable";
import { localWeather, coldEnough } from "game/weather";
import { homeOf } from "game/overworld";
import { groundForState } from "game/geography";

import * as models from "render/models";
import { realmColour } from "render/colours";
import { lookOf } from "render/biomes";
import { createTerrain } from "render/terrain";
import { createInstances } from "render/instances";
import { villageModel, fenceModel, animateWorkplace } from "render/villages";
import { createForest } from "render/forest";
import { introActive, arrivalTiles } from "game/intro";
import { createCameraRig, arrivalShot } from "render/camera";
import { createWeatherView } from "render/weather";
import { weatherLight, skyAt, SUNSET_TINT, NIGHT_TINT } from "render/sky";

const hexKey = point => Hex().fromPoint(point).toString();

// A name belongs to a visible person, not to a body behind an opaque roof.
export function personLabelVisible(camera, position, height, roofs, ray = new THREE.Raycaster()) {
  return [.9,.5].some(fraction => {
    const target = position.clone().add(new THREE.Vector3(0,height*fraction,0));
    const distance = target.distanceTo(camera.position);
    ray.set(camera.position,target.sub(camera.position).normalize());
    ray.far = Math.max(0,distance-.1);
    return !ray.intersectObjects(roofs,false).length;
  });
}

const SUN = 3.4;
const SKY = 1.0;
const WHITE = new THREE.Color(0xFFFFFF);
const SUNSET = new THREE.Color(SUNSET_TINT);
const NIGHT = new THREE.Color(NIGHT_TINT);

// NOTE: Draws the game in 3D. It owns nothing in the simulation: each frame
// it reads ecs.spatial for moving things and rebuilds whatever the game has
// listed in state.redraws.
export function createWorldView(renderer, state, { t, onSelect }) {
  const canvas = renderer.domElement;

  const ground = groundForState(state);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / Math.max(1, canvas.clientHeight), 5, 12000);

  const hemisphere = new THREE.HemisphereLight(0xDDE8FF, 0x4A4030, SKY);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xFFFFFF, SUN);
  sun.position.set(-0.7, 0.8, 0.45);
  scene.add(sun);

  let terrain = createTerrain(state, ground);
  let geography = state.map.geography;
  scene.add(terrain.mesh);
  const realm = state.travel && state.world.landSeed ? createRealmTerrain(state, ground) : null;
  const realmOverlay = realm && createRealmOverlay(state, realm);
  let sea = null;
  if (realm) {
    scene.background.setHex(0x263D59);
    scene.add(realm.mesh, realmOverlay.mesh);
    terrain.mesh.children.forEach(child => { child.visible = false; });
    sea = new THREE.Mesh(new THREE.PlaneGeometry(realm.layout.radius * 8, realm.layout.radius * 8), new THREE.MeshLambertMaterial({ color: 0x2F4999 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(realm.layout.centre.x, -3, realm.layout.centre.y); scene.add(sea);
    camera.far = realm.layout.radius * 16 / Math.min(1, camera.aspect); camera.updateProjectionMatrix();
  }
  const forest = createForest();
  scene.add(forest.mesh);
  const weatherView = createWeatherView(ground);
  scene.add(weatherView.mesh);

  const instances = createInstances();
  scene.add(instances.mesh);
  const settlementOverlay=new THREE.Group();
  scene.add(settlementOverlay);
  const villageLabels=new Map();
  let areaOutline=null, areaKey=null;
  const updateSettlements = () => {
    for(const village of Object.values(state.villages || {})) {
      const centre=village.sharedPlaces?.find(id=>state.ecs.meetingPlace?.[id]?.kind=="green");
      if(!centre)continue;
      let name=villageLabels.get(village.id);
      if(!name) {
        name=label(village.name,{height:32,colour:"#f7e8be",background:"rgba(37,47,39,0.85)"});
        name.name="village-name";name.userData.entityId=centre;
        villageLabels.set(village.id,name);settlementOverlay.add(name);
      }
      const p=state.ecs.spatial[centre];
      name.position.set(p.x,ground.heightAt(p.x,p.y)+90,p.y);
      name.visible=isKnown(p) && !introActive(state) && (!realm || rig.distance < 2200);
    }
    const villageId=state.ecs.village?.[state.ui.selected]?.villageId;
    const key=[villageId,state.landUseRevision,state.ui.playerId,knownCount,revealAll,[...arrivalKnown].join("|")].join(":");
    if(key!=areaKey) {
      if(areaOutline) {settlementOverlay.remove(areaOutline);models.disposeObject(areaOutline);}
      areaOutline=null;areaKey=key;
      if(villageId && state.villages?.[villageId]?.origin) {
        areaOutline=new THREE.Group();areaOutline.name="village-area";
        for(const hex of villageArea(state,villageId)) {
          const h=Hex(...hex.split(",").map(Number)), p=h.toPoint();
          if(isKnown(p))areaOutline.add(models.hexOutline(ground,p,0xDFCA83));
        }
        settlementOverlay.add(areaOutline);
      }
    }
  };
  const objects = {};
  const labelRay = new THREE.Raycaster();
  const people = new Set();
  let known = new Set();
  let knownCount = -1;
  let revealAll = false;
  let selected = [];
  let commonsOutline = null;
  let commonsRevision = null;
  let arrivalKnown = new Set();
  let lastIntro = null;
  let wasArriving = false;
  let shot = null;
  let campSetup = null;
  let controlledId = state.ui.playerId;
  let fencesVersion = "";
  let fenceIds = [];

  const isKnown = point => revealAll || known.has(hexKey(point)) || arrivalKnown.has(hexKey(point));

  // NOTE: the biome and morality of the tile under a point
  const lookAt = point => lookOf(state, (state.space[hexKey(point)] || []).find(e => state.ecs.mappable[e]));

  const refreshKnown = () => {
    const list = state.ecs.playable[state.ui.playerId].known;
    if (list.length == knownCount) {
      return false;
    }
    known = new Set(list.map(k => k.x + "," + k.y));
    knownCount = list.length;
    return true;
  };

  const showKnown = () => {
    for (const id in state.ecs.mappable) {
      terrain.show(id, isKnown(state.ecs.spatial[id]));
    }
    for (const id in objects) {
      if (objects[id].userData.hexKey) {
        objects[id].visible = revealAll || known.has(objects[id].userData.hexKey) || arrivalKnown.has(objects[id].userData.hexKey);
      }
    }
    forest.invalidate();
    instances.invalidate();
  };

  const currentSelection = () => [state.ui.selected, state.ui.show && state.ui.show.selected_person]
    .filter(id => id);

  const remove = id => {
    forest.remove(id);
    instances.remove(id);
    if (objects[id]) {
      scene.remove(objects[id]);
      models.disposeObject(objects[id]);
      delete objects[id];
    }
    people.delete(id);
  };

  // NOTE: The same choices, in the same order, as the 2D renderer made.
  const build = id => {
    const ecs = state.ecs;
    const isSelected = selected.includes(id);
    if (!ecs.spatial[id] || ecs.personable?.[id]?.historical || ecs.possession?.[id]?.carried) return null;
    if (ecs.interior[id]) {
      return null;
    }
    if (ecs.mappable[id]) {
      terrain.show(id, isKnown(ecs.spatial[id]));
      return models.tileOverlay(ground, ecs, id, { selected: isSelected });
    }
    if (ecs.haulable && ecs.haulable[id]) {
      return ecs.haulable[id].heldBy ? null : models.groundItem(ground, ecs, id);
    }
    // NOTE: Must come _after_ haulable as otherwise logs would be rendered as trees!
    if (ecs.good[id] && ecs.good[id].type == "wood") {
      return models.tree(ground, ecs, id, lookAt(ecs.spatial[id]));
    }
    if (ecs.forageable && ecs.forageable[id]) {
      return models.foragePlant(ground, state, id);
    }
    if (ecs.fence?.[id] && !ecs.farmable?.[id] || ecs.backyard?.[id] || ecs.workplace?.[id] || ecs.meetingPlace?.[id] || ecs.pasture?.[id] || ecs.animal?.[id]) return villageModel(ground, state, id);
    if (ecs.camp?.[id]) return models.camp(ground, state, id);
    if (ecs.shelter?.[id]) return models.shelter(ground, state, id);
    if (ecs.building[id]) {
      return models.building(ground, state, id, {
        playerOwned: topController(ecs, id) == state.ui.playerId,
        selected: isSelected
      });
    }
    if (ecs.personable[id]) {
      people.add(id);
      return models.person(state, fullEntity(ecs, id), t, {
        realm: realmColour(topController(ecs, id), state.ui.playerId),
        selected: isSelected
      });
    }
    if (ecs.farmable && ecs.farmable[id]) {
      const field = models.field(ground, state, id, { selected: isSelected });
      const enclosure = fenceModel(ground,state,id);
      if (enclosure) field.add(enclosure);
      return field;
    }
    if (ecs.stockpile && ecs.stockpile[id]) {
      return models.stockpile(ground, state, id, { selected: isSelected });
    }
    const e = fullEntity(ecs, id);
    throw "Cannot render entity " + id + ":" + JSON.stringify(e);
  };

  const rebuild = id => {
    remove(id);
    if (!entityExists(state.ecs, id)) {
      return;
    }
    const object = build(id);
    if (!object) {
      return;
    }
    object.userData.entityId = id;
    if (state.ecs.personable[id]) object.userData.knownName = displayName(state,id);
    if (!state.ecs.personable[id]) {
      object.userData.hexKey = hexKey(state.ecs.spatial[id]);
      object.visible = isKnown(state.ecs.spatial[id]);
    }
    objects[id] = object;
    if ((state.ecs.good[id] && state.ecs.good[id].type == "wood" && !(state.ecs.haulable && state.ecs.haulable[id])) || state.ecs.forageable && state.ecs.forageable[id]) {
      forest.add(id, object);
    } else if (state.ecs.farmable?.[id] && !selected.includes(id) || state.ecs.backyard?.[id] || state.ecs.workplace?.[id] || state.ecs.meetingPlace?.[id] || state.ecs.pasture?.[id] || state.ecs.animal?.[id]) {
      instances.add(id, object);
    } else {
      scene.add(object);
    }
  };

  const followPerson = id => {
    const name = displayName(state, id);
    if (objects[id] && objects[id].userData.knownName != name) rebuild(id);
    const object = objects[id];
    const s = state.ecs.spatial[id];
    if (!object || !s) {
      return;
    }
    object.position.set(s.x, ground.heightAt(s.x, s.y), s.y);
    object.visible = !state.ecs.interior[id] && (isKnown(s) || (id == state.ui.playerId && introActive(state)));

    const ring = object.getObjectByName("ring");
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), models.surfaceNormal(ground, s.x, s.y));
    const controlled = object.getObjectByName("controlled-ring");
    if (controlled) controlled.quaternion.copy(ring.quaternion);

    const figure = object.getObjectByName("figure");
    if (state.ecs.planner[id]?.task?.[0] == "trade_work") figure.rotation.z = Math.sin(performance.now() / 180) * 0.07;
    else if (state.ecs.profession?.[id]) figure.rotation.z = 0;

    const last = object.userData.last;
    if (last) {
      const dx = s.x - last.x;
      const dz = s.y - last.y;
      if (dx * dx + dz * dz > 0.0001) {
        object.getObjectByName("figure").rotation.y = Math.atan2(dx, dz);
      }
    }
    object.userData.last = { x: s.x, y: s.y };
    if (id == state.ui.playerId && state.intro && !state.ecs.personable[id].dead) {
      models.poseArrivalPerson(object, state.intro, state.ecs.personable[id].size, {
        ground, camp: state.intro.campPoint
      });
    }
  };

  // Keep ordinary activity where it fits; the player and selected encounter
  // retain their full wording. Recompute after movement and camera changes.
  const showActivities = () => {
    const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const activities = [];
    // Sprites face the camera: stack them along screen-up, not world-up.
    // World-up foreshortens at local camera angles and makes a bubble collide
    // with its own name, especially when the name has a minimum pixel size.
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const pixelSize = object => {
      const at = object.position.clone().add(new THREE.Vector3(0, object.userData.anchorHeight + 14, 0));
      const depth = -at.applyMatrix4(camera.matrixWorldInverse).z;
      return depth * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.clientHeight);
    };
    const roofs = Object.entries(objects).filter(([id,object]) => object.visible &&
      (state.ecs.building[id] || state.ecs.shelter?.[id]?.stage == "house" || ["alehouse","chapel"].includes(state.ecs.meetingPlace?.[id]?.kind)))
      .map(([,object]) => { object.updateMatrixWorld(true); const part=object.children[0]; return part?.isMesh ? part : part?.children[0]; }).filter(mesh=>mesh?.isMesh);
    for (const id of people) {
      const object=objects[id];
      object.userData.labelVisible=object.visible && personLabelVisible(camera,object.position,object.userData.anchorHeight,roofs,labelRay);
      const activity = object.getObjectByName("activity");
      if (activity) {
        const aspect = activity.scale.x / activity.scale.y;
        const height = rig.distance <= 2400 ? Math.max(15, pixelSize(object) * 20) : 15;
        activity.scale.set(height * aspect, height, 1);
        activity.position.set(0, object.userData.anchorHeight + 14, 0);
      }
      for (const key of ["person-name","activity"]) {
        const text=object.getObjectByName(key);if(text)text.visible=object.userData.labelVisible;
      }
    }
    // Names have their own lane and are never culled to make room for activity.
    const nameBounds = [];
    for (const id of [...people].sort()) {
      const object = objects[id], text = object.getObjectByName("person-name");
      if (!text || !object.userData.labelVisible) continue;
      text.position.set(0, object.userData.anchorHeight + 14, 0);
      object.updateMatrixWorld(true);
      const depth = -text.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse).z;
      const pixelHeight = depth * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.clientHeight);
      const height = rig.distance <= 2400 ? Math.max(18, pixelHeight * 20) : 18;
      text.scale.set(height * text.userData.nameAspect, height, 1);
      let bounds;
      for (let lane = 0; lane <= nameBounds.length; lane++) {
        object.updateMatrixWorld(true);
        const point = text.getWorldPosition(new THREE.Vector3()), depth = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
        const centre = point.project(camera);
        const w = text.scale.x * camera.projectionMatrix.elements[0] / depth / 2, h = text.scale.y * camera.projectionMatrix.elements[5] / depth / 2;
        bounds = [centre.x-w,centre.y-h,centre.x+w,centre.y+h];
        if (!nameBounds.some(other=>overlaps(bounds,other))) break;
        text.position.addScaledVector(up, height + pixelHeight * 3);
      }
      nameBounds.push(bounds);
      const activity = object.getObjectByName("activity");
      if (activity) activity.position.copy(text.position).addScaledVector(up, height / 2 + activity.scale.y / 2 + pixelHeight * 3);
    }
    for (const id of people) {
      const object = objects[id], text = object.getObjectByName("activity");
      if (!object.userData.labelVisible || !text) continue;
      const at = text.getWorldPosition(new THREE.Vector3());
      const depth = -at.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const centre = at.project(camera);
      const halfWidth = text.scale.x * camera.projectionMatrix.elements[0] / depth / 2;
      const halfHeight = text.scale.y * camera.projectionMatrix.elements[5] / depth / 2;
      const bounds = [centre.x - halfWidth, centre.y - halfHeight, centre.x + halfWidth, centre.y + halfHeight];
      const foot = object.position.clone().project(camera);
      const head = object.position.clone().add(new THREE.Vector3(0, object.userData.anchorHeight, 0)).project(camera);
      const bodyWidth = state.ecs.personable[id].size * camera.projectionMatrix.elements[0] / depth / 2;
      activities.push({ id, text, bounds,
        body: [Math.min(foot.x, head.x) - bodyWidth, Math.min(foot.y, head.y), Math.max(foot.x, head.x) + bodyWidth, Math.max(foot.y, head.y)],
        onScreen: depth > 0 && centre.z < 1 && overlaps(bounds, [-1, -1, 1, 1]),
        priority: id == state.ui.playerId || selected.includes(id) });
    }
    const shown = [...nameBounds];
    activities.sort((a, b) => Number(b.priority) - Number(a.priority));
    for (const activity of activities) {
      const { id, text, bounds, priority, onScreen } = activity;
      text.visible = onScreen && !nameBounds.some(other => overlaps(bounds,other)) && (priority || (!shown.some(other => overlaps(bounds, other)) &&
        !activities.some(other => other.id != id && overlaps(bounds, other.body))));
      if (text.visible) shown.push(bounds);
    }
  };

  const light = () => {
    const sky = skyAt(state.days);
    const overviewLight = realm ? (isOverview() && rig.distance < 2200 ? 1 : THREE.MathUtils.smoothstep(rig.distance, 1800, 6500)) : 0;
    const night = sky.night * (1 - overviewLight), sunset = sky.sunset * (1 - overviewLight);
    const cloud = weatherLight((localWeather(state) || {}).type);
    const tint = WHITE.clone().lerp(SUNSET, sunset).lerp(NIGHT, night * 1.6);
    tint.lerp(new THREE.Color(0xB7C2CE), cloud.grey);
    sun.color.copy(tint);
    sun.intensity = SUN * (1 - night * 1.2) * cloud.sun;
    hemisphere.color.copy(tint);
    hemisphere.intensity = SKY * (1 - night * 0.9) * cloud.sky;
  };

  const pickables = () => [settlementOverlay, terrain.mesh, forest.mesh, instances.mesh, ...Object.entries(objects)
    .filter(([id]) => !forest.has(id) && !instances.has(id)).map(([, object]) => object)];

  const pick = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      (clientX - rect.left) / rect.width * 2 - 1,
      -(clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    for (const hit of raycaster.intersectObjects(pickables(), true)) {
      if (hit.object == terrain.mesh) {
        return terrain.tileAtVertex(hit.face.a);
      }
      if (hit.object.isInstancedMesh && hit.object.visible) {
        return hit.object.userData.entityIds[hit.instanceId];
      }
      let id = null;
      let visible = true;
      for (let o = hit.object; o && o != scene; o = o.parent) {
        visible = visible && o.visible;
        id = id || o.userData.entityId;
      }
      if (visible && id) {
        return id;
      }
    }
    return null;
  };

  // NOTE: the map's centre, and how far its flat sides and its points are
  // from it (to the middle of the rim hexes)
  const middle = Hex(state.map.centre.x, state.map.centre.y).toPoint();
  const apothem = state.map.radius * HEX_SIZE * 1.5;
  const circumradius = state.map.radius * HEX_SIZE * Math.sqrt(3);
  const wholeMapDistance = () => (circumradius + HEX_SIZE * 4) /
    (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));

  const realmDistance = () => realm ? realm.fitDistance(camera.aspect,camera.fov,rig.pose.yaw,.95,Math.max(.5,(canvas.clientHeight-190)/canvas.clientHeight)) : wholeMapDistance();
  const isOverview = () => realm && (rig.distance >= 2200 || Hex(state.map.centre).distance(Hex().fromPoint({ x:rig.pose.x, y:rig.pose.z })) > state.map.radius);
  const rig = createCameraRig(camera, canvas, {
    bounds: realm ? { centre: realm.layout.centre, apothem: realm.layout.radius } : { centre: middle, apothem },
    enabled: () => !introActive(state),
    followTarget: () => revealAll ? null : state.ecs.spatial[state.ui.playerId],
    usableRect: () => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const rect = { left: 0, top: 65, right: width, bottom: height - 85 };
      // Read actual panels: phone task drawers cover the bottom, desktop the left.
      if (typeof document != "undefined") {
        for (const selector of ["#task-panel", ".panel", "#opening-guidance"]) {
          const panel = document.querySelector(selector)?.getBoundingClientRect();
          if (!panel || !panel.width || !panel.height) continue;
          if (panel.width > width * .65 && panel.top > height * .4) rect.bottom = Math.min(rect.bottom, panel.top - 12);
          else if (panel.width < width * .5 && panel.left < width * .25) rect.left = Math.max(rect.left, panel.right + 12);
          else if (selector == "#opening-guidance") rect.top = Math.max(rect.top,panel.bottom + 12);
        }
      }
      return rect;
    },
    maxDistance: () => realm ? realm.layout.radius * 12 / Math.min(1,camera.aspect) : Math.max(3600, wholeMapDistance() * 1.5),
    groundHeight: (x, z) => realm ? realm.heightAt(x, z) : ground.heightAt(x, z),
    onClick: e => {
      if (realm) {
        const rect = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1, -(e.clientY-rect.top)/rect.height*2+1), camera);
        const selection = realmOverlay.pick(ray);
        if (isOverview() || selection && selection.reachKey != state.world.home.x + "," + state.world.home.y) {
          if (selection) inspectRealm(state, selection.reachKey, selection.villageId);
          return;
        }
      }
      const id = pick(e.clientX, e.clientY);
      if (id) {
        onSelect(id, e.pointerType == "touch");
      }
    }
  });

  // Precision follows the visible scale: a five-unit near plane cannot
  // distinguish sea from low coast at 100,000 units. Keep local/arrival
  // clearance, and bring the near plane out only when the camera pulls back.
  const syncDepth = () => {
    if (!realm) return;
    const near = Math.max(5,(rig.distance-5000)*.02);
    const far = Math.max(12000,rig.distance+realm.layout.radius*6);
    if(camera.near!=near || camera.far!=far) {
      camera.near=near;camera.far=far;camera.updateProjectionMatrix();
    }
  };
  const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y).toPoint();
  rig.tilt(0.8);
  rig.lookAt(start.x, start.y, 1000);

  let lastFrame = performance.now();
  let besidePanel = false;
  let wasOverview = false;
  let fittedRealm = false;
  let snowDay = Math.floor(state.days);
  let reportView = true;
  const viewMetrics = () => ({ distance:rig.distance, pose:rig.pose, level:overviewLevel(rig.distance), render:{...renderer.info?.render}, memory:{...renderer.info?.memory}, programs:renderer.info?.programs?.length,
    terrainTriangles:realm?.triangles, terrainBuildMs:realm?.constructionMs, days:state.days, active:state.travel?.active, maps:Object.keys(state.travel?.maps || {}).length, directory:Object.keys(state.travel?.people || {}).length,
    residents:Object.values(state.residents || {}).filter(Boolean).length, position:{...state.ecs.spatial[state.ui.playerId]}, jobs:state.ecs.manager?.[state.ui.playerId]?.jobs.length });
  const fitMap = () => {
    camera.far = Math.max(12000, wholeMapDistance() * 2);
    camera.updateProjectionMatrix();
    rig.tilt(1.45);
    rig.lookAt(middle.x - (besidePanel ? circumradius * 0.4 : 0), middle.y, wholeMapDistance());
  };

  return {
    camera,
    recenter() {
      fittedRealm = false; reportView = true; state.ui.realmSelection = null;
      rig.returnTo(state.ecs.spatial[state.ui.playerId] || start); syncDepth();
    },
    showRealm() {
      if (!realm) return;
      fittedRealm = true; reportView = true; rig.suspendFollow();
      state.ui.realmSelection = null;
      rig.tilt(.95); rig.lookAt(realm.layout.centre.x, realm.layout.centre.y, realmDistance()); syncDepth();
    },
    get overview() { return !!isOverview(); },
    get mapLevel() { return overviewLevel(rig.distance); },
    get realmTerrain() { return realm; },
    get metrics() { return viewMetrics(); },
    resumeFollow() { rig.resumeFollow(); },
    suspendFollow() { rig.suspendFollow(); },
    get following() { return rig.following; },
    get cameraDistance() { return rig.distance; },
    get terrain() { return terrain; },
    // Observer control for reproducible village inspection and captures.
    focusOn(point, distance = 1000) {
      fittedRealm = false; rig.suspendFollow();
      rig.shot({ x: point.x, z: point.y, y: realm ? realm.heightAt(point.x,point.y) : ground.heightAt(point.x, point.y), distance, yaw: 0, pitch: 0.8 }); syncDepth();
    },
    frame() {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;

      if (geography !== state.map.geography) {
        geography = state.map.geography;
        scene.remove(terrain.mesh);
        terrain.dispose();
        terrain = createTerrain(state, ground);
        if (realm) { terrain.mesh.children.forEach(child => { child.visible = false; }); realm.refreshGround(); }
        scene.add(terrain.mesh);
        state.redraws.push(...Object.keys(state.ecs.spatial));
        showKnown();
      }
      if (controlledId != state.ui.playerId) {
        state.redraws.push(controlledId,state.ui.playerId,...people);
        controlledId = state.ui.playerId; knownCount = -1;
        if (realm && state.ecs.spatial[controlledId]) rig.returnTo(state.ecs.spatial[controlledId]);
        else rig.resumeFollow(true);
      }
      const fences = fenceFootprints(state), version = fenceRevision(fences);
      if (version != fencesVersion) {
        state.redraws.push(...fenceIds,...fences.map(f=>f.id)); fencesVersion = version;
        fenceIds = fences.map(f=>f.id);
      }
      const arriving = introActive(state);
      const changedIntro = lastIntro != state.intro || wasArriving != arriving;
      if (changedIntro) {
        // Refresh cinematic label visibility even when the planner stays idle.
        if (state.intro) state.redraws.push(state.ui.playerId, ...people);
        if (campSetup) {
          scene.remove(campSetup);
          models.disposeObject(campSetup);
          campSetup = null;
        }
        if (arriving) {
          campSetup = models.campSetup(ground, state.intro.campPoint);
          scene.add(campSetup);
        }
        arrivalKnown = new Set(arriving ? arrivalTiles(state).map(h => h.x + "," + h.y) : []);
        showKnown();
      }
      if (campSetup) models.poseCampSetup(campSetup, state.intro);
      const knownChanged = refreshKnown();
      if (knownChanged) {
        showKnown();
      }

      const nowSelected = currentSelection();
      if (knownChanged || nowSelected.join() != selected.join() || commonsRevision != state.landUseRevision) {
        commonsRevision = state.landUseRevision;
        if (commonsOutline) { scene.remove(commonsOutline); models.disposeObject(commonsOutline); commonsOutline = null; }
        const tree = nowSelected.find(id => state.ecs.tree?.[id] || state.ecs.good?.[id]?.type == "wood" && !state.ecs.haulable?.[id]);
        const permission = tree && resourcePermission(state, state.ui.playerId, tree);
        if (permission?.kind == "common") { commonsOutline = commonBoundary(state, ground, permission.villageId, isKnown); scene.add(commonsOutline); }
        state.redraws.push(...selected, ...nowSelected);
        selected = nowSelected;
      }

      if (state.redraws.length > 0) {
        const dirty = new Set(state.redraws);
        state.redraws = [];
        for (const id of dirty) {
          rebuild(id);
        }
      }
      updateSettlements();
      terrain.update();
      const lod = realm ? overviewLevel(rig.distance) : { people:true, props:true };
      forest.mesh.visible = lod.props; instances.mesh.visible = lod.props;
      forest.setDistant(rig.distance > 3000);
      if (lod.props) forest.update();
      const weather = localWeather(state);
      if (weather && lod.props) forest.setWind(weather.wind, weather.type == "storm", now / 1000);

      if (lod.props) {
        for (const id in state.ecs.animal || {}) {
          const object = objects[id], p = state.ecs.spatial[id];
          if (!object) continue;
          object.position.set(p.x, ground.heightAt(p.x, p.y), p.y);
          object.rotation.y = state.ecs.animal[id].facing;
          object.visible = isKnown(p);
          instances.invalidate(id);
        }
        for (const id in state.ecs.workplace || {}) if (objects[id]) {
          animateWorkplace(state, id, objects[id], now / 1000);
          if (objects[id].getObjectByName("smoke")) instances.invalidate(id);
        }
        const occupied = occupiedHomes(state);
        for (const id of new Set([...Object.keys(state.ecs.building),...Object.keys(state.ecs.shelter || {})])) if (objects[id]) models.animateHome(objects[id],occupied.has(id));
        instances.update();
      }

      for (const id of people) {
        if (lod.people) followPerson(id);
        else if (objects[id]) objects[id].visible = false;
      }
      if (realm) for (const id in objects) if (!people.has(id) && !forest.has(id) && !instances.has(id)) objects[id].visible = lod.props && isKnown(state.ecs.spatial[id]);

      for (const id of selected) {
        const marker = objects[id] && objects[id].getObjectByName("marker");
        if (marker) {
          marker.position.y = marker.userData.bob + Math.sin(now / 250) * 2;
          marker.rotation.y = now / 600;
        }
      }

      light();
      if (state.intro && (arriving || changedIntro)) {
        const target = arrivalShot(state.intro, state.ecs.spatial[state.ui.playerId], state.intro.campPoint, camera.aspect, ground.heightAt);
        if (!shot || changedIntro) shot = target;
        else {
          const ease = 1 - Math.exp(-dt * 7);
          for (const key of Object.keys(target)) shot[key] += (target[key] - shot[key]) * ease;
        }
        rig.shot(shot);
      } else rig.update(dt);
      syncDepth();
      if (lod.people) showActivities();
      if (realm) {
        const overview = isOverview();
        if (overview && !wasOverview) { state.ui.actions?.dismiss_travel?.(); if(state.ui.show)state.ui.show.selected_person = null; state.ui.selected = null; }
        wasOverview = overview;
        const day = Math.floor(state.days);
        if (day != snowDay) { realm.refreshSnow(); snowDay = day; }
        realmOverlay.update(camera,canvas,{...overviewLevel(rig.distance),overview});
      }
      lastIntro = state.intro;
      wasArriving = arriving;
      weatherView.mesh.visible = !realm || rig.distance < 6500;
      if (weatherView.mesh.visible) weatherView.update(weather, camera, now / 1000,
        ["grassland", "steppe", "savanna"].includes(homeOf(state.world).biome),
        coldEnough(homeOf(state.world), state.days));
      renderer.render(scene, camera);
      if (realm && reportView) { performance.mark?.("tinyking-map-view",{detail:viewMetrics()}); reportView=false; }
    },
    resize(width, height) {
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      if (realm) {
        camera.far = realm.layout.radius * 16 / Math.min(1,camera.aspect); camera.updateProjectionMatrix();
        if (fittedRealm) rig.lookAt(realm.layout.centre.x,realm.layout.centre.y,realmDistance());
      }
      if (revealAll) fitMap();
      syncDepth();
    },
    screenPosition(id) {
      const s = state.ecs.spatial[id];
      if (!s) {
        return { x: 0, y: 0 };
      }
      const lift = objects[id] ? objects[id].userData.anchorHeight || 0 : 0;
      const p = new THREE.Vector3(s.x, ground.heightAt(s.x, s.y) + lift, s.y).project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (p.x + 1) / 2 * rect.width,
        y: rect.top + (1 - p.y) / 2 * rect.height
      };
    },
    setDesaturation(amount) {
      canvas.style.filter = amount > 0 ? "grayscale(" + amount + ")" : "";
    },
    // NOTE: besidePanel moves the map right, out from under a panel on the left
    showWholeMap(options = {}) {
      if (!revealAll) {
        revealAll = true;
        rig.suspendFollow();
        showKnown();
        // NOTE: near enough straight down, and far enough back that the
        // hexagon's points (and a hex beyond) fit in the view
        besidePanel = options.besidePanel;
        fitMap();
      }
    },
    pick,
    ground,
    objectOf: id => objects[id],
    dispose() {
      rig.dispose();
      if (campSetup) models.disposeObject(campSetup);
      if (commonsOutline) models.disposeObject(commonsOutline);
      for (const id in objects) {
        remove(id);
      }
      terrain.dispose();
      forest.dispose();
      instances.dispose();
      weatherView.dispose();
      if (realm) { realm.dispose(); realmOverlay.dispose(); sea.geometry.dispose(); sea.material.dispose(); }
      for (const name of villageLabels.values()) settlementOverlay.remove(name);
      if (areaOutline) models.disposeObject(areaOutline);
      canvas.style.filter = "";
    }
  };
}
