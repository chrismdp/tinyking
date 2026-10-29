jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));

import * as THREE from "three";
import { tree, foragePlant, person, FLAT_GROUND } from "render/models";
import { createForest } from "render/forest";
import Engine from "json-rules-engine-simplified";
import rules from "data/jobs.json";

it("draws saplings and young trees smaller while sharing mature geometry and instances", () => {
  const ecs = { spatial: {}, good: {}, tree: {} };
  const forest = createForest();
  const heights = [];
  ["sapling", "young", "mature"].forEach((stage, i) => {
    const id = String(i);
    ecs.spatial[id] = { x: i * 40, y: 0 };
    ecs.good[id] = { type: "wood", amount: i };
    ecs.tree[id] = { stage, fullLogs: 3 };
    const model = tree(FLAT_GROUND, ecs, id, { biome: "jungle", morality: "neutral" });
    heights.push(new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y);
    forest.add(id, model);
  });
  expect(heights[0]).toBeLessThan(heights[1] * 0.7);
  expect(heights[1]).toBeLessThan(heights[2] * 0.7);
  forest.update();
  expect(forest.mesh.children).toHaveLength(1);
  expect(forest.mesh.children[0].count).toBe(3);
  forest.dispose();
});

it("draws picked bushes bare, reuses plant geometry, and instances bushes", () => {
  const state = { days: 1, ecs: {
    spatial: { 1: { x: 0, y: 0 }, 2: { x: 40, y: 0 } },
    forageable: { 1: { kind: "berries", amount: 1 }, 2: { kind: "berries", amount: 1 } }
  } };
  const a = foragePlant(FLAT_GROUND, state, "1");
  const b = foragePlant(FLAT_GROUND, state, "2");
  expect(a.geometry).toBe(b.geometry);
  const forest = createForest();
  forest.add("1", a);
  forest.add("2", b);
  forest.update();
  expect(forest.mesh.children[0].count).toBe(2);
  state.ecs.forageable[1].amount = 0;
  const bare = foragePlant(FLAT_GROUND, state, "1");
  expect(bare.geometry).not.toBe(a.geometry);
  expect(bare.geometry.attributes.position.count).toBeLessThan(a.geometry.attributes.position.count);
  state.days = 9;
  expect(foragePlant(FLAT_GROUND, state, "2").geometry).toBe(bare.geometry);
  forest.dispose();
});

it("draws a dead villager lying down", () => {
  const model = person({ ecs: {} }, {
    personable: { size: 20, dead: true, hair: 0, body: 0x553322 }
  }, x => x, { realm: 0x333333 });
  expect(model.getObjectByName("figure").rotation.x).toBeCloseTo(Math.PI / 2);
});

it("offers a forage order on a full plant, and no order on a picked plant", async () => {
  const payload = amount => ({ target: { id: "1", forageable: { amount } }, actor: {}, other: [], job_targets: [] });
  const jobs = result => result.flatMap(r => r.jobs).map(j => j.key);
  expect(jobs(await new Engine(rules).run(payload(1)))).toContain("forage");
  expect(jobs(await new Engine(rules).run(payload(0)))).not.toContain("forage");
});
