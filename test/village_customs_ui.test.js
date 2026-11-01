import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { ResourceNotice } from "../src/components/village_customs";

jest.mock("components/contexts",()=>require("../src/components/contexts"),{virtual:true});
it("renders safely before the world UI exists",()=>{
  expect(renderToStaticMarkup(<GameState.Provider value={{}}><ResourceNotice/></GameState.Provider>)).toBe("");
});
it("shows the exact directional losses before acknowledging a warning",()=>{
  const {peopleWorld}=require("./support/people"),{openChat}=require("game/chat"),{ChatPanel}=require("../src/components/chat_panel");
  const {state,player:p,person:w}=peopleWorld();state.ecs.spatial[p]={...state.ecs.spatial[w],x:state.ecs.spatial[w].x-45};state.ui.actions={};
  state.customs={incidents:[{id:1,actorId:p,villageId:"village",day:0}]};
  const incident=state.customs.incidents[0];
  openChat(state,p,w,{initiatedBy:w,openingFamily:"village_warning",required:true,context:{kind:"warning",actorId:p,speakerId:w,villageId:"village",incidentId:1}});
  const render=()=>renderToStaticMarkup(<GameState.Provider value={state}><ChatPanel/></GameState.Provider>);
  const html=render();expect(html).toContain("−3");expect(html).toContain("−2");
  state.customs.incidents.push({id:2,actorId:p,villageId:"village",warnedDay:-1});
  const repeated=render();expect(repeated).toContain("−6");expect(repeated).toContain("−4");
  expect(incident).toBeDefined();
});

it("offers the actual public elder from common woodland without granting their identity, contact, traits or rights",()=>{
  const {community}=require("./support/travel"),{newEntities}=require("game/entities"),{Hex}=require("game/hex");
  const {ResourceRights}=require("../src/components/village_customs"),{resourcePermission,villageElder}=require("game/village_customs");
  const {s,house,ids:[player,elder]}=community();
  s.ecs.personable[elder].age=60;s.ecs.household[player]={houseId:null};s.ecs.village[player]={villageId:null};
  const [tree]=newEntities(s,[{spatial:{...Hex(7,6).toPoint()},tree:{},good:{type:"wood",amount:5}}]);
  s.ui.actions={select_entity:jest.fn()};
  expect(villageElder(s,"v")).toBe(elder);expect(resourcePermission(s,player,tree)).toMatchObject({kind:"common",permitted:false});
  const before=JSON.stringify({knowledge:s.knowledge,bonds:s.ecs.relationships,positions:s.ecs.spatial,village:s.ecs.village});
  const html=renderToStaticMarkup(<GameState.Provider value={s}><ResourceRights entityId={tree}/></GameState.Provider>);
  expect(html).toContain("Meet the elder");expect(html).not.toContain(s.ecs.nameable[elder].nickname);
  const context=jest.spyOn(React,"useContext").mockReturnValue(s);
  try {
    const findButton=node=>!node||typeof node!=="object"?null:node.type=="button"?node:[node.props?.children].flat(Infinity).map(findButton).find(Boolean);
    findButton(ResourceRights({entityId:tree})).props.onClick();
    expect(s.ui.actions.select_entity).toHaveBeenCalledWith(elder,false);
    expect(JSON.stringify({knowledge:s.knowledge,bonds:s.ecs.relationships,positions:s.ecs.spatial,village:s.ecs.village})).toBe(before);
    s.ecs.village[player].memberships={v:{day:s.days}};
    expect(renderToStaticMarkup(<GameState.Provider value={s}><ResourceRights entityId={tree}/></GameState.Provider>)).toContain("Meet the elder");
    s.ecs.controllable[tree]={id:tree,controllerId:s.ecs.controllable[house].controllerId};
    expect(renderToStaticMarkup(<GameState.Provider value={s}><ResourceRights entityId={tree}/></GameState.Provider>)).not.toContain("Meet the elder");
  } finally {context.mockRestore();}
});
