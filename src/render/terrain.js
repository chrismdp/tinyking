import * as THREE from "three";

import { Hex } from "game/map";
import { createGroundColours } from "render/biomes";

const VERTICES_PER_HEX = 18;
// NOTE: corners a little darker than centres, so each hex reads as a hex
const CORNER_SHADE = 0.86;

// NOTE: The map's edge drops away in a wall this deep, so from the side the
// world hex stands as a solid board rather than a sheet.
const SKIRT_DEPTH = -45;
const SKIRT_TOP_SHADE = 0.55;
const SKIRT_BOTTOM = new THREE.Color(0x15110E);

// NOTE: The whole map as one mesh: each hex is a fan of six triangles from
// its centre to its corners, with its own vertices so it is flat shaded and
// coloured by its terrain and biome. Hexes the player does not know yet are
// left out of the index, so they are neither drawn nor picked.
export function createTerrain(state, ground) {
  const tiles = Object.keys(state.ecs.mappable);
  const indexOf = {};
  const positions = new Float32Array(tiles.length * VERTICES_PER_HEX * 3);
  const colours = new Float32Array(tiles.length * VERTICES_PER_HEX * 3);
  const offsets = Hex().corners();
  const groundColour = createGroundColours(state);
  const colour = new THREE.Color();
  const shade = new THREE.Color();

  // NOTE: the wall under each edge with no tile beyond it, as two triangles
  const skirtPositions = [];
  const skirtColours = [];
  const skirtOf = {};
  const hasTile = point => (state.space[Hex().fromPoint(point).toString()] || []).some(e => state.ecs.mappable[e]);

  tiles.forEach((id, i) => {
    indexOf[id] = i;
    const centre = state.ecs.spatial[id];
    const { centre: middle, corners } = ground.hex(centre);
    const points = offsets.map((c, k) => [centre.x + c.x, corners[k], centre.y + c.y]);
    groundColour(id, colour);
    shade.copy(colour).multiplyScalar(CORNER_SHADE);

    for (let k = 0; k < 6; k++) {
      const a = points[k];
      const b = points[(k + 1) % 6];
      const base = (i * VERTICES_PER_HEX + k * 3) * 3;
      positions.set([centre.x, middle, centre.y, ...b, ...a], base);
      colours.set([colour.r, colour.g, colour.b, shade.r, shade.g, shade.b, shade.r, shade.g, shade.b], base);
    }

    const first = skirtPositions.length / 3;
    const top = colour.clone().multiplyScalar(SKIRT_TOP_SHADE);
    for (let k = 0; k < 6; k++) {
      const c = offsets[k];
      const d = offsets[(k + 1) % 6];
      if (!hasTile({ x: centre.x + c.x + d.x, y: centre.y + c.y + d.y })) {
        const a = points[k];
        const b = points[(k + 1) % 6];
        const a0 = [a[0], SKIRT_DEPTH, a[2]];
        const b0 = [b[0], SKIRT_DEPTH, b[2]];
        skirtPositions.push(...a, ...b, ...b0, ...a, ...b0, ...a0);
        [top, top, SKIRT_BOTTOM, top, SKIRT_BOTTOM, SKIRT_BOTTOM].forEach(v => skirtColours.push(v.r, v.g, v.b));
      }
    }
    skirtOf[id] = { first, count: skirtPositions.length / 3 - first };
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  const vertexCount = tiles.length * VERTICES_PER_HEX;
  const index = new THREE.BufferAttribute(
    vertexCount > 65535 ? new Uint32Array(vertexCount) : new Uint16Array(vertexCount), 1);
  geometry.setIndex(index);
  geometry.setDrawRange(0, 0);

  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));

  const skirtGeometry = new THREE.BufferGeometry();
  skirtGeometry.setAttribute("position", new THREE.Float32BufferAttribute(skirtPositions, 3));
  skirtGeometry.setAttribute("color", new THREE.Float32BufferAttribute(skirtColours, 3));
  skirtGeometry.computeVertexNormals();
  skirtGeometry.computeBoundingSphere();
  const skirtCount = skirtPositions.length / 3;
  const skirtIndex = new THREE.BufferAttribute(
    skirtCount > 65535 ? new Uint32Array(skirtCount) : new Uint16Array(Math.max(1, skirtCount)), 1);
  skirtGeometry.setIndex(skirtIndex);
  skirtGeometry.setDrawRange(0, 0);
  // NOTE: a child of the ground, so it comes and goes with it; picking
  // skips it, as it belongs to no entity
  const skirt = new THREE.Mesh(skirtGeometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.add(skirt);

  const shown = new Set();
  let dirty = true;

  const applyIndex = () => {
    let n = 0;
    let m = 0;
    for (const id of shown) {
      const first = indexOf[id] * VERTICES_PER_HEX;
      for (let v = 0; v < VERTICES_PER_HEX; v++) {
        index.array[n++] = first + v;
      }
      const { first: from, count } = skirtOf[id];
      for (let v = 0; v < count; v++) {
        skirtIndex.array[m++] = from + v;
      }
    }
    index.needsUpdate = true;
    geometry.setDrawRange(0, n);
    skirtIndex.needsUpdate = true;
    skirtGeometry.setDrawRange(0, m);
    dirty = false;
  };

  return {
    mesh,
    show(id, visible) {
      if (!(id in indexOf) || shown.has(id) == visible) {
        return;
      }
      if (visible) {
        shown.add(id);
      } else {
        shown.delete(id);
      }
      dirty = true;
    },
    update() {
      if (dirty) {
        applyIndex();
      }
    },
    tileAtVertex: vertex => tiles[Math.floor(vertex / VERTICES_PER_HEX)],
    dispose() {
      geometry.dispose();
      mesh.material.dispose();
      skirtGeometry.dispose();
      skirt.material.dispose();
    }
  };
}
