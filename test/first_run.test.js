import { openCharacter, closeCharacter, startGame } from "game/new_game";
import { startIntro } from "game/intro";
jest.mock("game/intro", () => ({ startIntro: jest.fn() }));
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
