import { fenceFootprints, fenceSegments } from "game/fences";
import * as THREE from "three";
import { at, mergeColoured } from "render/models";

const TIMBER = 0x70503A, PALE = 0xD5BD8D, THATCH = 0x9A7844, STONE = 0x999387, DARK = 0x38322C;
const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
material.userData.shared = true;
const geometryCache = new Map();
const smokeGeometry = new THREE.IcosahedronGeometry(1, 0);
smokeGeometry.userData.shared = true;
const smokeMaterial = new THREE.MeshLambertMaterial({ color: 0xB5AD9B, flatShading: true, transparent: true, opacity: 0.42, depthWrite: false });
smokeMaterial.userData.shared = true;
const part = (geometry, colour, matrix) => ({ geometry, colour, matrix });
const box = (x, y, z, w, h, d, colour, ry = 0) => part(new THREE.BoxGeometry(w, h, d), colour, at(x, y, z, 0, ry));
const cone = (x, y, z, r, h, colour, n = 4) => part(new THREE.ConeGeometry(r, h, n), colour, at(x, y, z, 0, Math.PI / 4));
const cylinder = (x, y, z, r, h, colour, n = 6) => part(new THREE.CylinderGeometry(r, r, h, n), colour, at(x, y, z));
const roof = (parts, w = 30, d = 26, y = 26) => {
  parts.push(box(0, y / 2, 0, w, y, d, PALE));
  parts.push(cone(0, y + 7, 0, w * 0.82, 18, THATCH));
  parts.push(box(0, 7, d / 2 + 0.2, 7, 14, 1, DARK));
};
const bench = parts => {
  parts.push(box(0, 10, 0, 22, 4, 12, TIMBER));
  for (const x of [-8, 8]) for (const z of [-4, 4]) parts.push(box(x, 5, z, 3, 10, 3, TIMBER));
};
const fence = (parts, footprint) => {
  const f = { ...footprint, x: 0, y: 0 };
  const posts = new Map();
  for (const [a,b] of fenceSegments(f)) {
    for (const p of [a,b]) posts.set(p.x + "," + p.y,p);
    for (const y of [4,9]) parts.push(box((a.x+b.x)/2,y,(a.y+b.y)/2,Math.max(1.5,Math.abs(a.x-b.x)),2,Math.max(1.5,Math.abs(a.y-b.y)),THATCH));
  }
  for (const p of posts.values()) parts.push(box(p.x,6,p.y,2,12,2,TIMBER));
  // Fold the open leaf against a shared solid side, clear of the gate route.
  const g=f.gateHalfWidth;
  parts.push(box((g+f.halfWidth)/2,6,f.halfDepth,f.halfWidth-g,2,1.5,PALE));
};
const animalParts = kind => {
  const chicken = kind == "chicken", cow = kind == "cow";
  const colour = { chicken: 0xE6D9BD, pig: 0xC88C7C, goat: 0xA89370, sheep: 0xDFD9BB, cow: 0x8C5B3E }[kind];
  const w = chicken ? 4 : cow ? 9 : 6, h = chicken ? 4 : cow ? 9 : 7, length = chicken ? 5 : cow ? 15 : 10;
  const parts = [box(0, h, 0, w, h * 0.8, length, colour), box(0, h + 1, length * 0.55, w * 0.6, h * 0.65, w * 0.65, kind == "sheep" ? DARK : colour)];
  for (const x of [-w * 0.32, w * 0.32]) for (const z of [-length * 0.3, length * 0.3]) parts.push(box(x, h * 0.28, z, chicken ? 0.6 : 1.5, h * 0.6, 1.4, DARK));
  if (chicken) parts.push(box(0, h + 3, length * 0.6, 1, 2, 2, 0xBE4C32));
  if (kind == "goat" || cow) for (const x of [-w * 0.3, w * 0.3]) parts.push(cone(x, h * 1.65, length * 0.5, 1, 4, PALE));
  return parts;
};

function geometry(kind) {
  if (!geometryCache.has(kind)) {
    const parts = [];
    if (kind == "fence-piece") parts.push(box(0, 0, 0, 1, 1, 1, TIMBER));
    else if (kind.startsWith("animal:")) parts.push(...animalParts(kind.slice(7)));
    else if (kind == "vegetable") {
      parts.push(box(0, 0.8, 0, 31, 1.5, 24, 0x715135));
      for (const x of [-11, 0, 11]) for (const z of [-8, 0, 8]) parts.push(cone(x, 3, z, 3, 5, 0x548345, 5));
    } else if (["chicken", "pig", "goat"].includes(kind)) {
      if (kind == "chicken") { parts.push(box(-9, 7, -7, 10, 10, 9, PALE), cone(-9, 15, -7, 9, 8, THATCH)); }
      else { parts.push(box(-11, 4, -8, 10, 8, 9, TIMBER), box(-11, 9, -8, 14, 2, 12, THATCH)); }
    } else if (kind == "beehives") {
      for (const x of [-9, 8]) { parts.push(cylinder(x, 3, 0, 7, 5, TIMBER), cone(x, 10, 0, 7, 13, 0xC5A65C, 7)); }
    } else if (kind == "smith") {
      parts.push(box(-7, 9, -6, 20, 18, 16, STONE), box(-7, 10, 2.5, 12, 9, 1.2, DARK), box(-7, 8, 3.5, 8, 3, 2, 0xEB8A35));
      parts.push(box(-9, 26, -9, 8, 24, 8, STONE), box(9, 7, 7, 6, 14, 6, TIMBER), box(9, 16, 7, 13, 5, 8, DARK));
      parts.push(box(13, 20, 7, 7, 3, 4, DARK), box(16, 15, 8, 2, 8, 2, TIMBER));
    } else if (kind == "carpenter") {
      bench(parts);
      for (let i = 0; i < 4; i++) parts.push(box(-10 + i * 6, 3, -17, 5, 6, 26, THATCH, Math.PI / 2));
      parts.push(box(0, 14, 0, 26, 2, 7, PALE));
    } else if (kind == "weaver") {
      for (const x of [-11, 11]) parts.push(box(x, 15, 0, 3, 30, 4, TIMBER));
      for (const y of [7, 29]) parts.push(box(0, y, 0, 25, 3, 4, TIMBER));
      parts.push(box(0, 18, 0, 18, 18, 1, 0xBA795D));
      for (let x = -8; x <= 8; x += 4) parts.push(box(x, 18, 1, 0.7, 19, 0.5, PALE));
    } else if (kind == "baker") {
      parts.push(box(0, 6, 0, 28, 12, 24, STONE), cone(0, 20, 0, 18, 20, 0xB87851, 8), box(0, 11, 12, 11, 9, 2, DARK));
      parts.push(box(-9, 30, -8, 7, 22, 7, 0xB87851));
    } else if (kind == "tanner") {
      for (const z of [-8, 9]) { for (const x of [-13, 13]) parts.push(box(x, 14, z, 2, 28, 2, TIMBER)); parts.push(box(0, 27, z, 28, 2, 2, TIMBER), box(0, 17, z, 20, 16, 1, 0xB27C50)); }
    } else if (kind == "miller") {
      parts.push(cylinder(0, 24, 0, 13, 48, PALE), cone(0, 55, 0, 19, 18, THATCH));
      for (const r of [Math.PI / 4, -Math.PI / 4]) parts.push(part(new THREE.BoxGeometry(54, 6, 2), PALE, at(0, 39, 14, 0, 0, r)));
    } else if (kind == "well") {
      parts.push(cylinder(0, 5, 0, 10, 10, STONE), cylinder(0, 10.2, 0, 6, 1, 0x3D6170));
      for (const x of [-11, 11]) parts.push(box(x, 16, 0, 2, 32, 3, TIMBER));
      parts.push(cone(0, 34, 0, 18, 12, THATCH));
    } else if (kind == "green") {
      parts.push(cylinder(0, 0.3, 0, 40, 0.6, 0x829558, 12));
      for (const z of [-30, 30]) { parts.push(box(0, 4, z, 27, 3, 6, TIMBER)); for (const x of [-10, 10]) parts.push(box(x, 2, z, 3, 4, 5, TIMBER)); }
    } else if (kind == "chapel") {
      roof(parts, 30, 38, 28);
      parts.push(box(-9, 27, -9, 11, 50, 11, STONE), cone(-9, 57, -9, 10, 17, 0x74675A), box(-9, 70, -9, 2, 12, 2, TIMBER), box(-9, 72, -9, 9, 2, 2, TIMBER));
    } else if (kind == "alehouse") {
      roof(parts, 40, 33, 25);
      parts.push(box(20, 25, 17, 2, 19, 2, TIMBER), box(24, 30, 17, 10, 8, 2, 0xC49B4B));
      for (const x of [-20, 20]) parts.push(cylinder(x, 5, 27, 6, 10, TIMBER));
    }
    const g = mergeColoured(parts);
    g.userData.shared = true;
    geometryCache.set(kind, g);
  }
  return geometryCache.get(kind);
}

export function villageModel(ground, state, id) {
  const ecs = state.ecs, p = ecs.spatial[id];
  const kind = ecs.animal?.[id] ? "animal:" + ecs.animal[id].kind : ecs.workplace?.[id]?.trade || ecs.backyard?.[id]?.kind || ecs.meetingPlace?.[id]?.kind || "pasture";
  const group = new THREE.Group();
  group.position.set(p.x, ground.heightAt(p.x, p.y), p.y);
  group.add(new THREE.Mesh(geometry(kind), material));
  if (ecs.workplace?.[id]) group.children[0].position.z = -15;
  const enclosure = fenceModel(ground,state,id);
  if (enclosure) { enclosure.position.sub(group.position); group.add(enclosure); }
  if (["smith", "baker"].includes(kind)) {
    const smoke = new THREE.Group(); smoke.name = "smoke";
    smoke.position.set(-9, kind == "smith" ? 39 : 42, -24);
    for (let i = 0; i < 3; i++) smoke.add(new THREE.Mesh(smokeGeometry, smokeMaterial));
    smoke.visible = false;
    group.add(smoke);
  }
  return group;
}

export function fenceModel(ground, state, id) {
  const p = state.ecs.spatial[id];
  const group = new THREE.Group();
  group.name = "fence";
  group.position.set(p.x,ground.heightAt(p.x,p.y),p.y);
  const pen = fenceFootprints(state).find(f => f.id == id);
  if (pen) {
    const pieces = []; fence(pieces, pen);
    for (const piece of pieces) {
      const { width, height, depth } = piece.geometry.parameters;
      const x = piece.matrix.elements[12], z = piece.matrix.elements[14];
      const beam = new THREE.Mesh(geometry("fence-piece"), material);
      beam.position.set(x, piece.matrix.elements[13] + ground.heightAt(p.x + x, p.y + z) - group.position.y, z);
      beam.scale.set(width, height, depth);
      if (width > height) beam.rotation.z = Math.atan2(ground.heightAt(p.x + x + width / 2, p.y + z) - ground.heightAt(p.x + x - width / 2, p.y + z), width);
      if (depth > height) beam.rotation.x = -Math.atan2(ground.heightAt(p.x + x, p.y + z + depth / 2) - ground.heightAt(p.x + x, p.y + z - depth / 2), depth);
      group.add(beam);
      piece.geometry.dispose();
    }
  }
  return pen ? group : null;
}

export function animateWorkplace(state, id, model, seconds) {
  const smoke = model.getObjectByName("smoke");
  if (!smoke) return;
  const person = Object.keys(state.ecs.profession || {}).find(p => state.ecs.profession[p].workplaceId == id);
  smoke.visible = state.ecs.planner[person]?.task?.[0] == "trade_work";
  for (const [i, puff] of smoke.children.entries()) {
    const phase = (seconds * 0.28 + i / 3) % 1;
    puff.position.set(phase * 7, phase * 27, Math.sin(seconds + i) * 2);
    puff.scale.setScalar(3 + phase * 4);
  }
}
