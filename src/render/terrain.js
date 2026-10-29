import * as THREE from "three";

import { Hex } from "game/map";
import { COLOURS } from "render/colours";

const VERTICES_PER_HEX = 18;
// NOTE: corners a little darker than centres, so each hex reads as a hex
const CORNER_SHADE = 0.86;

// NOTE: The whole map as one mesh: each hex is a fan of six triangles from
// its centre to its corners, with its own vertices so it is flat shaded and
// coloured by terrain. Hexes the player does not know yet are left out of the
// index, so they are neither drawn nor picked.
export function createTerrain(state, ground) {
  const tiles = Object.keys(state.ecs.mappable);
  const indexOf = {};
  const positions = new Float32Array(tiles.length * VERTICES_PER_HEX * 3);
  const colours = new Float32Array(tiles.length * VERTICES_PER_HEX * 3);
  const offsets = Hex().corners();
  const colour = new THREE.Color();
  const shade = new THREE.Color();

  tiles.forEach((id, i) => {
    indexOf[id] = i;
    const centre = state.ecs.spatial[id];
    const { centre: middle, corners } = ground.hex(centre);
    const points = offsets.map((c, k) => [centre.x + c.x, corners[k], centre.y + c.y]);
    colour.setHex(COLOURS[state.ecs.mappable[id].terrain]);
    shade.copy(colour).multiplyScalar(CORNER_SHADE);

    for (let k = 0; k < 6; k++) {
      const a = points[k];
      const b = points[(k + 1) % 6];
      const base = (i * VERTICES_PER_HEX + k * 3) * 3;
      positions.set([centre.x, middle, centre.y, ...b, ...a], base);
      colours.set([colour.r, colour.g, colour.b, shade.r, shade.g, shade.b, shade.r, shade.g, shade.b], base);
    }
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
  const shown = new Set();
  let dirty = true;

  const applyIndex = () => {
    let n = 0;
    for (const id of shown) {
      const first = indexOf[id] * VERTICES_PER_HEX;
      for (let v = 0; v < VERTICES_PER_HEX; v++) {
        index.array[n++] = first + v;
      }
    }
    index.needsUpdate = true;
    geometry.setDrawRange(0, n);
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
    }
  };
}
