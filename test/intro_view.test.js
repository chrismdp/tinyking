jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { camp, person, FLAT_GROUND, poseArrivalPerson } from "render/models";
import { CAMP_LAYOUT } from "game/intro";

it("carries a cloth bundle clear of the body, then leaves it beside the bedroll", () => {
  const state = { ui: { playerId: "p" }, intro: { pose: "walking", phase: "walking" }, ecs: { good: {}, camp: { c: { bundle: CAMP_LAYOUT.bundle } }, spatial: { c: { x: 0, y: 0 } } } };
  const e = { id: "p", personable: { size: 20, body: 0x4E3F30, hair: 0 } };
  const player = person(state, e, () => "", { realm: 0xFFFFFF });
  poseArrivalPerson(player, state.intro, 20);
  const cloth = player.getObjectByName("cloth-bundle");
  const bounds = new THREE.Box3().setFromObject(cloth);
  expect(bounds.max.z).toBeLessThan(-8);
  expect(bounds.min.y).toBeGreaterThan(0);
  expect(player.getObjectByName("bundle-stick")).toBeDefined();
  const prop = camp(FLAT_GROUND, state, "c").getObjectByName("arrival-bundle");
  const box = new THREE.Box3().setFromObject(prop);
  expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
  expect(box.max.y).toBeLessThan(20);
  expect(Math.hypot(prop.position.x, prop.position.z)).toBeLessThan(40);
});

it("sits with visible legs above the ground and faces the campfire", () => {
  const state = { ui: { playerId: "p" }, intro: { pose: "sitting", facing: Math.PI, sit: 1 }, ecs: { good: {} } };
  const player = person(state, { id: "p", personable: { size: 20, body: 0x4E3F30, hair: 0 } }, () => "", { realm: 0xFFFFFF });
  poseArrivalPerson(player, state.intro, 20);
  const seated = player.getObjectByName("seated-figure");
  const bounds = new THREE.Box3().setFromObject(seated);
  expect(bounds.min.y).toBeGreaterThanOrEqual(0);
  expect(bounds.max.y).toBeLessThan(33);
  expect(player.getObjectByName("seated-legs").visible).toBe(true);
  expect(player.getObjectByName("figure").rotation.y).toBe(Math.PI);
  expect(player.getObjectByName("arrival-bundle").visible).toBe(false);
  poseArrivalPerson(player, { pose: "standing" }, 20);
  expect(seated.visible).toBe(false);
  expect(player.getObjectByName("standing-figure").visible).toBe(true);
});

it("does not add arrival props to a player who has died after the opening", () => {
  const state = { ui: { playerId: "p" }, intro: { pose: "standing" }, ecs: { good: {} } };
  const player = person(state, { id: "p", personable: { size: 20, body: 0x4E3F30, hair: 0, dead: true } }, () => "", { realm: 0xFFFFFF });
  expect(player.getObjectByName("figure").rotation.x).toBe(Math.PI / 2);
  expect(player.getObjectByName("arrival-bundle").visible).toBe(false);
});

it("lowers the stick around the shoulder without sweeping through the torso", () => {
  const camp = { x: 0, y: 0 };
  const spatial = { ...CAMP_LAYOUT.drop };
  const state = { ui: { playerId: "p" }, intro: {}, ecs: { good: {} } };
  const player = person(state, { id: "p", personable: { size: 20, body: 0x4E3F30, hair: 0 } }, () => "", { realm: 0xFFFFFF });
  player.position.set(spatial.x, 0, spatial.y);
  for (const putDown of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
    poseArrivalPerson(player, { pose: "putting-down", putDown, facing: Math.atan2(CAMP_LAYOUT.bundle.x - spatial.x, CAMP_LAYOUT.bundle.y - spatial.y) }, 20, { ground: FLAT_GROUND, camp, spatial });
    player.updateMatrixWorld(true);
    const figure = player.getObjectByName("figure");
    const stick = player.getObjectByName("bundle-stick");
    for (let y = -24; y <= 24; y += 1) {
      const p = figure.worldToLocal(stick.localToWorld(new THREE.Vector3(0, y, 0)));
      if (p.y > 0 && p.y < 26) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(7.5);
    }
    const cloth = player.getObjectByName("cloth-bundle");
    const centre = figure.worldToLocal(cloth.getWorldPosition(new THREE.Vector3()));
    if (centre.y > 0 && centre.y < 33) expect(Math.hypot(centre.x, centre.z)).toBeGreaterThan(15);
  }
});
