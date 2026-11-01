import { handleSpaceKey } from "game/speed_keys";

function game(speed) {
  const state = { game_speed: speed, ui: { actions: {} } };
  state.ui.actions.set_speed = jest.fn(next => { state.game_speed = next; });
  return state;
}
const key = (target = { tagName: "DIV" }, extra = {}) => ({ code: "Space", target, repeat: false, preventDefault: jest.fn(), ...extra });

it("pauses a running game and resumes at the speed it had", () => {
  const s = game("fast");
  expect(handleSpaceKey(key(), s)).toBe(true);
  expect(s.game_speed).toBe("paused");
  handleSpaceKey(key(), s);
  expect(s.game_speed).toBe("fast");
});

it("resumes at normal speed when nothing was running before", () => {
  const s = game("paused");
  handleSpaceKey(key(), s);
  expect(s.game_speed).toBe("normal");
});

it("leaves typing, held keys and other keys alone", () => {
  const s = game("normal");
  expect(handleSpaceKey(key({ tagName: "INPUT" }), s)).toBe(false);
  expect(handleSpaceKey(key({ tagName: "TEXTAREA" }), s)).toBe(false);
  expect(handleSpaceKey(key({ tagName: "DIV", isContentEditable: true }), s)).toBe(false);
  expect(handleSpaceKey(key(undefined, { repeat: true }), s)).toBe(false);
  expect(handleSpaceKey(key(undefined, { code: "KeyP" }), s)).toBe(false);
  expect(s.ui.actions.set_speed).not.toHaveBeenCalled();
});

it("stops space from also pressing a focused button", () => {
  const s = game("normal"), e = key({ tagName: "BUTTON" });
  handleSpaceKey(e, s);
  expect(e.preventDefault).toHaveBeenCalled();
  expect(s.game_speed).toBe("paused");
});
