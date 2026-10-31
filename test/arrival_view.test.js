jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { camp, shelter, FLAT_GROUND } from "render/models";
import { canPlaceShelter, placeShelter } from "game/construction";
import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";

it("draws a fire and bedroll, distinct shelter stages, and the delivered logs at a site", () => {
  const state = { ecs: { spatial: { c: { x: 0, y: 0 }, s: { x: 100, y: 0 } }, shelter: { s: { stage: null } }, construction: {} } };
  const start = camp(FLAT_GROUND, state, "c");
  expect(start.getObjectByName("campfire")).toBeDefined();
  expect(start.getObjectByName("bedroll")).toBeDefined();
  expect(start.getObjectByName("bedroll").position.length()).toBe(0);
  expect(start.getObjectByName("campfire").position.length()).toBeGreaterThan(20);
  state.ecs.construction.s = { stage: "lean-to", delivered: 3, work: 0 };
  const site = shelter(FLAT_GROUND, state, "s");
  expect(site.children.filter(child => child.name == "delivered-log")).toHaveLength(3);
  delete state.ecs.construction.s;
  const heights = ["lean-to", "hut", "house"].map(stage => {
    state.ecs.shelter.s.stage = stage;
    return new THREE.Box3().setFromObject(shelter(FLAT_GROUND, state, "s")).getSize(new THREE.Vector3()).y;
  });
  expect(heights[0]).toBeLessThan(heights[1]);
  expect(heights[1]).toBeLessThan(heights[2]);
});

it("offers only one nearby site, rejects occupied tiles and upgrades only the player's shelter", () => {
  const { state, tiles, villager } = rowOfTiles(6);
  state.ui.playerId = villager;
  state.ecs.building = {};
  newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true }, camp: {}, controllable: { controllerId: villager } }]);
  expect(canPlaceShelter(state, tiles[5])).toBe(false);
  const site = placeShelter(state, tiles[1]);
  expect(site).toBeTruthy();
  expect(placeShelter(state, tiles[2])).toBeNull();
  expect(placeShelter(state, site)).toBeNull();
});

it("does not place a site on nearby land disconnected from the camp", () => {
  const { state, tiles, villager } = rowOfTiles(3);
  state.ui.playerId = villager;
  state.ecs.building = {};
  newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true }, camp: {}, controllable: { controllerId: villager } }]);
  for (const id of tiles) state.ecs.walkable[id].neighbours = {};
  expect(canPlaceShelter(state, tiles[1])).toBe(false);
});
