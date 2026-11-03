import { community } from "./support/travel";
import { createSimulation } from "game/simulation";
import { INTRO_TIMING } from "game/intro";
import { openCharacter, closeCharacter, startGame } from "game/new_game";
import { startIntro } from "game/intro";
jest.mock("game/intro", () => ({ ...jest.requireActual("game/intro"), startIntro: jest.fn() }));
jest.mock("data/male_names.csv", () => ["Will", "Will", "Will"], { virtual: true });
jest.mock("data/female_names.csv", () => ["Rose", "Rose", "Rose"], { virtual: true });
beforeEach(() => startIntro.mockReset());
const world = () => ({ ecs: { personable: { p: {} } }, ui: { playerId: "p", show: { main_menu: true } }, game_speed: "paused" });
it("closing character creation cancels to the menu without arrival", () => {
  const state = world();
  openCharacter(state);
  closeCharacter(state);
  expect(state.ui.show).toMatchObject({ main_menu: true, mapgen: false });
  expect(state.game_speed).toBe("paused");
  expect(startIntro).not.toHaveBeenCalled();
});
it("only the explicit Start game action begins arrival", () => {
  const state = world();
  openCharacter(state);
  expect(startGame(state, { skip: true })).toBe(true);
  expect(state.ui.show).toMatchObject({ main_menu: false, mapgen: false });
  expect(startIntro).toHaveBeenCalledWith(state, { skip: true });
});
it("ignores start and close actions while generation owns an incomplete ECS", () => {
  const state = world();
  openCharacter(state);
  state.generating = true;
  state.ecs = { nextId: 1 };
  expect(startGame(state)).toBe(false);
  closeCharacter(state);
  expect(state.ui.show).toMatchObject({ main_menu: false, mapgen: true });
});

it("rejects Start game before a player exists, even after generation finishes", () => {
  const state = world();
  delete state.ecs.personable.p;
  expect(startGame(state)).toBe(false);
  expect(state.game_speed).toBe("paused");
  expect(startIntro).not.toHaveBeenCalled();
});

it("starts a new game from the menu, hands over an owned camp and resumes time", async () => {
  startIntro.mockImplementation(jest.requireActual("game/intro").startIntro);
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
});
