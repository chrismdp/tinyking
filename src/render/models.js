import * as THREE from "three";

import { Hex, HAIR, HEX_SIZE, TRIANGLES } from "game/map";
import * as math from "game/math";
import { CAMP_LAYOUT } from "game/intro";
import { COLOURS, ITEM_COLOURS, SELECTED } from "render/colours";
import { treeColours, treeKind } from "render/biomes";
import { label } from "render/labels";

import { currentActivity } from "game/person_activity";
import { forageAvailable } from "game/ecology";

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
export function mergeColoured(parts) {
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

export const at = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
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

// NOTE: Each tree shape as parts of size r, from the ground up, and how tall
// it stands in r. "leaves", "tip" and "trunk" take the biome's colours.
const TREE_SHAPES = {
  conifer: { height: 2.5, parts: r => [
    { geometry: new THREE.CylinderGeometry(r * 0.12, r * 0.18, r * 0.8, 5), colour: "trunk", matrix: at(0, r * 0.4, 0) },
    { geometry: new THREE.ConeGeometry(r * 0.8, r * 1.6, 6), colour: "leaves", matrix: at(0, r * 1.25, 0) },
    { geometry: new THREE.ConeGeometry(r * 0.6, r * 1.2, 6), colour: "leaves", matrix: at(0, r * 1.95, 0, 0, 0.5) },
  ]},
  pine: { height: 2.6, parts: r => [
    { geometry: new THREE.CylinderGeometry(r * 0.08, r * 0.12, r * 0.7, 5), colour: "trunk", matrix: at(0, r * 0.35, 0) },
    { geometry: new THREE.ConeGeometry(r * 0.52, r * 1.1, 6), colour: "leaves", matrix: at(0, r * 1.0, 0) },
    { geometry: new THREE.ConeGeometry(r * 0.42, r * 0.95, 6), colour: "leaves", matrix: at(0, r * 1.6, 0, 0, 0.5) },
    { geometry: new THREE.ConeGeometry(r * 0.3, r * 0.8, 6), colour: "tip", matrix: at(0, r * 2.15, 0) },
  ]},
  round: { height: 2.1, parts: r => [
    { geometry: new THREE.CylinderGeometry(r * 0.12, r * 0.2, r * 1.1, 5), colour: "trunk", matrix: at(0, r * 0.55, 0) },
    { geometry: new THREE.IcosahedronGeometry(r * 0.8, 0), colour: "leaves", matrix: at(0, r * 1.45, 0, 0, 0, 0, 1, 0.8, 1) },
    { geometry: new THREE.IcosahedronGeometry(r * 0.5, 0), colour: "leaves", matrix: at(r * 0.45, r * 1.15, r * 0.2, 0.4, 0.3) },
  ]},
  acacia: { height: 1.6, parts: r => [
    { geometry: new THREE.CylinderGeometry(r * 0.07, r * 0.11, r * 1.3, 5), colour: "trunk", matrix: at(0, r * 0.65, 0, 0, 0, 0.12) },
    { geometry: new THREE.CylinderGeometry(r * 0.95, r * 0.6, r * 0.28, 7), colour: "leaves", matrix: at(r * 0.08, r * 1.4, 0) },
  ]},
  cactus: { height: 1.6, parts: r => [
    { geometry: new THREE.CylinderGeometry(r * 0.15, r * 0.18, r * 1.5, 6), colour: "leaves", matrix: at(0, r * 0.75, 0) },
    { geometry: new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.35, 5), colour: "leaves", matrix: at(r * 0.24, r * 0.7, 0, 0, 0, Math.PI / 2) },
    { geometry: new THREE.CylinderGeometry(r * 0.09, r * 0.09, r * 0.55, 5), colour: "leaves", matrix: at(r * 0.4, r * 0.95, 0) },
    { geometry: new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.3, 5), colour: "leaves", matrix: at(-r * 0.22, r * 0.95, 0, 0, 0, Math.PI / 2) },
    { geometry: new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.4, 5), colour: "leaves", matrix: at(-r * 0.36, r * 1.12, 0) },
  ]},
  willow: { height: 2.1, parts: r => [
    { geometry: new THREE.CylinderGeometry(r * 0.1, r * 0.18, r * 1.8, 5), colour: "trunk", matrix: at(0, r * 0.9, 0) },
    { geometry: new THREE.IcosahedronGeometry(r * 0.6, 0), colour: "leaves", matrix: at(0, r * 1.8, 0, 0, 0, 0, 1.25, 0.6, 1.25) },
    // NOTE: the weeping fronds, hanging down all round the crown
    ...Array.from({ length: 7 }, (_, k) => ({
      geometry: new THREE.ConeGeometry(r * 0.2, r * 1.05, 4), colour: "leaves",
      matrix: at(Math.cos(k * 0.9) * r * 0.62, r * 1.3, Math.sin(k * 0.9) * r * 0.62, Math.PI, k * 0.9, 0)
    })),
  ]},
  stunted: { height: 1.6, parts: r => [
    { geometry: new THREE.CylinderGeometry(r * 0.07, r * 0.1, r * 0.4, 5), colour: "trunk", matrix: at(0, r * 0.2, 0) },
    { geometry: new THREE.ConeGeometry(r * 0.45, r * 0.7, 6), colour: "leaves", matrix: at(0, r * 0.65, 0) },
    { geometry: new THREE.ConeGeometry(r * 0.33, r * 0.6, 6), colour: "leaves", matrix: at(0, r * 1.0, 0, 0, 0.5) },
    { geometry: new THREE.ConeGeometry(r * 0.2, r * 0.45, 6), colour: "tip", matrix: at(0, r * 1.35, 0) },
  ]},
  dwarf: { height: 0.9, parts: r => [
    { geometry: new THREE.IcosahedronGeometry(r * 0.6, 0), colour: "leaves", matrix: at(0, r * 0.3, 0, 0, 0, 0, 1, 0.6, 1) },
    { geometry: new THREE.IcosahedronGeometry(r * 0.42, 0), colour: "leaves", matrix: at(r * 0.6, r * 0.2, -r * 0.15, 0.4, 0, 0, 1, 0.6, 1) },
    { geometry: new THREE.IcosahedronGeometry(r * 0.35, 0), colour: "tip", matrix: at(-r * 0.45, r * 0.18, r * 0.35, 0.2, 0.6, 0, 1, 0.6, 1) },
  ]},
  palm: { height: 2.2, parts: r => {
    const top = { x: r * 0.3, y: r * 1.95 };
    const fronds = Array.from({ length: 6 }, (_, k) => {
      const spin = k * Math.PI / 3;
      const length = r * 0.95;
      // NOTE: a flattened cone tipped out and a little down, then turned
      // round the crown
      return { geometry: new THREE.ConeGeometry(r * 0.2, length, 4), colour: "leaves",
        matrix: at(top.x + Math.cos(spin) * 0.95 * length / 2, top.y - 0.32 * length / 2, -Math.sin(spin) * 0.95 * length / 2,
          0, spin, -1.9, 0.3, 1, 1) };
    });
    return [
      { geometry: new THREE.CylinderGeometry(r * 0.08, r * 0.11, r * 1.05, 5), colour: "trunk", matrix: at(r * 0.06, r * 0.5, 0, 0, 0, -0.12) },
      { geometry: new THREE.CylinderGeometry(r * 0.06, r * 0.08, r * 0.95, 5), colour: "trunk", matrix: at(r * 0.2, r * 1.45, 0, 0, 0, -0.24) },
      ...fronds,
    ];
  }},
  scrub: { height: 0.9, parts: r => [
    { geometry: new THREE.IcosahedronGeometry(r * 0.45, 0), colour: "leaves", matrix: at(0, r * 0.35, 0, 0, 0, 0, 1, 0.75, 1) },
    { geometry: new THREE.IcosahedronGeometry(r * 0.32, 0), colour: "leaves", matrix: at(r * 0.45, r * 0.25, r * 0.15, 0.5) },
    { geometry: new THREE.IcosahedronGeometry(r * 0.28, 0), colour: "leaves", matrix: at(-r * 0.3, r * 0.22, -r * 0.35, 0.2, 0.7) },
  ]},
};

const treeSize = amount => HEX_SIZE * (0.1 + amount * 0.1);

const treeGeometries = new Map();
const treeGeometry = (kind, amount, biome, morality) => {
  const key = [kind, amount, biome, morality].join(":");
  if (!treeGeometries.has(key)) {
    const colours = treeColours(biome, morality, kind);
    const parts = TREE_SHAPES[kind].parts(treeSize(amount));
    treeGeometries.set(key, shared(mergeColoured(parts.map(p => ({ ...p, colour: colours[p.colour].getHex() })))));
  }
  return treeGeometries.get(key);
};

// NOTE: look is the biome and morality of the ground the tree stands on,
// and whether it is by water
export function tree(ground, ecs, id, look) {
  const { x, y } = ecs.spatial[id];
  const growth = ecs.tree && ecs.tree[id];
  const amount = Math.max(1, Math.min(3, growth ? growth.fullLogs : ecs.good[id].amount));
  const kind = treeKind(look, id);
  const mesh = new THREE.Mesh(treeGeometry(kind, amount, look.biome, look.morality), vertexColoured);
  // NOTE: sink the trunk a little so it never floats on a slope
  mesh.position.set(x, ground.heightAt(x, y) - 2, y);
  mesh.rotation.y = (+id * 2.399) % (Math.PI * 2);
  const scale = growth && growth.stage == "sapling" ? 0.25 : growth && growth.stage == "young" ? 0.55 : 1;
  mesh.scale.setScalar(scale);
  mesh.userData.anchorHeight = TREE_SHAPES[kind].height * treeSize(amount) * scale;
  return mesh;
}

// --- Wild food ---------------------------------------------------------------

const forageGeometries = new Map();
export function foragePlant(ground, state, id) {
  const plant = state.ecs.forageable[id];
  const ripe = forageAvailable(state, plant);
  const key = plant.kind + ":" + ripe;
  if (!forageGeometries.has(key)) {
    const parts = [
      { geometry: new THREE.CylinderGeometry(0.7, 1.1, 9, 4), colour: COLOURS.trunk, matrix: at(0, 4, 0) },
      { geometry: new THREE.CylinderGeometry(0.5, 0.8, 8, 4), colour: COLOURS.trunk, matrix: at(-3, 5, 0, 0, 0, -0.6) },
      { geometry: new THREE.CylinderGeometry(0.5, 0.8, 8, 4), colour: COLOURS.trunk, matrix: at(3, 5, 1, 0, 0, 0.6) }
    ];
    if (ripe) {
      const leaf = plant.kind == "berries" ? 0x4F793D : 0x7C934A;
      for (const [x, y, z] of [[0, 10, 0], [-5, 8, 0], [5, 8, 2]]) {
        parts.push({ geometry: new THREE.IcosahedronGeometry(6, 0), colour: leaf, matrix: at(x, y, z, 0, 0.5, 0, 1, 0.7, 1) });
      }
      for (let k = 0; k < 6; k++) {
        const angle = k * Math.PI / 3;
        parts.push({ geometry: new THREE.IcosahedronGeometry(1.6, 0), colour: plant.kind == "berries" ? 0xC45C77 : 0xC4A16D,
          matrix: at(Math.cos(angle) * 5, plant.kind == "berries" ? 11 : 2, Math.sin(angle) * 5) });
      }
    }
    forageGeometries.set(key, shared(mergeColoured(parts)));
  }
  const mesh = new THREE.Mesh(forageGeometries.get(key), vertexColoured);
  const { x, y } = state.ecs.spatial[id];
  mesh.position.set(x, ground.heightAt(x, y), y);
  mesh.rotation.y = (+id * 2.399) % (Math.PI * 2);
  mesh.userData.anchorHeight = 14;
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
  const standing = new THREE.Mesh(personGeometry(size, e.personable.body, HAIR[e.personable.hair]), vertexColoured);
  standing.name = "standing-figure";
  figure.add(standing);
  if (state.intro && e.id == state.ui.playerId) {
    figure.rotation.y = state.intro.facing || 0;
    const bundle = arrivalBundle();
    bundle.visible = false;
    bundle.position.set(size * 0.4, size * 0.8, 0);
    figure.add(bundle);
  }
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

  const activity = e.planner ? currentActivity(state.ecs, e.id, t) : null;
  if (activity) {
    const text = label(activity);
    text.position.y = height + 14;
    group.add(text);
  }

  if (selected) {
    group.add(selectionMarker(height + (activity ? 32 : 16)));
  }

  group.userData.anchorHeight = height;
  return group;
}

// The same stick and tied cloth are carried in and left at the camp.
export function arrivalBundle() {
  const group = new THREE.Group();
  group.name = "arrival-bundle";
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 48, 5), lambert(0x735039));
  stick.name = "bundle-stick";
  stick.rotation.x = Math.PI / 2 + 0.26;
  stick.position.y = 8;
  group.add(stick);
  const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(8, 0), lambert(0x6E8FA1));
  bag.name = "cloth-bundle";
  bag.scale.set(1, 0.9, 0.85);
  bag.position.set(0, 7, -23);
  group.add(bag);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 5), lambert(0xB8A77D));
  knot.position.set(0, 14, -23);
  group.add(knot);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.7, 3, 6), lambert(0xD6C59B));
  tie.rotation.x = Math.PI / 2;
  tie.position.set(0, 13, -23);
  group.add(tie);
  return group;
}

export function poseArrivalPerson(object, intro, size, { ground, camp } = {}) {
  const figure = object.getObjectByName("figure");
  const bundle = object.getObjectByName("arrival-bundle");
  if (!bundle) return;
  const walking = intro.pose == "walking";
  figure.position.y = walking ? Math.abs(Math.sin(intro.elapsed * 9)) * size * 0.025 : 0;
  figure.rotation.z = walking ? Math.sin(intro.elapsed * 9) * 0.025 : 0;
  figure.rotation.x = intro.pose == "putting-down" ? Math.sin((intro.putDown || 0) * Math.PI) * 0.25 : 0;
  if (intro.pose != "standing") figure.rotation.y = intro.facing || 0;
  bundle.visible = (intro.putDown || 0) < 1 && intro.pose != "standing";
  bundle.position.set(size * 0.4, size * 0.8, 0);
  bundle.rotation.set(0, 0, 0);
  if (intro.pose == "putting-down" && ground) {
    object.updateMatrixWorld(true);
    const x = camp.x + CAMP_LAYOUT.bundle.x;
    const z = camp.y + CAMP_LAYOUT.bundle.y;
    const target = figure.worldToLocal(new THREE.Vector3(x, ground.heightAt(x, z), z));
    bundle.position.lerp(target, intro.putDown);
    // Swing the long stick out around the shoulder before turning it down.
    bundle.position.x += Math.sin(intro.putDown * Math.PI) * size * 2;
    bundle.quaternion.copy(figure.getWorldQuaternion(new THREE.Quaternion()).invert()).slerp(new THREE.Quaternion(), 1 - intro.putDown);
  }
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
  const soil = [{ geometry: drapedHex(ground, centre, 0.9, 0.9), colour: COLOURS.field }];

  state.ecs.farmable[id].slots.forEach((slot, idx) => {
    const p = { x: centre.x + TRIANGLES[idx].x, y: centre.y + TRIANGLES[idx].y };
    if (["harvested", "harvestable", "ploughed", "sown"].includes(slot.state)) {
      soil.push({ geometry: drapedQuad(ground, [
        { x: p.x - 14, y: p.y - 5.5 },
        { x: p.x + 14, y: p.y - 5.5 },
        { x: p.x + 14, y: p.y + 5.5 },
        { x: p.x - 14, y: p.y + 5.5 },
      ], 1.2, 3, 1), colour: COLOURS.dirt });
    }
    if (["harvested"].includes(slot.state)) {
      const stubble = new THREE.Mesh(stubbleGeometry(), lambert(0x2A211C));
      stubble.position.copy(toWorld(ground, p, 0.6));
      group.add(stubble);
    } else if (["harvestable", "sown"].includes(slot.state)) {
      const radius = Math.min(6,
        Math.max(2,
          (slot.growth ?? state.days - slot.updated) * 6 / crops[slot.content].growingTime));
      const crop = new THREE.Mesh(cropGeometry(), lambert(parseInt(crops[slot.content].colour, 16)));
      crop.scale.set(radius, slot.state == "harvestable" ? radius * 2.2 : radius * 1.6, radius);
      crop.position.copy(toWorld(ground, p, 0));
      group.add(crop);
    }
  });

  group.add(new THREE.Mesh(mergeColoured(soil), vertexColoured));

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

// --- Arrival camp and timber shelters ----------------------------------------
export function camp(ground, state, id) {
  return campPieces(ground, state.ecs.spatial[id], state.ecs.camp?.[id]?.bundle);
}

export function campSetup(ground, point) {
  const object = campPieces(ground, point, CAMP_LAYOUT.bundle);
  poseCampSetup(object, { putDown: 0, fire: 0, bedroll: 0 });
  return object;
}

export function poseCampSetup(object, intro) {
  object.getObjectByName("arrival-bundle").visible = intro.putDown == 1;
  for (const [name, scale] of [["campfire", intro.fire], ["bedroll", intro.bedroll]]) {
    const piece = object.getObjectByName(name);
    piece.visible = scale > 0;
    piece.scale.setScalar(scale);
  }
}

function campPieces(ground, { x, y }, bundlePoint) {
  const group = new THREE.Group();
  group.position.set(x, ground.heightAt(x, y), y);
  const fire = new THREE.Group();
  fire.name = "campfire";
  fire.position.set(CAMP_LAYOUT.fire.x, 0, CAMP_LAYOUT.fire.y);
  for (let k = 0; k < 8; k++) {
    const angle = k * Math.PI / 4;
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5, 0), lambert(0x78736B));
    stone.position.set(Math.cos(angle) * 12, 2, Math.sin(angle) * 12);
    fire.add(stone);
  }
  for (const angle of [-0.6, 0.6]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 20, 5), lambert(COLOURS.trunk));
    log.rotation.set(Math.PI / 2, 0, angle);
    log.position.y = 4;
    fire.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(6, 18, 5), new THREE.MeshBasicMaterial({ color: 0xF4A338 }));
  flame.position.y = 13;
  fire.add(flame);
  const heart = new THREE.Mesh(new THREE.ConeGeometry(3, 12, 5), new THREE.MeshBasicMaterial({ color: 0xFFE190 }));
  heart.position.set(1, 11, 3);
  fire.add(heart);
  group.add(fire);
  const bed = new THREE.Group();
  bed.name = "bedroll";
  bed.position.set(0, 0, 0);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 27), lambert(0x6B8069));
  blanket.position.y = 2;
  bed.add(blanket);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 14, 7), lambert(0xAF9B79));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 4, -12);
  bed.add(roll);
  group.add(bed);
  if (bundlePoint) {
    const p = bundlePoint;
    const bundle = arrivalBundle();
    bundle.position.set(p.x, ground.heightAt(x + p.x, y + p.y) - ground.heightAt(x, y), p.y);
    group.add(bundle);
  }
  group.userData.anchorHeight = 23;
  return group;
}

export function shelter(ground, state, id) {
  const ecs = state.ecs;
  const { x, y } = ecs.spatial[id];
  const site = ecs.construction[id];
  const stage = ecs.shelter[id].stage;
  const group = new THREE.Group();
  group.position.set(x, ground.heightAt(x, y), y);
  const add = (geometry, colour, matrix) => {
    const mesh = new THREE.Mesh(geometry, lambert(colour));
    mesh.applyMatrix4(matrix);
    group.add(mesh);
    return mesh;
  };
  if (stage == "house") {
    const houseModel = house(ground, x, y, 1, { playerOwned: true, selected: false });
    houseModel.position.set(0, -ground.heightAt(x, y), 0);
    group.add(houseModel);
  } else if (stage == "hut") {
    add(new THREE.BoxGeometry(54, 27, 44), 0x8F7150, at(0, 13.5, 0));
    add(squarePyramid(), 0xA89159, at(0, 38, 0, 0, 0, 0, 66, 23, 54));
    add(new THREE.BoxGeometry(13, 20, 2), COLOURS.door, at(0, 10, 23));
  } else if (stage == "lean-to") {
    for (const px of [-24, 24]) {
      add(new THREE.CylinderGeometry(2, 2.5, 29, 5), COLOURS.trunk, at(px, 14.5, -10));
    }
    add(new THREE.BoxGeometry(56, 4, 39), 0xAC9560, at(0, 17, 2, 0.65));
    add(new THREE.BoxGeometry(40, 3, 28), 0x6B8069, at(0, 2, 2));
  }
  if (site) {
    for (const [px, pz] of [[-30, -25], [30, -25], [-30, 25], [30, 25]]) {
      add(new THREE.CylinderGeometry(1.5, 2, 20, 4), 0xC4AB76, at(px, 10, pz));
    }
    for (let k = 0; k < site.delivered; k++) {
      const log = add(new THREE.CylinderGeometry(2.8, 3.3, 27, 6), 0x89643E,
        at(-27 + k % 5 * 6, 4 + Math.floor(k / 5) * 6, 29, Math.PI / 2));
      log.name = "delivered-log";
    }
  }
  group.userData.anchorHeight = stage == "house" ? 65 : stage == "hut" ? 50 : 30;
  return group;
}
