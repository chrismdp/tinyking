import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { TravelOverview } from "../src/components/travel";
import { handleWorldMapKey, toggleWorldMap, worldMapRoads } from "game/realm_map";
import { community } from "./support/travel";
jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd()+"/node_modules/three/build/three.module.js"));
jest.mock("components/overworld",()=>require("../src/components/overworld"),{virtual:true});

it("opens and closes with M without changing time, tasks or speed, and ignores typing and repeat keys",()=>{
  const {s}=community();const before=JSON.stringify({days:s.days,travel:s.travel,speed:s.game_speed});
  const event={code:"KeyM",target:{tagName:"DIV"},preventDefault:jest.fn()};
  handleWorldMapKey(event,s);expect(s.ui.show.world_overview).toBe(true);
  handleWorldMapKey({...event,repeat:true},s);expect(s.ui.show.world_overview).toBe(true);
  handleWorldMapKey({...event,target:{tagName:"INPUT"}},s);expect(s.ui.show.world_overview).toBe(true);
  handleWorldMapKey(event,s);expect(s.ui.show.world_overview).toBe(false);
  expect(JSON.stringify({days:s.days,travel:s.travel,speed:s.game_speed})).toBe(before);
});
it("unmounts the map when closed; shows biome colours, known hexes, current position, route and discovered communities when open",()=>{
  const {s}=community();const render=()=>renderToStaticMarkup(<GameState.Provider value={s}><TravelOverview/></GameState.Provider>);
  expect(render()).toBe("");toggleWorldMap(s);
  s.travel.journey={actorId:s.ui.playerId,route:["6,5","7,5"]};
  s.ecs.playable[s.ui.playerId].known=[{x:6,y:6}];
  s.ecs.playable[s.ui.playerId].knownByMap={"6,5":[]};
  const html=render();
  expect(html).toContain("You are here");expect(html).toContain("grassland");
  expect(html).toContain("world-route");expect(html).toContain("2 seasons remain");
  expect(html).toContain("Village");expect(html).toContain("known-hex");
  expect(html).toContain("Select Reach 7, 5");expect(html).toContain("Close world map");
  s.ecs.playable[s.ui.playerId].known=[];expect(render()).not.toContain(">Village<");
});
it("shows only actual recorded border roads, deduplicated in either direction",()=>{
  const {s}=community();s.travel.routeHistory=[{borderKey:"5,5/6,5"},{borderKey:"5,5/6,5"}];
  expect(worldMapRoads(s)).toEqual([["5,5","6,5"]]);
});
