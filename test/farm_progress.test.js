import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FarmProgress } from "../src/components/farm_progress";
import { GameState } from "components/contexts";

jest.mock("components/contexts", () => ({ GameState: require("react").createContext({}) }), { virtual: true });
jest.mock("components/until", () => ({ Until: () => null }), { virtual: true });

it("shows growing-season progress and explains the winter pause", () => {
  const farmable = { slots: [{ content: "grain", state: "sown", updated: 1, growth: 2.25 }] };
  const html = renderToStaticMarkup(<GameState.Provider value={{ days: 10 }}><FarmProgress farmable={farmable}/></GameState.Provider>);
  expect(html).toContain('value="0.5"');
  expect(html).toContain("Growth paused for winter");
});
