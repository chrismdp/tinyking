import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MainMenu } from "../src/components/main_menu";
import { GameState } from "components/contexts";

jest.mock("components/contexts", () => ({ GameState: require("react").createContext({}) }), { virtual: true });

it("offers the start chooser only after the map and player have been generated", () => {
  global.VERSION = "test";
  const state = { ui: { actions: { custom_game() {} } } };
  const menu = () => renderToStaticMarkup(<GameState.Provider value={state}><MainMenu show={true}/></GameState.Provider>);
  expect(menu()).not.toContain("Start new game");
  state.renderer = {};
  state.ui.playerId = "player";
  expect(menu()).toContain("Start new game");
  delete global.VERSION;
});
