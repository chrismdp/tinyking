import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { CustomsEncounter } from "../src/components/village_customs";

jest.mock("components/contexts",()=>require("../src/components/contexts"),{virtual:true});
it("renders safely before the world UI exists",()=>{
  expect(renderToStaticMarkup(<GameState.Provider value={{}}><CustomsEncounter/></GameState.Provider>)).toBe("");
});
it("shows the exact directional losses before acknowledging a warning",()=>{
  const state={ui:{playerId:"p"},ecs:{personable:{},nameable:{}},villages:{v:{name:"Withyford"}},customs:{
    dialogue:{kind:"warning",actorId:"p",speakerId:"w",villageId:"v",incidentId:1},
    incidents:[{id:1,actorId:"p",villageId:"v",day:0}]
  }};
  const html=renderToStaticMarkup(<GameState.Provider value={state}><CustomsEncounter/></GameState.Provider>);
  expect(html).toContain("−3");expect(html).toContain("−2");
  state.customs.incidents.push({id:2,actorId:"p",villageId:"v",warnedDay:-1});
  const repeated=renderToStaticMarkup(<GameState.Provider value={state}><CustomsEncounter/></GameState.Provider>);
  expect(repeated).toContain("−6");expect(repeated).toContain("−4");
});
