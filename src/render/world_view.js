import * as THREE from "three";

import { Hex, HEX_SIZE } from "game/map";
import { entityExists, fullEntity } from "game/entities";
import { topController } from "game/playable";
import { createHeightField } from "game/height";

import * as models from "render/models";
import { realmColour } from "render/colours";
import { lookOf } from "render/biomes";
import { createTerrain } from "render/terrain";
import { createCameraRig } from "render/camera";
import { skyAt, SUNSET_TINT, NIGHT_TINT } from "render/sky";

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

  const ground = createHeightField({
    seed: state.map.seed,
    terrainAt: key => {
      const id = (state.space[key] || []).find(e => state.ecs.mappable[e]);
      return id && state.ecs.mappable[id].terrain;
    }
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / Math.max(1, canvas.clientHeight), 5, 12000);

  const hemisphere = new THREE.HemisphereLight(0xDDE8FF, 0x4A4030, SKY);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xFFFFFF, SUN);
  sun.position.set(-0.7, 0.8, 0.45);
  scene.add(sun);

  const terrain = createTerrain(state, ground);
  scene.add(terrain.mesh);

  const objects = {};
  const people = new Set();
  let known = new Set();
  let knownCount = -1;
  let revealAll = false;
  let selected = [];

  const isKnown = point => revealAll || known.has(hexKey(point));

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
        objects[id].visible = revealAll || known.has(objects[id].userData.hexKey);
      }
    }
  };

  const currentSelection = () => [state.ui.selected, state.ui.show && state.ui.show.selected_person]
    .filter(id => id);

  const remove = id => {
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
    scene.add(object);
  };

  const followPerson = id => {
    const object = objects[id];
    const s = state.ecs.spatial[id];
    if (!object || !s) {
      return;
    }
    object.position.set(s.x, ground.heightAt(s.x, s.y), s.y);
    object.visible = isKnown(s);

    const ring = object.getObjectByName("ring");
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), models.surfaceNormal(ground, s.x, s.y));

    const last = object.userData.last;
    if (last) {
      const dx = s.x - last.x;
      const dz = s.y - last.y;
      if (dx * dx + dz * dz > 0.0001) {
        object.getObjectByName("figure").rotation.y = Math.atan2(dx, dz);
      }
    }
    object.userData.last = { x: s.x, y: s.y };
  };

  const light = () => {
    const { night, sunset } = skyAt(state.days);
    const tint = WHITE.clone().lerp(SUNSET, sunset).lerp(NIGHT, night * 1.6);
    sun.color.copy(tint);
    sun.intensity = SUN * (1 - night * 1.2);
    hemisphere.color.copy(tint);
    hemisphere.intensity = SKY * (1 - night * 0.9);
  };

  const pickables = () => [terrain.mesh, ...Object.values(objects)];

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

  const rig = createCameraRig(camera, canvas, {
    bounds: { centre: middle, apothem },
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

  return {
    camera,
    frame() {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;

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
      rig.update(dt);
      renderer.render(scene, camera);
    },
    resize(width, height) {
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
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
    showWholeMap() {
      if (!revealAll) {
        revealAll = true;
        showKnown();
        // NOTE: near enough straight down, and far enough back that the
        // hexagon's points (and a hex beyond) fit in the view
        const fit = (circumradius + HEX_SIZE * 4) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        rig.tilt(1.45);
        rig.lookAt(middle.x, middle.y, fit);
      }
    },
    pick,
    ground,
    objectOf: id => objects[id],
    dispose() {
      rig.dispose();
      for (const id in objects) {
        remove(id);
      }
      terrain.dispose();
      canvas.style.filter = "";
    }
  };
}
