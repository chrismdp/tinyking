import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomGame } from "../src/components/custom_game";
import { GameState } from "components/contexts";

jest.mock("components/contexts", () => ({ GameState: require("react").createContext({}) }), { virtual: true });
jest.mock("@fortawesome/react-fontawesome", () => ({ FontAwesomeIcon: () => null }));
jest.mock("render/preview", () => ({ createPreview: jest.fn() }));
jest.mock("react-polyglot", () => ({ useTranslate: () => key => key }));
jest.mock("game/map", () => ({ HAIR: [], BODY_MALE: 0, BODY_FEMALE: 1 }));
jest.mock("game/name", () => ({ firstName: () => "Will", familyName: () => "Ashdown" }));
jest.mock("components/character_selection", () => ({ CharacterSelection: () => null }), { virtual: true });
jest.mock("components/overworld", () => ({ WeatherMap: () => null }), { virtual: true });

it("offers an explicit start button and named settings tabs on a phone", () => {
  const state = { map: {}, ui: { actions: {} }, ecs: {} };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><CustomGame/></GameState.Provider>);
  expect(html).toMatch(/<button[^>]*class="mobile-start"[^>]*>Start game<\/button>/);
  for (const label of ["Character", "House", "Neighbours", "Game settings"]) {
    expect(html).toContain(`aria-label="${label}"`);
  }
});
