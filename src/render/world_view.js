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
import { villageModel, animateWorkplace } from "render/villages";
import { createForest } from "render/forest";
import { introActive, arrivalTiles } from "game/intro";
import { createCameraRig, arrivalShot } from "render/camera";
import { createWeatherView } from "render/weather";
import { weatherLight, skyAt, SUNSET_TINT, NIGHT_TINT } from "render/sky";

const hexKey = point => Hex().fromPoint(point).toString();

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
  const forest = createForest();
  scene.add(forest.mesh);
  const weatherView = createWeatherView(ground);
  scene.add(weatherView.mesh);

  const instances = createInstances();
  scene.add(instances.mesh);
  const objects = {};
  const people = new Set();
  let known = new Set();
  let knownCount = -1;
  let revealAll = false;
  let selected = [];
  let arrivalKnown = new Set();
  let lastIntro = null;
  let wasArriving = false;
  let shot = null;
  let campSetup = null;

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
    if (ecs.backyard?.[id] || ecs.workplace?.[id] || ecs.meetingPlace?.[id] || ecs.pasture?.[id] || ecs.animal?.[id]) return villageModel(ground, state, id);
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
      return models.field(ground, state, id, { selected: isSelected });
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
    const object = objects[id];
    const s = state.ecs.spatial[id];
    if (!object || !s) {
      return;
    }
    object.position.set(s.x, ground.heightAt(s.x, s.y), s.y);
    object.visible = isKnown(s) || (id == state.ui.playerId && introActive(state));

    const ring = object.getObjectByName("ring");
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), models.surfaceNormal(ground, s.x, s.y));

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
    for (const id of people) {
      const object = objects[id], text = object.getObjectByName("activity");
      if (!object.visible || !text) continue;
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
    const shown = [];
    activities.sort((a, b) => Number(b.priority) - Number(a.priority));
    for (const activity of activities) {
      const { id, text, bounds, priority, onScreen } = activity;
      text.visible = onScreen && (priority || (!shown.some(other => overlaps(bounds, other)) &&
        !activities.some(other => other.id != id && overlaps(bounds, other.body))));
      if (text.visible) shown.push(bounds);
    }
  };

  const light = () => {
    const { night, sunset } = skyAt(state.days);
    const cloud = weatherLight((localWeather(state) || {}).type);
    const tint = WHITE.clone().lerp(SUNSET, sunset).lerp(NIGHT, night * 1.6);
    tint.lerp(new THREE.Color(0xB7C2CE), cloud.grey);
    sun.color.copy(tint);
    sun.intensity = SUN * (1 - night * 1.2) * cloud.sun;
    hemisphere.color.copy(tint);
    hemisphere.intensity = SKY * (1 - night * 0.9) * cloud.sky;
  };

  const pickables = () => [terrain.mesh, forest.mesh, instances.mesh, ...Object.entries(objects)
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

  const rig = createCameraRig(camera, canvas, {
    bounds: { centre: middle, apothem },
    enabled: () => !introActive(state),
    maxDistance: () => Math.max(3600, wholeMapDistance() * 1.5),
    groundHeight: (x, z) => ground.heightAt(x, z),
    onClick: e => {
      const id = pick(e.clientX, e.clientY);
      if (id) {
        onSelect(id, e.pointerType == "touch");
      }
    }
  });

  const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y).toPoint();
  rig.tilt(0.8);
  rig.lookAt(start.x, start.y, 1000);

  let lastFrame = performance.now();
  let besidePanel = false;
  const fitMap = () => {
    camera.far = Math.max(12000, wholeMapDistance() * 2);
    camera.updateProjectionMatrix();
    rig.tilt(1.45);
    rig.lookAt(middle.x - (besidePanel ? circumradius * 0.4 : 0), middle.y, wholeMapDistance());
  };

  return {
    camera,
    get terrain() { return terrain; },
    // Observer control for reproducible village inspection and captures.
    focusOn(point, distance = 1000) {
      rig.shot({ x: point.x, z: point.y, y: ground.heightAt(point.x, point.y), distance, yaw: 0, pitch: 0.8 });
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
        scene.add(terrain.mesh);
        state.redraws.push(...Object.keys(state.ecs.spatial));
        showKnown();
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
      if (refreshKnown()) {
        showKnown();
      }

      const nowSelected = currentSelection();
      if (nowSelected.join() != selected.join()) {
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
      terrain.update();
      forest.setDistant(rig.distance > 3000);
      forest.update();
      const weather = localWeather(state);
      if (weather) forest.setWind(weather.wind, weather.type == "storm", now / 1000);

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
      instances.update();

      for (const id of people) {
        followPerson(id);
      }

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
      showActivities();
      lastIntro = state.intro;
      wasArriving = arriving;
      weatherView.update(weather, camera, now / 1000,
        ["grassland", "steppe", "savanna"].includes(homeOf(state.world).biome),
        coldEnough(homeOf(state.world), state.days));
      renderer.render(scene, camera);
    },
    resize(width, height) {
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      if (revealAll) {
        fitMap();
      }
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
      for (const id in objects) {
        remove(id);
      }
      terrain.dispose();
      forest.dispose();
      instances.dispose();
      weatherView.dispose();
      canvas.style.filter = "";
    }
  };
}
