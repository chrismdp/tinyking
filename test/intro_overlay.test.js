import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { IntroOverlay } from "../src/components/intro_overlay";
jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });

it.each([[false, "Click to skip"], [true, "Tap to skip"]])("offers a full-screen skip target suited to the input", (touch, hint) => {
  const html = renderToStaticMarkup(<GameState.Provider value={{ ui: { actions: { skip_intro() {} } } }}><IntroOverlay touch={touch}/></GameState.Provider>);
  expect(html).toContain('id="intro-skip"');
  expect(html).toContain(hint);
  expect(html).toContain("<button");
});

jest.mock("components/intro_overlay", () => require("../src/components/intro_overlay"), { virtual: true });
jest.mock("components/task_panel", () => ({ TaskPanel: () => <div id="tasks"/> }), { virtual: true });
jest.mock("components/speed_controls", () => ({ SpeedControls: () => <div id="speed"/> }), { virtual: true });
jest.mock("components/custom_game", () => ({ CustomGame: () => null }), { virtual: true });
jest.mock("components/info", () => ({ Info: () => null }), { virtual: true });
jest.mock("components/window", () => ({ Window: () => null }), { virtual: true });
jest.mock("components/main_menu", () => ({ MainMenu: () => null }), { virtual: true });
jest.mock("components/game_over", () => ({ GameOver: () => null }), { virtual: true });
jest.mock("components/tutorial", () => ({ Tutorial: () => null }), { virtual: true });
jest.mock("components/clock", () => ({ Clock: () => null }), { virtual: true });
jest.mock("components/selected_person", () => ({ SelectedPerson: () => null }), { virtual: true });

it("withholds game controls throughout the opening and renders them after handover", () => {
  const { UserInterface } = require("../src/components/user_interface");
  const state = { intro: { active: true }, ui: { show: { speed_controls: true }, actions: { skip_intro() {} } } };
  const render = () => renderToStaticMarkup(<GameState.Provider value={state}><UserInterface/></GameState.Provider>);
  expect(render()).toContain("intro-skip");
  expect(render()).not.toContain('id="speed"');
  expect(render()).not.toContain('id="tasks"');
  state.intro.active = false;
  expect(render()).not.toContain("intro-skip");
  expect(render()).toContain('id="speed"');
  expect(render()).toContain('id="tasks"');
});
