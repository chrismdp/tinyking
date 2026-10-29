import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "../src/components/window";
import { GameState } from "components/contexts";

jest.mock("components/contexts", () => ({ GameState: require("react").createContext({}) }), { virtual: true });
jest.mock("@fortawesome/react-fontawesome", () => ({ FontAwesomeIcon: () => null }));
jest.mock("react-draggable", () => ({ children, disabled }) =>
  require("react").createElement("div", { "data-drag-disabled": disabled }, children));

const originalWindow = global.window;
afterEach(() => { global.window = originalWindow; });

it.each([[390, 664], [360, 560], [664, 390], [700, 900], [900, 500]])(
  "fits a window to a %s by %s screen and disables dragging", (width, height) => {
    global.window = { innerWidth: width, innerHeight: height,
      matchMedia: () => ({ matches: width <= 700 || height <= 500 }) };
    const html = renderToStaticMarkup(<GameState.Provider value={{ ui: { actions: {} } }}>
      <Window windowId="mapgen" x={60} y={70}><div>Settings</div></Window>
    </GameState.Provider>);
    expect(html).toContain('data-drag-disabled="true"');
    expect(html).toMatch(/class="[^"]*panel-fixed/);
    expect(html).toMatch(/class="[^"]*scrollable/);
  });

it("keeps desktop windows draggable and scrollable", () => {
  global.window = { innerWidth: 1440, innerHeight: 900, matchMedia: () => ({ matches: false }) };
  const html = renderToStaticMarkup(<GameState.Provider value={{ ui: { actions: {} } }}>
    <Window windowId="info" x={30} y={30}><div>Information</div></Window>
  </GameState.Provider>);
  expect(html).toContain('data-drag-disabled="false"');
  expect(html).not.toContain("panel-fixed");
  expect(html).toMatch(/class="[^"]*scrollable/);
});
