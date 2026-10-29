jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { camp, person, FLAT_GROUND, poseArrivalPerson, campSetup, poseCampSetup } from "render/models";
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

it("stands at handover with no seated geometry and no carried bundle", () => {
  const state = { ui: { playerId: "p" }, intro: { pose: "standing", facing: 1.2 }, ecs: { good: {} } };
  const player = person(state, { id: "p", personable: { size: 20, body: 0x4E3F30, hair: 0 } }, () => "", { realm: 0xFFFFFF });
  poseArrivalPerson(player, state.intro, 20);
  expect(player.getObjectByName("seated-figure")).toBeUndefined();
  const bounds = new THREE.Box3().setFromObject(player.getObjectByName("standing-figure"));
  expect(bounds.min.y).toBeGreaterThanOrEqual(0);
  expect(bounds.max.y).toBeGreaterThan(33);
  expect(player.getObjectByName("arrival-bundle").visible).toBe(false);
  expect(player.getObjectByName("standing-figure").visible).toBe(true);
  expect(player.getObjectByName("figure").rotation.y).toBe(1.2);
});

it("shows no camp pieces during arrival, then the grounded bundle, fire and bedroll in sequence", () => {
  const object = campSetup(FLAT_GROUND, { x: 0, y: 0 });
  const bundle = object.getObjectByName("arrival-bundle");
  const fire = object.getObjectByName("campfire");
  const bedroll = object.getObjectByName("bedroll");
  poseCampSetup(object, { putDown: 0, fire: 0, bedroll: 0 });
  expect([bundle.visible, fire.visible, bedroll.visible]).toEqual([false, false, false]);
  poseCampSetup(object, { putDown: 1, fire: 0.5, bedroll: 0 });
  expect([bundle.visible, fire.visible, bedroll.visible]).toEqual([true, true, false]);
  expect(fire.scale.x).toBe(0.5);
  poseCampSetup(object, { putDown: 1, fire: 1, bedroll: 0.5 });
  expect(fire.scale.x).toBe(1);
  expect(bedroll.visible).toBe(true);
  expect(bedroll.scale.x).toBe(0.5);
  poseCampSetup(object, { putDown: 1, fire: 1, bedroll: 1 });
  const finished = camp(FLAT_GROUND, { ecs: { spatial: { c: { x: 0, y: 0 } }, camp: { c: { bundle: CAMP_LAYOUT.bundle } } } }, "c");
  expect(new THREE.Box3().setFromObject(object)).toEqual(new THREE.Box3().setFromObject(finished));
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
