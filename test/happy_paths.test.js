import { openCharacter, startGame } from "game/new_game";
import { acceptTravel, completeTravel, destinationFor } from "game/travel";
import { startIntro, skipIntro, INTRO_TIMING } from "game/intro";
import { createSimulation } from "game/simulation";
import { enqueueTask } from "game/manager";
import { chat } from "game/people";
import { chatChoices, chooseLine, closeChat } from "game/chat";
import { finishSeasonTurn } from "game/seasons";
import { gameData, serialiseGame, restoreGame } from "game/save_game";
import { newEntities } from "game/entities";
import { peopleWorld } from "./support/people";
import { economy } from "./support/economy";
import { community, attach } from "./support/travel";

jest.mock("data/male_names.csv", () => ["Will", "Will", "Will"], { virtual: true });
jest.mock("data/female_names.csv", () => ["Rose", "Rose", "Rose"], { virtual: true });

// These are the five whole-flow happy paths. Focused rule regressions live in
// the domain suites. No renderer or browser is needed to drive the real game.
it("starts a new game from the menu, hands over an owned camp and resumes time", async () => {
  const { s } = community();
  delete s.ecs.household[s.ui.playerId];
  s.ecs.container ||= {};
  s.ui.show.main_menu = true;
  s.game_speed = "paused";
  openCharacter(s);
  expect(s.ui.show.mapgen).toBe(true);
  expect(startGame(s)).toBe(true);
  expect(s.intro.active).toBe(true);
  const before = {days: s.days, people: JSON.stringify(s.ecs.personable), planners: JSON.stringify(s.ecs.planner), managers: JSON.stringify(s.ecs.manager)};
  const sim = createSimulation(s);
  sim.step(1, INTRO_TIMING.duration + 1);
  expect(s.intro.active).toBe(false);
  const camp = s.intro.campId, player = s.ui.playerId;
  expect(s.ecs.household[player].houseId).toBe(camp);
  expect(s.ecs.spatial[camp]).toMatchObject(s.intro.campPoint);
  expect(s.ecs.sleepable[camp]).toMatchObject({capacity: 1, level: 0, occupiers: []});
  expect(s.ecs.controllable[camp].controllerId).toBe(player);
  expect(s.ecs.container[camp]).toBeUndefined();
  expect(s.days).toBe(before.days);
  expect(JSON.stringify(s.ecs.personable)).toBe(before.people);
  expect(JSON.stringify(s.ecs.planner)).toBe(before.planners);
  expect(JSON.stringify(s.ecs.manager)).toBe(before.managers);
  sim.step(1, 0);
  expect(s.days).toBeGreaterThan(before.days);
}, 15000);

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

it("finishes a festival night, pauses at the season turn and begins the next season", () => {
  const {s, p} = economy();
  s.days = 6 + 22/24;
  enqueueTask(s, {key: "rest"}, p);
  const sim = createSimulation(s);
  for (let step = 0; step < 1000 && !s.seasonTurn; step++) sim.step(1);
  expect(s.festivals.records[0]).toBeDefined();
  expect(s.seasonTurn.season).toBe(0);
  expect(s.days).toBeCloseTo(7.25, 6);
  expect(s.game_speed).toBe("paused");
  const dawn = s.days;
  sim.step(600); expect(s.days).toBe(dawn);
  finishSeasonTurn(s);
  expect(s.seasonTurn).toBeNull();
  expect(s.game_speed).toBe("normal");
  sim.step(1); expect(s.days).toBeGreaterThan(dawn);
});

it("walks to an edge, travels to another hex and hands over the same living player", async () => {
  const {s, ids: [player]} = community();
  startIntro(s, {skip: true});
  attach(s, community({namespace: "next-", key: "6,5", player: false}).s);
  const life = s.ecs.personable[player].lifeYears;
  expect(acceptTravel(s, s.map.entrances[0].tileIds[0])).toBe(true);
  const sim = createSimulation(s);
  for (let minute = 0; minute < 1000 && s.travel.active == "5,5"; minute++) await sim.step(10, 0);
  expect(s.travel.active).toBe("6,5");
  expect(s.transition).toBeNull();
  expect(s.ui.playerId).toBe(player);
  expect(s.ecs.personable[player].lifeYears).toBeCloseTo(life + .25);
  expect(s.intro.active).toBe(true);
  skipIntro(s);
  expect(s.intro.active).toBe(false);
  expect(s.travel.maps["5,5"].residents[player]).toBeUndefined();
  expect(s.travel.maps["6,5"].residents[player]).toBe(true);
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
