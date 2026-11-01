import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { RealmControls } from "../src/components/realm_controls";
it("offers a separate world map toggle and local camera return",()=>{
  const s={ui:{show:{world_overview:true}}};
  const html=renderToStaticMarkup(<GameState.Provider value={s}><RealmControls/></GameState.Provider>);
  expect(html).toContain('aria-label="World map"');expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("Recenter on you");expect(html).toContain("M");
});
