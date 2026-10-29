jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { villageModel, animateWorkplace } from "render/villages";
import { createInstances } from "render/instances";
import { field, FLAT_GROUND } from "render/models";
import { TRIANGLES } from "game/map";

it("draws distinct low-poly household and shared places with shared geometry", () => {
  const kinds = { backyard: ["vegetable", "chicken", "pig", "goat", "beehives"],
    workplace: ["smith", "carpenter", "weaver", "baker", "tanner", "miller"],
    meetingPlace: ["well", "green", "chapel", "alehouse"] };
  const geometries = new Set();
  for (const [component, values] of Object.entries(kinds)) for (const kind of values) {
    const s = { ecs: { spatial: { a: { x: 50, y: 50 } }, [component]: { a: { kind, trade: kind } } } };
    const a = villageModel(FLAT_GROUND, s, "a"), b = villageModel(FLAT_GROUND, s, "a");
    expect(a.children[0].geometry).toBe(b.children[0].geometry);
    expect(new THREE.Box3().setFromObject(a).isEmpty()).toBe(false);
    geometries.add(a.children[0].geometry);
  }
  expect(geometries.size).toBe(15);
});

it("instances whole flocks with selectable ids and updates moving transforms", () => {
  const batch = createInstances();
  const s = { ecs: { spatial: { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }, animal: { a: { kind: "sheep" }, b: { kind: "sheep" } } } };
  const a = villageModel(FLAT_GROUND, s, "a"), b = villageModel(FLAT_GROUND, s, "b");
  batch.add("a", a); batch.add("b", b); batch.update();
  expect(batch.mesh.children).toHaveLength(1);
  expect(batch.mesh.children[0].count).toBe(2);
  expect(batch.mesh.children[0].userData.entityIds).toEqual(["a", "b"]);
  a.position.x = 20; batch.invalidate("a"); batch.update();
  const matrix = new THREE.Matrix4();
  batch.mesh.children[0].getMatrixAt(0, matrix);
  expect(matrix.elements[12]).toBe(20);
  b.visible = false; batch.invalidate(); batch.update();
  expect(batch.mesh.children[0].count).toBe(1);
  batch.remove("a"); batch.update();
  expect(batch.mesh.children[0].count).toBe(0);
  batch.dispose();
});

it("batches crops across fields and keeps winter crop height fixed", () => {
  const batch = createInstances();
  const s = { days: 9.375, ecs: { spatial: { a: { x: 0, y: 0 }, b: { x: 120, y: 0 } }, farmable: {} } };
  for (const id of ["a", "b"]) s.ecs.farmable[id] = { slots: TRIANGLES.map(() => ({ state: "sown", content: "grain", growth: 2, updated: 1 })) };
  const a = field(FLAT_GROUND, s, "a", {});
  const height = new THREE.Box3().setFromObject(a).max.y;
  s.days++;
  expect(new THREE.Box3().setFromObject(field(FLAT_GROUND, s, "a", {})).max.y).toBe(height);
  batch.add("a", a); batch.add("b", field(FLAT_GROUND, s, "b", {})); batch.update();
  expect(batch.mesh.children.some(mesh => mesh.count == TRIANGLES.length * 2)).toBe(true);
  expect(batch.mesh.children.length).toBeLessThanOrEqual(3);
  batch.dispose();
});

it("shows forge smoke only while its trade holder is working", () => {
  const s = { ecs: { spatial: { a: { x: 0, y: 0 } }, workplace: { a: { trade: "smith" } }, profession: { p: { workplaceId: "a" } }, planner: { p: { task: null } } } };
  const model = villageModel(FLAT_GROUND, s, "a");
  animateWorkplace(s, "a", model, 1);
  expect(model.getObjectByName("smoke").visible).toBe(false);
  s.ecs.planner.p.task = ["trade_work", "a"];
  animateWorkplace(s, "a", model, 2);
  expect(model.getObjectByName("smoke").visible).toBe(true);
});
