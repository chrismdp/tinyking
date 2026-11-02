jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { createNightLights, nightLightStrength, MAX_FIRE_LIGHTS } from "render/night_lights";
import { camp, house, shelter, FLAT_GROUND } from "render/models";
import { villageModel, animateWorkplace } from "render/villages";

const state = () => ({ days: 23 / 24, ui: { playerId: "p" }, ecs: {
  spatial: { p: { x: 0, y: 0 }, home: { x: 0, y: 0 } },
  personable: { p: {} }, household: { p: { houseId: "home" } },
  interior: { p: { buildingId: "home" } }, building: { home: {} },
  shelter: {}, camp: {}, workplace: {}, construction: {}
} });
const update = (view, s, seconds = 1, fade = 1, focus = { x: 0, y: 0 }) => view.update(s, focus, seconds, fade);

it("uses the existing sky curve for a gradual evening and dawn, with no daytime light", () => {
  expect(nightLightStrength(12 / 24)).toBe(0);
  expect(nightLightStrength(18 / 24)).toBe(0);
  const dusk = nightLightStrength(19 / 24), late = nightLightStrength(21 / 24);
  expect(dusk).toBeGreaterThan(0); expect(late).toBeGreaterThan(dusk);
  expect(nightLightStrength(23 / 24)).toBe(1);
  expect(nightLightStrength(6 / 24)).toBeGreaterThan(0);
  expect(nightLightStrength(7 / 24)).toBe(0);
  expect(nightLightStrength(23 / 24 - .00001)).toBeCloseTo(nightLightStrength(23 / 24));
});

it.each(["building", "shelter"])("lights windows and terrain only for a living resident actually inside a completed %s", kind => {
  const s = state(), view = createNightLights(FLAT_GROUND);
  if (kind == "shelter") { delete s.ecs.building.home; s.ecs.shelter.home = { stage: "house" }; }
  const model = kind == "shelter" ? shelter(FLAT_GROUND, s, "home") : house(FLAT_GROUND, 0, 0, 1, {});
  view.add("home", model);
  const windows = model.getObjectByName("home-windows");
  const glowing = () => view.mesh.children.filter(c => c.name == "home-spill" && c.visible);
  update(view, s);
  expect(windows.visible).toBe(true); expect(glowing()).toHaveLength(1);
  expect(glowing()[0].material.blending).toBe(THREE.AdditiveBlending);
  for (const invalidate of [
    () => { delete s.ecs.interior.p; },
    () => { s.ecs.spatial.p.x = 100; },
    () => { s.ecs.personable.p.dead = true; },
    () => { s.residents = { p: false }; },
    () => { s.ecs.household.p.houseId = "elsewhere"; },
    () => { s.days = 12 / 24; }
  ]) {
    const snapshot = structuredClone(s); invalidate(); update(view, s);
    expect(windows.visible).toBe(false); expect(glowing()).toHaveLength(0);
    Object.assign(s, snapshot); update(view, s);
  }
  model.visible = false; update(view, s); expect(glowing()).toHaveLength(0);
  model.visible = true; update(view, s, 1, 0); expect(glowing()).toHaveLength(0); expect(windows.visible).toBe(false);
  view.dispose();
});

it("keeps the nearest fires within a fixed shadow-free budget, and turns every added effect off by day", () => {
  const s = state(), view = createNightLights(FLAT_GROUND);
  for (let i = 0; i < 12; i++) {
    const id = "fire" + i;
    s.ecs.spatial[id] = { x: i * 100, y: 0 }; s.ecs.camp[id] = {};
    view.add(id, camp(FLAT_GROUND, s, id));
  }
  update(view, s);
  const lights = view.mesh.children.filter(c => c.isPointLight);
  expect(MAX_FIRE_LIGHTS).toBe(2); expect(lights).toHaveLength(MAX_FIRE_LIGHTS);
  expect(lights.every(l => !l.castShadow)).toBe(true);
  expect(lights.filter(l => l.visible && l.intensity > 0)).toHaveLength(2);
  const positions = lights.map(l => l.position.x);
  expect(positions).toEqual([-25, 75]);
  const before = lights[0].intensity; update(view, s, 2);
  expect(lights[0].intensity).not.toBe(before);
  expect(Math.abs(lights[0].intensity / before - 1)).toBeLessThan(.2);
  update(view, s, 3, 1, { x: 1000, y: 0 });
  expect(lights.map(l => l.position.x)).toEqual([975, 1075]);
  s.days = 12 / 24; update(view, s);
  expect(lights.every(l => l.visible && l.intensity == 0)).toBe(true);
  expect(view.mesh.children.filter(c => !c.isPointLight).every(c => !c.visible)).toBe(true);
  view.dispose();
});

it.each(["smith", "baker"])("lights the %s hearth only while its real workplace is burning", trade => {
  const s = state(), view = createNightLights(FLAT_GROUND);
  s.ecs.spatial.work = { x: 0, y: 0 }; s.ecs.workplace.work = { trade };
  s.ecs.profession = { worker: { workplaceId: "work" } }; s.ecs.planner = { worker: { task: null } };
  const model = villageModel(FLAT_GROUND, s, "work"); view.add("work", model);
  animateWorkplace(s, "work", model, 1); update(view, s);
  const lit = () => view.mesh.children.some(c => c.isPointLight && c.visible && c.intensity > 0);
  expect(lit()).toBe(false);
  s.ecs.planner.worker.task = ["trade_work"];
  animateWorkplace(s, "work", model, 2); update(view, s); expect(lit()).toBe(true);
  model.visible = false; update(view, s); expect(lit()).toBe(false);
  view.remove("work"); expect(view.mesh.children.filter(c => !c.isPointLight)).toHaveLength(0);
  view.dispose();
});

it("drapes light over slopes, never intercepts selection, and disposes replaced pools", () => {
  const ground = { heightAt: (x, y) => x * .1 + y * .2, slopeAt: () => ({ dx: .1, dy: .2 }) };
  const s = state(), view = createNightLights(ground), model = camp(ground, { ecs: { spatial: { a: { x: 0, y: 0 } } } }, "a");
  view.add("a", model); update(view, s);
  const pool = view.mesh.children.find(c => c.isMesh), positions = pool.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) expect(positions.getY(i)).toBeCloseTo(ground.heightAt(positions.getX(i), positions.getZ(i)) + .8);
  expect(new THREE.Raycaster(new THREE.Vector3(-25, 200, -10), new THREE.Vector3(0, -1, 0)).intersectObject(pool)).toHaveLength(0);
  const geometry = jest.spyOn(pool.geometry, "dispose"), material = jest.spyOn(pool.material, "dispose");
  view.add("a", model); expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
  view.dispose(); expect(view.mesh.children).toHaveLength(0);
});

it("keeps zero-intensity point lights visible to Three through startup, day, night and removal", () => {
  const s = state(), view = createNightLights(FLAT_GROUND);
  const lights = view.mesh.children.filter(c => c.isPointLight);
  expect(lights).toHaveLength(MAX_FIRE_LIGHTS);
  expect(lights.every(l => l.visible && l.intensity === 0)).toBe(true);
  view.add("fire", camp(FLAT_GROUND, { ecs: { spatial: { fire: { x: 0, y: 0 } } } }, "fire"));
  for (const days of [12 / 24, 23 / 24, 12 / 24]) {
    s.days = days; update(view, s);
    expect(lights.every(l => l.visible)).toBe(true);
    expect(lights.filter(l => l.intensity > 0)).toHaveLength(days === 23 / 24 ? 1 : 0);
  }
  view.remove("fire"); update(view, s);
  expect(lights.every(l => l.visible && l.intensity === 0)).toBe(true);
  view.dispose();
});
