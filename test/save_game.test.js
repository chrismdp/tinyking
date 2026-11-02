import { gameData, serialiseGame, restoreGame, SAVE_VERSION } from "game/save_game";
import { generateMap } from "game/map";
import { initialiseTravel, completeTravel, destinationFor } from "game/travel";
import { startIntro, skipIntro } from "game/intro";
import { createSimulation } from "game/simulation";
import { enqueueTask } from "game/manager";
import { chat } from "game/people";
jest.mock("data/male_names.csv", () => ["Will", "Will", "Will"], { virtual: true });
jest.mock("data/female_names.csv", () => ["Rose", "Rose", "Rose"], { virtual: true });
it("round-trips a played seed-13 world, offscreen maps, travel, knowledge, ownership and orders, then simulates identically", async () => {
  const state = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} }, game_speed: "normal" };
  const generated = await generateMap(state, 13, async () => {});
  state.map = generated.map;
  state.ui.playerId = generated.playerId;
  initialiseTravel(state, 13);
  startIntro(state, { skip: true });
  const person = Object.keys(state.ecs.personable).find(id => id !== state.ui.playerId && !state.ecs.personable[id].dead);
  chat(state, state.ui.playerId, person);
  const destination = Object.values(state.map.entrances).map(e => destinationFor(state, e.tileIds[0])).find(d => !d.blocked);
  await completeTravel(state, { destination: destination.key, side: destination.side });
  skipIntro(state);
  state.game_speed = "normal";
  enqueueTask(state, { key: "rest" }, state.map.homeId);
  const original = createSimulation(state);
  for (let i = 0; i < 17; i++) await original.step(10*(1), 0);
  expect(Object.keys(state.travel.maps).length).toBeGreaterThanOrEqual(2);
  const restored = restoreGame(serialiseGame(state));
  expect(gameData(restored)).toEqual(gameData(state));
  // The save must retain shared objects used by the travel directory and maps.
  expect(restored.ecs).toBe(restored.travel.maps[restored.travel.active].ecs);
  const loaded = createSimulation(restored);
  for (let i = 0; i < 180; i++) { await original.step(10*(1), 0); await loaded.step(10*(1), 0); }
  expect(gameData(restored)).toEqual(gameData(state));
}, 15000);
it("preserves undefined, non-finite planner values and shared references, excluding render resources", () => {
  const shared = { absent: undefined, cost: Infinity, broken: NaN };
  const state = { days: 1, ecs: { a: shared, b: shared }, ui: { playerId: "p", actions: { fn() {} } }, renderer: { circular: null }, redraws: [] };
  state.renderer.circular = state.renderer;
  const copy = restoreGame(serialiseGame(state));
  expect(copy.ecs).toEqual(state.ecs);
  expect(copy.ecs.a).toBe(copy.ecs.b);
  expect(copy.renderer).toBeUndefined();
  expect(copy.ui.actions).toBeUndefined();
});
it("rejects incompatible saves with a readable error", () => {
  expect(() => restoreGame(JSON.stringify({ version: SAVE_VERSION + 1 }))).toThrow(/different version.*Start new game/i);
});

it("streams bounded JSON chunks in the existing graph format, retaining cycles and Unicode across chunks", async () => {
  const { gameJsonChunks, compressGame, decompressGame } = require("game/save_game");
  const shared = { text: "x".repeat(65535) + "👑" + "y".repeat(140000), missing: undefined, cost: -Infinity };
  shared.self = shared;
  const state = { ecs: { a: shared, b: shared }, ui: {} };
  const chunks = [...gameJsonChunks(state)];
  expect(chunks.length).toBeGreaterThan(3);
  expect(Math.max(...chunks.map(chunk => chunk.length))).toBeLessThanOrEqual(65536);
  const restored = restoreGame(chunks.join(""));
  expect(restored.ecs).toEqual(state.ecs);
  expect(restored.ecs.a).toBe(restored.ecs.b);
  expect(restored.ecs.a.self).toBe(restored.ecs.a);
  const bytes = await compressGame(state);
  expect([...new Uint8Array(bytes).slice(0, 2)]).toEqual([31, 139]);
  const loaded = await decompressGame(bytes);
  expect(loaded.ecs).toEqual(state.ecs);
  expect(loaded.ecs.a).toBe(loaded.ecs.b);
});

it("loads the original version-1 node representation", () => {
  const text = JSON.stringify({ version: 1, root: { ref: 0 }, nodes: [
    { array: null, entries: [["ecs", { ref: 1 }], ["ui", { ref: 2 }]] },
    { array: null, entries: [["value", { special: "Infinity" }], ["list", { ref: 3 }]] },
    { array: null, entries: [] },
    { array: 3, entries: [["2", { special: "undefined" }]] }
  ] });
  const copy = restoreGame(text);
  expect(copy.ecs.value).toBe(Infinity);
  expect(copy.ecs.list.length).toBe(3);
  expect(0 in copy.ecs.list).toBe(false);
  expect(2 in copy.ecs.list).toBe(true);
});
