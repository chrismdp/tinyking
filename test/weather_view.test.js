jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));

import * as THREE from "three";
import { Hex } from "game/hex";
import { createTerrain } from "render/terrain";
import { createWeatherView } from "render/weather";
import { weatherLight } from "render/sky";

it("whitens land by snow depth without new surfaces or per-frame colour uploads", () => {
  const hex = Hex(2, 2);
  const sea = Hex(3, 2);
  const state = { map: { seed: 13 }, world: { home: { x: 0, y: 0 }, hexes: [
    { x: 0, y: 0, temperature: "temperate", moisture: "normal", biome: "grassland", morality: "neutral" }
  ] }, snow: { 1: 0, 2: 0 }, snowRevision: 0, space: { [hex]: ["1"], [sea]: ["2"] }, ecs: {
    mappable: { 1: { terrain: "grassland" }, 2: { terrain: "deep water" } },
    spatial: { 1: hex.toPoint(), 2: sea.toPoint() }
  } };
  const ground = { hex: () => ({ centre: 0, corners: [0, 0, 0, 0, 0, 0] }) };
  const terrain = createTerrain(state, ground);
  terrain.update();
  const colours = terrain.mesh.geometry.attributes.color;
  const bare = [...colours.array];
  const positions = [...terrain.mesh.geometry.attributes.position.array];
  state.snow[1] = state.snow[2] = 0.8;
  state.snowRevision++;
  terrain.update();
  expect(colours.array[0]).toBeGreaterThan(bare[0]);
  expect([...colours.array].slice(54)).toEqual(bare.slice(54));
  expect([...terrain.mesh.geometry.attributes.position.array]).toEqual(positions);
  const version = colours.version;
  terrain.update();
  state.snow[1] += 0.001;
  state.snowRevision++;
  terrain.update();
  expect(colours.version).toBe(version);
  state.snow[1] = 0;
  state.snowRevision++;
  terrain.update();
  expect([...colours.array]).toEqual(bare);
  terrain.dispose();
});

it("dims and greys overcast lighting while keeping storms readable", () => {
  const clear = weatherLight("clear");
  const cloud = weatherLight("cloudy");
  const storm = weatherLight("storm");
  expect(cloud.sun).toBeLessThan(clear.sun);
  expect(storm.sun).toBeLessThan(cloud.sun);
  expect(storm.sky).toBeGreaterThanOrEqual(0.55);
  expect(cloud.grey).toBeGreaterThan(0);
});

it("animates bounded precipitation on the GPU without uploading positions each frame", () => {
  const view = createWeatherView();
  const camera = new THREE.PerspectiveCamera(40, 1.6, 5, 12000);
  camera.position.set(0, 700, 700);
  camera.lookAt(0, 0, 0);
  const weather = { type: "rain", wind: { x: 1, y: 0, strength: 0.5 } };
  view.update(weather, camera, 1, false);
  expect(view.mesh.children.filter(c => c.visible).length).toBe(1);
  const rain = view.mesh.children.find(c => c.visible);
  const version = rain.geometry.attributes.position.version;
  const count = rain.geometry.attributes.position.count;
  view.update(weather, camera, 2, false);
  expect(rain.geometry.attributes.position.version).toBe(version);
  expect(count).toBeLessThanOrEqual(1600);
  view.update({ ...weather, type: "snow" }, camera, 3, false);
  expect(rain.visible).toBe(false);
  expect(view.mesh.children.filter(c => c.visible).length).toBe(1);
  view.update({ ...weather, type: "storm" }, camera, 4, true);
  expect(view.mesh.children.filter(c => c.visible).length).toBe(2);
  view.update({ ...weather, type: "clear" }, camera, 5, true);
  expect(view.mesh.children.some(c => c.visible)).toBe(false);
  view.dispose();
});

it("keeps windblown storm debris above the hillside in view", () => {
  const view = createWeatherView({ heightAt: () => 120 });
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 700, 700);
  camera.lookAt(0, 0, 0);
  view.update({ type: "storm", wind: { x: 1, y: 0, strength: 1 }, moisture: 0.2 }, camera, 1, true);
  const dust = view.mesh.children.find(child => child.name == "dust");
  expect(dust.visible).toBe(true);
  expect(dust.material.uniforms.centre.value.y).toBeGreaterThanOrEqual(120);
  expect(view.mesh.children.find(child => child.name == "rain").visible).toBe(false);
  view.dispose();
});

it("shows snow rather than rain in a wet winter storm over a cold world hex", () => {
  const view = createWeatherView();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 700, 700);
  camera.lookAt(0, 0, 0);
  view.update({ type: "storm", wind: { x: 1, y: 0, strength: 1 }, moisture: 0.8 }, camera, 1, true, true);
  expect(view.mesh.children.find(child => child.name == "snow").visible).toBe(true);
  expect(view.mesh.children.find(child => child.name == "rain").visible).toBe(false);
  view.dispose();
});
