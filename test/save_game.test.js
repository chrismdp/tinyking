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
