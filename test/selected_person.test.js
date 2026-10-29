import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SelectedPerson } from "../src/components/selected_person";
import { GameState } from "components/contexts";

jest.mock("components/contexts", () => ({ GameState: require("react").createContext({}) }), { virtual: true });
jest.mock("components/name", () => ({ Name: () => "Villager" }), { virtual: true });
jest.mock("components/trait_list", () => ({ TraitList: () => null }), { virtual: true });

it.each([[0.9, "Fed"], [1, "Hungry"], [3, "Starving"]])("shows hunger %s as %s in the selected-person panel", (hunger, stage) => {
  const state = { ecs: { personable: { 1: { hunger } } } };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><SelectedPerson entityId="1"/></GameState.Provider>);
  expect(html).toContain(stage);
});
