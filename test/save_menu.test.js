import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MainMenu } from "../src/components/main_menu";
import { GameState } from "components/contexts";
jest.mock("components/contexts", () => ({ GameState: require("react").createContext({}) }), { virtual: true });
const menu = persistence => {
  global.VERSION = "test";
  const state = { renderer: {}, ui: { actions: {} }, persistence };
  return renderToStaticMarkup(<GameState.Provider value={state}><MainMenu show={true}/></GameState.Provider>);
};
it("offers Continue alongside Start new game only when a compatible save exists", () => {
  expect(menu({ hasSave: false })).not.toContain(">Continue<");
  const saved = menu({ hasSave: true });
  expect(saved).toContain(">Continue<");
  expect(saved).toContain(">Start new game<");
});
it("shows an incompatible-save message and still offers a new game", () => {
  const html = menu({ hasSave: false, error: "This save is from a different version. Choose Start new game." });
  expect(html).toContain('role="alert"');
  expect(html).toContain("different version");
  expect(html).toContain(">Start new game<");
});
it("lets a returning player start a new life without generating a disposable world first", () => {
  global.VERSION = "test";
  const state = { ui: { actions: {} }, persistence: { ready: true, hasSave: true } };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><MainMenu show={true}/></GameState.Provider>);
  expect(html).toContain(">Start new game<");
  expect(html).toContain(">Continue<");
});
