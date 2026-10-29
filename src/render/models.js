import * as THREE from "three";

import { Hex, HAIR, HEX_SIZE, TRIANGLES } from "game/map";
import * as math from "game/math";
import { COLOURS, ITEM_COLOURS, SELECTED } from "render/colours";
import { label } from "render/labels";

import crops from "data/crops.json";

const ROUTES_TO_FULL_PATH = 100;
const GOLDEN_RATIO = 1.618034;
export const HIT_RADIUS = 22.5;

const UP = new THREE.Vector3(0, 1, 0);

// NOTE: A ground with no hills, for previews.
export const FLAT_GROUND = {
  heightAt: () => 0,
  slopeAt: () => ({ dx: 0, dy: 0 }),
  hex: () => ({ centre: 0, corners: [0, 0, 0, 0, 0, 0] })
};

// NOTE: Geometry and materials shared between many objects are flagged so
// that disposing one object does not free them for everyone else.
const shared = thing => {
  thing.userData.shared = true;
  return thing;
};

const lamberts = new Map();
export const lambert = colour => {
  if (!lamberts.has(colour)) {
    lamberts.set(colour, shared(new THREE.MeshLambertMaterial({ color: colour, flatShading: true })));
  }
  return lamberts.get(colour);
};

const vertexColoured = shared(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

// NOTE: Ground overlays (paths, fields, stockpiles) are drawn just above the
// terrain; polygon offset keeps them in front of it without z-fighting.
const overlays = new Map();
const overlay = (colour, opacity, order) => {
  const key = colour + ":" + opacity.toFixed(2) + ":" + order;
  if (!overlays.has(key)) {
    overlays.set(key, shared(new THREE.MeshLambertMaterial({
      color: colour,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      polygonOffset: true,
      polygonOffsetFactor: -order,
      polygonOffsetUnits: -order * 4,
      side: THREE.DoubleSide
    })));
  }
  return overlays.get(key);
};

const pickProxyMaterial = shared(new THREE.MeshBasicMaterial({ visible: false }));

export function disposeObject(object) {
  object.traverse(child => {
    if (child.geometry && !child.geometry.userData.shared) {
      child.geometry.dispose();
    }
    if (child.material && !child.material.userData.shared && !child.isSprite) {
      child.material.dispose();
    }
  });
}

// NOTE: game (x, y) is three (x, z); height is three y.
const toWorld = (ground, p, lift) => new THREE.Vector3(p.x, ground.heightAt(p.x, p.y) + lift, p.y);

export function surfaceNormal(ground, x, y) {
  const { dx, dy } = ground.slopeAt(x, y);
  return new THREE.Vector3(-dx, 1, -dy).normalize();
}

// NOTE: A quad laid over the ground, subdivided so it follows the hex fans.
// Corners go round the quad in order: a, b, c, d.
function drapedQuad(ground, [a, b, c, d], lift, nu = 4, nv = 4) {
  const positions = [];
  for (let j = 0; j <= nv; j++) {
    const left = math.lerp(a, d, j / nv);
    const right = math.lerp(b, c, j / nv);
    for (let i = 0; i <= nu; i++) {
      const p = toWorld(ground, math.lerp(left, right, i / nu), lift);
      positions.push(p.x, p.y, p.z);
    }
  }
  const index = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const p = j * (nu + 1) + i;
      index.push(p, p + nu + 1, p + 1, p + 1, p + nu + 1, p + nu + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// NOTE: The hex fan shrunk towards its centre. Shrinking along the spokes
// keeps every point on the terrain's own triangles, so it lies flush.
function drapedHex(ground, centre, scale, lift) {
  const corners = Hex().corners().map(c => ({ x: centre.x + c.x * scale, y: centre.y + c.y * scale }));
  const middle = toWorld(ground, centre, lift);
  const positions = [];
  for (let k = 0; k < 6; k++) {
    const a = toWorld(ground, corners[k], lift);
    const b = toWorld(ground, corners[(k + 1) % 6], lift);
    positions.push(middle.x, middle.y, middle.z, b.x, b.y, b.z, a.x, a.y, a.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function hexOutline(ground, centre, colour) {
  const corners = Hex().corners().map(c => ({ x: centre.x + c.x * 0.97, y: centre.y + c.y * 0.97 }));
  const points = [];
  for (let k = 0; k < 6; k++) {
    for (let s = 0; s < 4; s++) {
      points.push(toWorld(ground, math.lerp(corners[k], corners[(k + 1) % 6], s / 4), 1.5));
    }
  }
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: colour, depthTest: false }));
  line.renderOrder = 5;
  return line;
}

// NOTE: Bake several coloured parts into one geometry, so a tree or a house
// costs a single draw call.
function mergeColoured(parts) {
  const positions = [];
  const normals = [];
  const colours = [];
  const colour = new THREE.Color();
  for (const { geometry, colour: hex, matrix } of parts) {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone());
    if (matrix) {
      g.applyMatrix4(matrix);
    }
    g.computeVertexNormals();
    colour.setHex(hex);
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colours.push(colour.r, colour.g, colour.b);
    }
    g.dispose();
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  return merged;
}

const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
  new THREE.Vector3(sx, sy, sz));

// NOTE: A downward-pointing marker floating over whatever is selected.
function selectionMarker(height) {
  const marker = new THREE.Mesh(markerGeometry(), lambert(SELECTED));
  marker.position.y = height;
  marker.userData.bob = height;
  marker.name = "marker";
  return marker;
}

let markerGeometryCache;
const markerGeometry = () => {
  if (!markerGeometryCache) {
    markerGeometryCache = shared(new THREE.ConeGeometry(5, 10, 4));
    markerGeometryCache.rotateX(Math.PI);
  }
  return markerGeometryCache;
};

// --- Trees -----------------------------------------------------------------

const treeGeometries = {};
const treeGeometry = amount => {
  if (!treeGeometries[amount]) {
    const r = HEX_SIZE * (0.1 + amount * 0.1);
    treeGeometries[amount] = shared(mergeColoured([
      { geometry: new THREE.CylinderGeometry(r * 0.12, r * 0.18, r * 0.8, 5), colour: COLOURS.trunk, matrix: at(0, r * 0.4, 0) },
      { geometry: new THREE.ConeGeometry(r * 0.8, r * 1.6, 6), colour: COLOURS.tree, matrix: at(0, r * 1.25, 0) },
      { geometry: new THREE.ConeGeometry(r * 0.6, r * 1.2, 6), colour: COLOURS.tree, matrix: at(0, r * 1.95, 0, 0, 0.5) },
    ]));
  }
  return treeGeometries[amount];
};

export function tree(ground, ecs, id) {
  const { x, y } = ecs.spatial[id];
  const amount = Math.max(1, Math.min(3, ecs.good[id].amount));
  const mesh = new THREE.Mesh(treeGeometry(amount), vertexColoured);
  // NOTE: sink the trunk a little so it never floats on a slope
  mesh.position.set(x, ground.heightAt(x, y) - 2, y);
  mesh.rotation.y = (+id * 2.399) % (Math.PI * 2);
  mesh.userData.anchorHeight = HEX_SIZE * (0.1 + amount * 0.1) * 2.5;
  return mesh;
}

// --- Buildings ---------------------------------------------------------------

// NOTE: a unit pyramid on a square base lined up with the axes, so it can be
// stretched to fit the walls
const squarePyramid = () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);

export function building(ground, state, id, options) {
  const { x, y } = state.ecs.spatial[id];
  return house(ground, x, y, state.ecs.building[id].entrance, options);
}

export function house(ground, x, y, entrance, { playerOwned, selected }) {
  const w = HEX_SIZE * 1.35;
  const d = w / GOLDEN_RATIO;
  const wall = 26;
  const roof = 24;
  // NOTE: Same turn as the 2D sprite; three's y rotation runs the other way
  const angle = -2 * Math.PI * (entrance - 1) / 6;

  const group = new THREE.Group();
  group.position.set(x, 0, y);
  group.rotation.y = angle;

  // NOTE: Stand the house on its lowest corner and run the walls down into
  // the hill on the high side, so it is neither floating nor buried.
  const footprint = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [0, 0]]
    .map(([lx, lz]) => {
      const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(UP, angle);
      return ground.heightAt(x + v.x, y + v.z);
    });
  const low = Math.min(...footprint) - 4;
  const high = Math.max(...footprint);
  const body = high + wall - low;

  const doorWorld = new THREE.Vector3(0, 0, d / 2).applyAxisAngle(UP, angle);
  const doorGround = ground.heightAt(x + doorWorld.x, y + doorWorld.z);

  const parts = [
    { geometry: new THREE.BoxGeometry(w, body, d), colour: COLOURS.wall, matrix: at(0, low + body / 2, 0) },
    { geometry: squarePyramid(), colour: COLOURS.roof,
      matrix: at(0, high + wall + roof / 2, 0, 0, 0, 0, w + 10, roof, d + 10) },
    { geometry: new THREE.BoxGeometry(w * 0.3, 16, 2), colour: COLOURS.door, matrix: at(0, doorGround + 8, d / 2 + 0.5) },
  ];
  if (playerOwned) {
    parts.push(
      { geometry: new THREE.CylinderGeometry(0.8, 0.8, 26, 4), colour: COLOURS.door, matrix: at(w * 0.3, high + wall + 13, 0) },
      { geometry: new THREE.BoxGeometry(12, 8, 1), colour: 0xD93B30, matrix: at(w * 0.3 + 6, high + wall + 21, 0) });
  }
  group.add(new THREE.Mesh(mergeColoured(parts), vertexColoured));

  if (selected) {
    const marker = selectionMarker(high + wall + roof + 14);
    group.add(marker);
  }
  group.userData.anchorHeight = high + wall + roof - ground.heightAt(x, y);
  return group;
}

// --- People ------------------------------------------------------------------

const personParts = new Map();
const personGeometry = (size, body, hair) => {
  const key = [size, body, hair].join(":");
  if (!personParts.has(key)) {
    const radius = size * 0.36;
    const length = size * 0.55;
    const top = length + radius * 2;
    personParts.set(key, shared(mergeColoured([
      { geometry: new THREE.CapsuleGeometry(radius, length, 2, 6), colour: body, matrix: at(0, top / 2, 0) },
      { geometry: new THREE.IcosahedronGeometry(size * 0.3, 0), colour: COLOURS.skin, matrix: at(0, top + size * 0.22, 0) },
      { geometry: new THREE.SphereGeometry(size * 0.33, 6, 3, 0, Math.PI * 2, 0, Math.PI * 0.5), colour: hair,
        matrix: at(0, top + size * 0.26, -size * 0.04) },
      // NOTE: a nose, so you can see which way they are facing
      { geometry: new THREE.BoxGeometry(size * 0.1, size * 0.1, size * 0.12), colour: COLOURS.skin,
        matrix: at(0, top + size * 0.2, size * 0.3) },
    ])));
  }
  return personParts.get(key);
};

const ringGeometries = new Map();
const ringGeometry = size => {
  if (!ringGeometries.has(size)) {
    const g = shared(new THREE.TorusGeometry(size * 0.7, Math.max(1.2, size * 0.09), 4, 16));
    g.rotateX(Math.PI / 2);
    ringGeometries.set(size, g);
  }
  return ringGeometries.get(size);
};

let proxyGeometry;

export const personHeight = size => size * 0.55 + size * 0.36 * 2 + size * 0.55;

export function person(state, e, t, { realm, selected }) {
  const size = e.personable.size;
  const group = new THREE.Group();

  const figure = new THREE.Group();
  figure.name = "figure";
  figure.add(new THREE.Mesh(personGeometry(size, e.personable.body, HAIR[e.personable.hair]), vertexColoured));
  if (e.personable.dead) {
    figure.rotation.x = Math.PI / 2;
    figure.position.y = size * 0.3;
  }
  group.add(figure);

  const ring = new THREE.Mesh(ringGeometry(size), lambert(selected ? SELECTED : realm));
  ring.name = "ring";
  ring.position.y = 0.5;
  if (selected) {
    ring.scale.set(1.3, 1, 1.3);
  }
  group.add(ring);

  if (!proxyGeometry) {
    proxyGeometry = shared(new THREE.CylinderGeometry(HIT_RADIUS, HIT_RADIUS, 40, 8));
    proxyGeometry.translate(0, 20, 0);
  }
  group.add(new THREE.Mesh(proxyGeometry, pickProxyMaterial));

  const height = personHeight(size);
  if (e.holder) {
    e.holder.held.forEach((id, idx) => {
      if (state.ecs.good[id]) {
        const carried = item(state.ecs.good[id].type);
        carried.position.set(-5 + idx * 10, height * 0.45, size * 0.45);
        figure.add(carried);
      }
    });
  }

  if (e.planner && e.planner.world.label) {
    const text = label(t("tasks." + e.planner.world.label));
    text.position.y = height + 14;
    group.add(text);
  }

  if (selected) {
    group.add(selectionMarker(height + (e.planner && e.planner.world.label ? 32 : 16)));
  }

  group.userData.anchorHeight = height;
  return group;
}

// --- Goods -------------------------------------------------------------------

const itemGeometries = {};
const itemGeometry = type => {
  if (!itemGeometries[type]) {
    let g;
    if (type == "wood") {
      g = new THREE.CylinderGeometry(3.5, 3.5, 20, 6);
      g.rotateZ(Math.PI / 2);
      g.translate(0, 3.5, 0);
    } else if (type == "grain") {
      g = new THREE.IcosahedronGeometry(6, 0);
      g.scale(1, 0.8, 1);
      g.translate(0, 4.5, 0);
    } else {
      g = new THREE.CylinderGeometry(5, 4, 7, 7);
      g.translate(0, 3.5, 0);
    }
    itemGeometries[type] = shared(g);
  }
  return itemGeometries[type];
};

export function item(type) {
  return new THREE.Mesh(itemGeometry(type), lambert(ITEM_COLOURS[type] || COLOURS.dirt));
}

export function groundItem(ground, ecs, id) {
  const { x, y } = ecs.spatial[id];
  const mesh = item(ecs.good[id].type);
  mesh.position.set(x, ground.heightAt(x, y) - 0.5, y);
  mesh.rotation.y = (+id * 1.7) % Math.PI;
  mesh.userData.anchorHeight = 8;
  return mesh;
}

// --- Ground overlays -----------------------------------------------------------

export function hexTile(ground, centre, colour) {
  const mesh = new THREE.Mesh(drapedHex(ground, centre, 1, 0), lambert(colour));
  mesh.userData.anchorHeight = 0;
  return mesh;
}

export { hexOutline };

export function tileOverlay(ground, ecs, id, { selected }) {
  const group = new THREE.Group();
  const centre = ecs.spatial[id];
  const corners = Hex().corners().map(c => ({ x: c.x + centre.x, y: c.y + centre.y }));

  for (const key in ecs.walkable[id].worn) {
    const [ entrance, exit ] = key.split(",").map(i => i == "C" ? "C" : +i);
    const opacity = Math.min(1.0, ecs.walkable[id].worn[key] / ROUTES_TO_FULL_PATH);
    const ends = side => side != "C" ? [corners[side], corners[(side + 1) % 6]] : [centre, centre];
    const [ e0, e1 ] = ends(entrance);
    const [ x0, x1 ] = ends(exit);
    const geometry = drapedQuad(ground, [
      math.lerp(e0, e1, 0.25),
      math.lerp(e0, e1, 0.75),
      math.lerp(x0, x1, 0.25),
      math.lerp(x0, x1, 0.75),
    ], 0.4);
    group.add(new THREE.Mesh(geometry, overlay(COLOURS.dirt, Math.round(opacity * 20) / 20, 1)));
  }

  if (selected) {
    group.add(hexOutline(ground, centre, SELECTED));
    const marker = selectionMarker(24);
    marker.position.set(centre.x, ground.heightAt(centre.x, centre.y) + 24, centre.y);
    marker.userData.bob = marker.position.y;
    group.add(marker);
  }
  group.userData.anchorHeight = 0;
  return group;
}

export function field(ground, state, id, { selected }) {
  const group = new THREE.Group();
  const centre = state.ecs.spatial[id];
  group.add(new THREE.Mesh(drapedHex(ground, centre, 0.9, 0.6), overlay(COLOURS.field, 0.7, 2)));

  state.ecs.farmable[id].slots.forEach((slot, idx) => {
    const p = { x: centre.x + TRIANGLES[idx].x, y: centre.y + TRIANGLES[idx].y };
    if (["harvested", "harvestable", "ploughed", "sown"].includes(slot.state)) {
      group.add(new THREE.Mesh(drapedQuad(ground, [
        { x: p.x - 14, y: p.y - 5.5 },
        { x: p.x + 14, y: p.y - 5.5 },
        { x: p.x + 14, y: p.y + 5.5 },
        { x: p.x - 14, y: p.y + 5.5 },
      ], 0.8, 3, 1), overlay(COLOURS.dirt, 1, 3)));
    }
    if (["harvested"].includes(slot.state)) {
      const stubble = new THREE.Mesh(stubbleGeometry(), lambert(0x2A211C));
      stubble.position.copy(toWorld(ground, p, 0.6));
      group.add(stubble);
    } else if (["harvestable", "sown"].includes(slot.state)) {
      const radius = Math.min(6,
        Math.max(2,
          (state.days - slot.updated) * 6 / crops[slot.content].growingTime));
      const crop = new THREE.Mesh(cropGeometry(), lambert(parseInt(crops[slot.content].colour, 16)));
      crop.scale.set(radius, slot.state == "harvestable" ? radius * 2.2 : radius * 1.6, radius);
      crop.position.copy(toWorld(ground, p, 0));
      group.add(crop);
    }
  });

  if (selected) {
    const marker = selectionMarker(24);
    marker.position.set(centre.x, ground.heightAt(centre.x, centre.y) + 24, centre.y);
    marker.userData.bob = marker.position.y;
    group.add(marker);
  }
  group.userData.anchorHeight = 0;
  return group;
}

let cropGeometryCache;
const cropGeometry = () => {
  if (!cropGeometryCache) {
    cropGeometryCache = shared(new THREE.ConeGeometry(1, 1, 5));
    cropGeometryCache.translate(0, 0.5, 0);
  }
  return cropGeometryCache;
};

let stubbleGeometryCache;
const stubbleGeometry = () => {
  if (!stubbleGeometryCache) {
    stubbleGeometryCache = shared(new THREE.CylinderGeometry(4, 4, 1, 6));
  }
  return stubbleGeometryCache;
};

export function stockpile(ground, state, id, { selected }) {
  const group = new THREE.Group();
  const centre = state.ecs.spatial[id];
  group.add(new THREE.Mesh(drapedHex(ground, centre, 0.8, 0.6), overlay(COLOURS.stone, 0.55, 2)));

  const capacity = label("" + state.ecs.holder[id].capacity, { fontSize: 16, height: 16, background: null });
  capacity.position.copy(toWorld(ground, centre, 10));
  group.add(capacity);

  state.ecs.holder[id].held.forEach(itemId => {
    if (state.ecs.good[itemId] && state.ecs.spatial[itemId]) {
      group.add(groundItem(ground, state.ecs, itemId));
    }
  });

  if (selected) {
    const marker = selectionMarker(30);
    marker.position.set(centre.x, ground.heightAt(centre.x, centre.y) + 30, centre.y);
    marker.userData.bob = marker.position.y;
    group.add(marker);
  }
  group.userData.anchorHeight = 0;
  return group;
}
