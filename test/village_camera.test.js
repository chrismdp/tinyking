jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { createWorldView } from "render/world_view";
import { Hex } from "game/hex";

it("can frame a village at the default pitch and distance for reproducible desktop and phone inspection", () => {
  global.window = { addEventListener() {}, removeEventListener() {} };
  const centre = Hex(22, 22), p = centre.toPoint();
  const state = { ecs: { spatial: {}, mappable: {}, interior: {}, building: {}, good: {}, personable: {}, playable: { player: { known: [] } } },
    map: { seed: 1, radius: 22, centre, playerStartTile: centre }, space: {}, days: 0.375, ui: { playerId: "player" }, redraws: [],
    world: { home: { x: 0, y: 0 }, hexes: [{ x: 0, y: 0, biome: "grassland", temperature: "temperate", moisture: "normal", morality: "neutral" }] } };
  const domElement = { clientWidth: 1440, clientHeight: 900, style: {}, addEventListener() {}, removeEventListener() {} };
  const view = createWorldView({ domElement, render() {}, setSize() {} }, state, { t: x => x, onSelect() {} });
  try {
    for (const [width, height] of [[1440, 900], [390, 664]]) {
      view.resize(width, height);
      view.focusOn(p, 1000);
      view.frame();
      const target = new THREE.Vector3(p.x, view.ground.heightAt(p.x, p.y), p.y);
      expect(view.camera.position.distanceTo(target)).toBeCloseTo(1000);
      expect((view.camera.position.y - target.y) / 1000).toBeCloseTo(Math.sin(0.8));
      expect(target.project(view.camera).x).toBeCloseTo(0);
    }
  } finally { view.dispose(); delete global.window; }
});
