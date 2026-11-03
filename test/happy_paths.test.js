import { completeTravel, destinationFor } from "game/travel";
import { startIntro, skipIntro } from "game/intro";
import { createSimulation } from "game/simulation";
import { enqueueTask } from "game/manager";
import { chat } from "game/people";
import { chatChoices, chooseLine, closeChat } from "game/chat";
import { gameData, serialiseGame, restoreGame } from "game/save_game";
import { newEntities } from "game/entities";
import { peopleWorld } from "./support/people";
import { community, attach } from "./support/travel";

jest.mock("data/male_names.csv", () => ["Will", "Will", "Will"], { virtual: true });
jest.mock("data/female_names.csv", () => ["Rose", "Rose", "Rose"], { virtual: true });

// Two core journeys use the real planner and simulation on declared communities.
// Arrival, seasonal boundaries and travel handover have focused domain tests.
it("plays a day with a queued walk, spoken chat and a night's rest", () => {
  const w = peopleWorld(), {state: s, player, person, tiles} = w;
  Object.assign(s.villages.village, {id: "village", sharedPlaces: []});
  const [camp] = newEntities(s, [{spatial: {...s.ecs.spatial[player]}, camp: {}, controllable: {controllerId: player}, sleepable: {capacity: 1, occupiers: []}}]);
  s.ecs.household[player].houseId = camp;
  const start = s.days;
  enqueueTask(s, {key: "chat"}, person);
  for (let minute = 0; minute < 120 && !s.chat?.active; minute++) w.step(1/60);
  expect(s.chat.active.npcId).toBe(person);
  const paused = s.days;
  w.step(1); expect(s.days).toBe(paused);
  expect(chooseLine(s, chatChoices(s).find(l => l.family == "introduction").key)).toBe(true);
  closeChat(s);
  expect(s.knowledge[player].people[person].conversation).toBeDefined();
  const minute = () => {
    if (s.chat?.active) {
      chooseLine(s, chatChoices(s)[0].key);
      closeChat(s);
    }
    w.step(1/60);
  };
  const walk = enqueueTask(s, {key: "move_to_here"}, tiles[2]);
  for (let step = 0; step < 120 && walk.progress != 1; step++) minute();
  expect(walk.progress).toBe(1);
  for (let step = 0; step < 1440 && s.days < 22/24; step++) minute();
  expect(s.days).toBeGreaterThanOrEqual(22/24);
  enqueueTask(s, {key: "rest"}, player);
  let slept = false;
  for (let step = 0; step < 1800 && s.days < start + 1; step++) {
    minute();
    slept ||= s.ecs.planner[player].task?.[0] == "sleep";
  }
  expect(slept).toBe(true);
  expect(s.days).toBeGreaterThanOrEqual(start + 1);
  expect(s.ecs.personable[player].dead).toBeFalsy();
  expect(s.ecs.personable[player].energy).toBeGreaterThan(0);
  expect(s.chat.active).toBeUndefined();
});

it("round-trips two played communities, offscreen maps, travel, knowledge, ownership and orders, then simulates identically", async () => {
  const { s: state } = community();
  attach(state, community({ namespace: "away-", key: "6,5", player: false }).s);
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
