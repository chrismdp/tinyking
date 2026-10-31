import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { RealmControls } from "../src/components/realm_controls";
jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
it("offers touch-sized view layers with checked state and truthful unexplored weather facts",()=>{
  const s={world:{home:{x:0,y:0},hexes:[{x:0,y:0},{x:1,y:0,biome:"taiga",temperature:"cold",moisture:"wet"}]},
    ui:{playerId:"p",realmSelection:{reachKey:"1,0"},mapLayers:{wind:true,weather:true},show:{}},
    ecs:{playable:{p:{known:[]}}},renderer:{overview:true},weather:{"1,0":{type:"snow",pressure:1001,wind:{x:-1,y:0,strength:.25}}}};
  const html=renderToStaticMarkup(<GameState.Provider value={s}><RealmControls/></GameState.Provider>);
  expect(html).toContain("Fit the whole realm");expect(html).toContain("Recenter on you");
  expect(html).toContain('type="checkbox"');expect(html).toContain("checked");
  expect(html).toContain("Unexplored");expect(html).toContain("visit");expect(html).toContain("west");
  expect(html).toContain("1001");expect(html).not.toContain("owner");
});
