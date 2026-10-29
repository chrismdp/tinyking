// NOTE: Three is ESM; use Node's native require(esm) outside Jest's CJS loader.
jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));

import * as THREE from "three";
import { Hex, Grid } from "game/hex";
import { createWorldView } from "render/world_view";

const fixture = () => {
  const centre = Hex(22, 22);
  const grid = Grid.hexagon({ center: centre, radius: 22 });
  const state = {
    ecs: { spatial: {}, mappable: {}, playable: { player: { known: [] } }, personable: {}, interior: {}, good: {}, building: {} },
    map: { seed: 13, radius: 22, centre, playerStartTile: centre },
    world: { home: { x: 0, y: 0 }, hexes: [{ x: 0, y: 0, biome: "grassland", temperature: "temperate", moisture: "normal", morality: "neutral" }] },
    ui: { playerId: "player" }, redraws: [], space: {}, days: 0.375
  };
  grid.forEach((h, i) => {
    const id = String(i + 1);
    state.ecs.spatial[id] = h.toPoint();
    state.ecs.mappable[id] = { terrain: "grassland" };
    state.space[h] = [id];
  });
  const domElement = {
    clientWidth: 1280, clientHeight: 800, style: {},
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 })
  };
  const renderer = { domElement, render: jest.fn(), setSize() {} };
  return { state, renderer, grid };
};

beforeEach(() => { global.window = { addEventListener() {}, removeEventListener() {} }; });
afterEach(() => { delete global.window; });

it("fits the larger map and its edge wall in the whole-map view, including portrait windows", () => {
  const { state, renderer, grid } = fixture();
  const view = createWorldView(renderer, state, { t: x => x, onSelect() {} });
  for (const [width, height] of [[1280, 800], [640, 960]]) {
    renderer.domElement.clientWidth = width;
    renderer.domElement.clientHeight = height;
    view.resize(width, height);
    view.showWholeMap();
    view.frame();
    for (const h of grid.filter(h => Hex(state.map.centre).distance(h) == 22)) {
      const centre = h.toPoint();
      for (const c of Hex().corners()) for (const elevation of [-45, 150]) {
        const p = new THREE.Vector3(centre.x + c.x, elevation, centre.y + c.y).project(view.camera);
        expect(Math.abs(p.x)).toBeLessThan(1);
        expect(Math.abs(p.y)).toBeLessThan(1);
        expect(p.z).toBeLessThan(1);
      }
    }
  }
  view.dispose();
});
