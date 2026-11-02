jest.mock("../scripts/game-register",()=>({}));
import { discoverTimber, waitForOathReadiness, returnToLocalView } from "../scripts/acceptance-selection";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { resourcePermission, oathEligibility } from "game/village_customs";
import { community } from "./support/travel";
import { peopleWorld } from "./support/people";
import { enqueueTask } from "game/manager";
import { newEntities } from "game/entities";

function view() {
  const {s,ids:[player,neighbour],tiles}=community();
  newEntities(s,[{spatial:{...s.ecs.spatial[player]},camp:{},controllable:{controllerId:player}}]);
  s.villages={};
  const at=Hex().fromPoint(s.ecs.spatial[player]);
  s.ecs.playable[player].known=[{x:at.x,y:at.y},{x:at.x-1,y:at.y}];
  const [tree]=newEntities(s,[{spatial:{...Hex(at.x-1,at.y).toPoint()},tree:{},good:{type:"wood",amount:5}}]);
  const g={Hex,path};
  global.window={tinyking:s,tinykingGeography:g,tinykingCustoms:{resourcePermission}};
  const page={evaluate:async(fn,arg)=>fn(arg)};
  return {s,player,neighbour,tiles,tree,page,at};
}
afterEach(()=>{delete global.window;});

it("chooses a reachable known frontier outside the old eastern strip without looking at hidden trees",async()=>{
  const {s,tree,page,at}=view();
  // INITIAL map facts: the only legal wood is still hidden. This test observes
  // the selected move, not a fabricated exploration outcome.
  s.ecs.spatial[tree]={...Hex(at.x-3,at.y).toPoint()};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("observed first frontier order");})).rejects.toThrow("observed first frontier order");
  expect(moves).toHaveLength(1);
  expect(s.ecs.playable[s.ui.playerId].known.map(h=>String(Hex(h)))).toContain(String(Hex().fromPoint(s.ecs.spatial[moves[0]])));
  expect(s.ecs.spatial[moves[0]].x).toBeLessThanOrEqual(s.ecs.spatial[s.ui.playerId].x);
});

it("counts only discovered permitted reachable timber and does not edit discovery or stock",async()=>{
  const {s,tree,page,neighbour}=view(),known=JSON.stringify(s.ecs.playable[s.ui.playerId].known),goods=JSON.stringify(s.ecs.good);
  const steps=await discoverTimber(page,5);
  expect(steps[0].trees).toEqual([tree]);expect(steps[0].logs).toBe(5);
  expect(JSON.stringify(s.ecs.playable[s.ui.playerId].known)).toBe(known);expect(JSON.stringify(s.ecs.good)).toBe(goods);
  s.ecs.controllable[tree]={id:tree,controllerId:neighbour};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("private wood excluded");})).rejects.toThrow("private wood excluded");
  expect(moves).toHaveLength(1);
});

it("does not count known timber across a disconnected route",async()=>{
  const {s,tree,page}=view();
  const tile=(s.space[Hex().fromPoint(s.ecs.spatial[tree])] || []).find(id=>s.ecs.mappable[id]);
  for(const id of Object.keys(s.ecs.walkable))for(const [side,to]of Object.entries(s.ecs.walkable[id].neighbours))if(to==tile)delete s.ecs.walkable[id].neighbours[side];
  await expect(discoverTimber(page,5)).rejects.toThrow(/"logs":0/);
});

it("prefers an already known unclaimed frontier to exploring further into private land",async()=>{
  const {s,player,page,at}=view();
  s.ecs.playable[player].known.push({x:at.x+1,y:at.y},{x:at.x+2,y:at.y});
  s.ecs.household[player]={id:player}; // INITIAL stranger at the camp, outside that household.
  const home=Object.keys(s.ecs.building)[0];
  s.ecs.household[home].plot={hexes:[String(Hex(at.x-1,at.y)),String(Hex(at.x+1,at.y))]};
  const tree=Object.keys(s.ecs.tree)[0];s.ecs.spatial[tree]={...Hex(at.x-3,at.y).toPoint()};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("frontier selected");})).rejects.toThrow("frontier selected");
  expect(resourcePermission(s,player,moves[0])).toMatchObject({kind:"unclaimed",permitted:true});
});

it("discovers native starting wood that has a standing wood good without a growth-stage tree component",async()=>{
  const {s,page,tree}=view();
  // INITIAL representation used by generateMap's existing arrival guarantee:
  // standing wood has good/spatial, while only ecological trees have tree.
  s.ecs.tree={};
  const steps=await discoverTimber(page,5);
  expect(steps[0].trees).toEqual([tree]);expect(steps[0].logs).toBe(5);
});

function oathCareWorld(unready) {
  const w=peopleWorld(),s=w.state,actor=w.player,elder=w.parent;
  // INITIAL night, real beds and a carried meal. Trust/contact are old fixture
  // facts; only native orders and NPC planning may produce recovery below.
  s.days=.9;
  const [house,playerBed,elderBed,meal]=newEntities(s,[
    {spatial:{...s.ecs.spatial[elder]},building:{rooms:[]},household:{},village:{villageId:"village"},controllable:{controllerId:elder}},
    {spatial:{...s.ecs.spatial[actor]},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:actor}},
    {spatial:{...s.ecs.spatial[elder]},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:elder}},
    {spatial:{...s.ecs.spatial[actor]},good:{type:"forage",amount:1},haulable:{heldBy:actor},controllable:{controllerId:actor}}
  ]);
  Object.assign(s.villages.village,{id:"village",houses:[house],sharedPlaces:[]});
  for(const id of [w.person,elder,w.sibling])s.ecs.household[id].houseId=house;
  s.ecs.household[actor]={houseId:null};s.ecs.village[actor]={villageId:null};
  s.ecs.holder[actor].held=[meal];
  s.ecs.planner[actor].world.places.sleep=playerBed;
  s.ecs.planner[elder].world.places.sleep=elderBed;
  for(const id of [actor,w.person,elder,w.sibling]) {
    s.ecs.planner[id].world.days=s.days;
    s.ecs.planner[id].world.feeling={hungry:unready && id==actor,tired:unready && [actor,elder].includes(id)};
    s.ecs.personable[id].hunger=unready && id==actor?1:0;
    s.ecs.personable[id].tiredness=unready && [actor,elder].includes(id)?1:0;
    if(![actor,elder].includes(id)){s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];}
  }
  s.ecs.relationships[elder].known[actor]={ring:"social",goodwill:12};
  s.knowledge={[actor]:{people:{[elder]:{traits:[],conversation:{day:-1}}},feelings:{}}};
  s.game_speed="paused";
  const orders=[];
  s.ui.actions={choose_job:(id,job,target)=>{expect(id).toBe(actor);orders.push(job.key);enqueueTask(s,job,target);},set_speed:speed=>{s.game_speed=speed;}};
  global.window={tinyking:s,tinykingCustoms:{oathEligibility}};
  const page={
    evaluate:async(fn,arg)=>JSON.parse(JSON.stringify(fn(arg) ?? null)),
    waitForFunction:async(fn,arg)=>{
      for(let minute=0;minute<24*60;minute++) {
        if(fn(arg))return;
        w.step(1/60);
      }
      throw new Error("Native care did not make both parties ready within the fixture night");
    }
  };
  return {s,actor,elder,meal,orders,page};
}

it("lets actual NPC sleep recover oath readiness without automatic player care or granting contact or rights",async()=>{
  const {s,actor,elder,meal,orders,page}=oathCareWorld(true);
  const before=JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events});
  const result=await waitForOathReadiness(page,elder,"village");
  expect(result.initial.readiness.ok).toBe(false);expect(result.after.readiness.ok).toBe(true);
  expect(orders).toEqual([]);
  expect(s.ecs.good[meal]).toMatchObject({type:"forage",amount:1});
  expect(s.ecs.personable[elder].tiredness).toBeLessThan(.2);
  expect(s.ecs.personable[actor].energy).toBeGreaterThanOrEqual(0);
  expect(s.ecs.planner[elder].world.feeling.tired).toBe(false);
  expect(s.game_speed).toBe("paused");expect(s.ecs.manager[actor].jobs).toEqual([]);
  expect(JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events})).toBe(before);
});

it("leaves ready parties and their supplies alone before the real oath request",async()=>{
  const {s,elder,orders,page}=oathCareWorld(false),before=JSON.stringify(s);
  expect((await waitForOathReadiness(page,elder,"village")).orders).toEqual([]);
  expect(orders).toEqual([]);expect(JSON.stringify(s)).toBe(before);
});

it("closes the separate world map before local clicks, without touching game outcomes",async()=>{
  const {s,page}=view(),before=JSON.stringify(s);
  const previous=s.ui.show;
  s.ui.show={world_overview:true};
  const click=jest.fn(async()=>{s.ui.show.world_overview=false;});
  page.getByRole=jest.fn(()=>({click}));
  page.waitForFunction=async fn=>expect(fn()).toBe(true);
  await returnToLocalView(page);
  expect(page.getByRole).toHaveBeenCalledWith("button",{name:"Close world map",exact:true});
  expect(click).toHaveBeenCalledTimes(1);
  await returnToLocalView(page);expect(click).toHaveBeenCalledTimes(1);
  s.ui.show=previous;expect(JSON.stringify(s)).toBe(before);
});

it("chooses a real farming household for the storyboard when no fuel favour exists", () => {
  const {state:s,player,person,parent,tiles}=peopleWorld();
  s.opinionThresholds={hate:-100,love:-99};
  s.favours={requests:{}};
  const [crop]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[5]],immovable:true},farmable:{houseId:tiles[3],slots:[{state:'sown',growth:0,content:'grain'}]},controllable:{controllerId:person}}]);
  s.ecs.household[tiles[3]]={fields:[crop],storeId:tiles[3]};
  s.ecs.container ||= {};s.ecs.container[tiles[3]]={capacity:100,amounts:{}};
  s.ecs.personable[parent].dead=true;
  const before=JSON.stringify(s);
  const choice=require('../scripts/acceptance-selection').harvestFriend(s);
  expect(choice).toMatchObject({person,home:tiles[3],field:crop});
  expect(JSON.stringify(s)).toBe(before);
});

it("chooses a reachable householder crop rather than a nearer resident's unworkable field", () => {
  const {state:s,player,person,parent,sibling,tiles}=peopleWorld();
  s.opinionThresholds={hate:-100,love:-99};s.favours={requests:{}};
  s.ecs.personable[parent].dead=true;
  s.ecs.spatial[person]={...s.ecs.spatial[tiles[0]]};
  const [bad,good]=newEntities(s,[tiles[5],tiles[2]].map(tile=>({spatial:{...s.ecs.spatial[tile],immovable:true},farmable:{slots:[{state:'sown',content:'grain'}]},controllable:{controllerId:person}})));
  s.ecs.household[person].houseId=tiles[4];s.ecs.household[tiles[4]]={fields:[bad],storeId:tiles[4]};
  s.ecs.household[sibling].houseId=tiles[3];s.ecs.household[tiles[3]]={fields:[good],storeId:tiles[3]};
  s.ecs.controllable[person].controllerId=person;s.ecs.controllable[sibling].controllerId=sibling;
  for(const walk of Object.values(s.ecs.walkable))for(const [side,id]of Object.entries(walk.neighbours))if(id==tiles[5])delete walk.neighbours[side];
  const before=JSON.stringify(s);
  expect(require('../scripts/acceptance-selection').harvestFriend(s)).toMatchObject({person:sibling,field:good});
  expect(JSON.stringify(s)).toBe(before);
});

it("rejects a reachable harvest whose household cannot store the full favour yield", () => {
  const {state:s,person,parent,tiles}=peopleWorld();
  s.opinionThresholds={hate:-100,love:-99};s.favours={requests:{}};
  s.ecs.personable[parent].dead=true;
  const [crop]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[5]],immovable:true},farmable:{houseId:tiles[3],slots:Array.from({length:3},()=>({state:"sown",content:"grain"}))},controllable:{controllerId:person}}]);
  s.ecs.household[tiles[3]]={fields:[crop],storeId:tiles[3]};
  s.ecs.container ||= {};s.ecs.container[tiles[3]]={capacity:100,amounts:{grain:90}};
  expect(()=>require("../scripts/acceptance-selection").harvestFriend(s)).toThrow("no attainable farming friend");
  s.ecs.container[tiles[3]].amounts.grain=60;
  expect(require("../scripts/acceptance-selection").harvestFriend(s)).toMatchObject({person,field:crop});
});

it("can earn a nearby compatible farmer's trust rather than choosing only distant love dispositions", () => {
  const {state:s,person,parent,tiles}=peopleWorld();
  s.opinionThresholds={hate:-100,love:100};s.favours={requests:{}};
  s.ecs.personable[parent].dead=true;
  const [crop]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[5]],immovable:true},farmable:{houseId:tiles[3],slots:Array.from({length:3},()=>({state:"sown",content:"grain"}))},controllable:{controllerId:person}}]);
  s.ecs.household[tiles[3]]={fields:[crop],storeId:tiles[3]};s.ecs.container ||= {};s.ecs.container[tiles[3]]={capacity:100,amounts:{}};
  const before=JSON.stringify(s);
  expect(require('../scripts/acceptance-selection').harvestFriend(s)).toMatchObject({person,field:crop});
  expect(JSON.stringify(s)).toBe(before);
});

it("uses discovered tastes and visible matches while keeping favour acceptance deliberate", () => {
  const {chooseVisibleLine}=require("../scripts/acceptance-selection");
  const choices=[
    {id:"decline",family:"favour_decline",score:4,matches:2},
    {id:"accept",family:"favour_accept",score:2,matches:1},
    {id:"disliked",family:"work_question",score:-2,matches:2},
    {id:"unknown",family:"season_talk",score:0,matches:1},
    {id:"liked",family:"lands_question",score:1,matches:1},
    {id:"full",family:"family_question",score:4,matches:2,disabled:true}
  ];
  expect(chooseVisibleLine(choices).id).toBe("liked");
  expect(chooseVisibleLine(choices,true).id).toBe("accept");
  expect(chooseVisibleLine(choices.filter(c=>c.id!="liked")).id).toBe("unknown");
  expect(chooseVisibleLine([...choices,{id:"name",family:"introduction",score:0,matches:0}]).id).toBe("name");
  expect(chooseVisibleLine(choices.filter(c=>["decline","accept","full"].includes(c.id)))).toBeUndefined();
});

it("closes an actual spoken Chat with End chat before returning to game-time waits", async () => {
  const {openChat,chatChoices,chooseLine,closeChat}=require("game/chat");
  const {finishChatPanel}=require("../scripts/acceptance-selection");
  const {state:s,player,person}=peopleWorld();
  s.ecs.planner[person].world.feeling={hungry:false,tired:false};
  s.ecs.spatial[person]={...s.ecs.spatial[player]};
  s.game_speed="normal";s.ticker={stop:jest.fn(),start:jest.fn()};
  expect(openChat(s,player,person)).toBe(true);
  const day=s.days,clicks=[];
  s.ui.actions={set_speed:speed=>{s.game_speed=speed;}};
  global.window={tinyking:s,requestAnimationFrame:fn=>fn()};
  const page={
    evaluate:async(fn,arg)=>fn(arg),
    waitForFunction:async(fn,arg)=>expect(fn(arg)).toBe(true),
    locator:selector=>({
      evaluateAll:async()=>chatChoices(s).map(l=>({id:l.id,family:l.family,disabled:false,score:0,matches:0})),
      click:async()=>{const id=selector.match(/data-line-id="([^"]+)"/)[1],line=chatChoices(s).find(l=>l.id==id);clicks.push(line.family);chooseLine(s,line.key);},
      waitFor:async()=>expect(s.chat.active).toBeUndefined()
    }),
    getByRole:(role,options)=>({click:async()=>{expect(role).toBe("button");expect(options.name).toBe("End chat");clicks.push("End chat");closeChat(s);}})
  };
  const result=await finishChatPanel(page,person,{maxLines:1});
  expect(result.selected).toHaveLength(1);expect(result.nativePauseVerified).toBe(true);
  expect(s.ticker.stop).toHaveBeenCalledTimes(1);expect(s.ticker.start).toHaveBeenCalledTimes(1);
  expect(result.contact.day).toBe(day);
  expect(result.history.lines.some(l=>l.speaker=="player" && l.family!="leave_taking")).toBe(true);
  expect(s.days).toBe(day);expect(s.game_speed).toBe("paused");
  expect(clicks.at(-1)).toBe("End chat");expect(s.chat.active).toBeUndefined();
});

it("waits through real delivery progress without extending a stalled favour's timeout", async () => {
  const {waitForFavourDelivery}=require("../scripts/acceptance-selection");
  const r={status:"accepted",progress:1,delivered:0};
  global.window={tinyking:{favours:{requests:{harvest:r}}}};
  const observations=[];
  const page={evaluate:async(fn,arg)=>fn(arg),waitForFunction:async(fn,arg,options)=>{
    observations.push(arg);expect(options.timeout).toBe(180000);
    expect(fn(arg)).toBe(false);
    if(r.delivered==0)r.delivered=5;
    else if(r.progress==1)r.progress=2;
    else r.status="completed";
    expect(fn(arg)).toBe(true);
  }};
  expect((await waitForFavourDelivery(page,"harvest")).status).toBe("completed");
  expect(observations.map(o=>[o.progress,o.delivered])).toEqual([[1,0],[1,5],[2,5]]);
  r.status="accepted";
  page.waitForFunction=async()=>{throw new Error("unchanged physical progress timed out");};
  await expect(waitForFavourDelivery(page,"harvest")).rejects.toThrow("unchanged physical progress timed out");
  r.status="expired";
  await expect(waitForFavourDelivery(page,"harvest")).rejects.toThrow("ended without delivery");
});

it.each([true,false])("waits for NPC readiness without ordering player care, requiring visible slots: %s", async requireSlots => {
  const {waitForChatReadiness}=require("../scripts/acceptance-selection");
  const {s,actor,elder,meal,orders,page}=oathCareWorld(true);
  const before=JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events});
  const previousDocument=global.document;
  global.document={querySelectorAll:()=>requireSlots ? [{textContent:"Chat",disabled:false}] : []};
  try {
    await waitForChatReadiness(page,elder,{requireSlots});
    expect(orders).toEqual([]);
    expect(s.ecs.good[meal]).toMatchObject({type:"forage",amount:1});
    for(const id of [actor,elder])expect(s.ecs.planner[id].world.feeling).toMatchObject({hungry:false,tired:false});
    expect(s.game_speed).toBe("paused");
    expect(JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events})).toBe(before);
  } finally {
    if(previousDocument===undefined)delete global.document;else global.document=previousDocument;
  }
});

it("advances preparation through real normal simulation minutes and leaves chat paused",async()=>{
  const {state:s}=peopleWorld();
  s.ticker={stop:jest.fn(),start:jest.fn()};s.renderer={frame:jest.fn()};
  s.ui.actions={set_speed:speed=>{if(!s.chat?.active)s.game_speed=speed;},end_turn:jest.fn()};
  global.window={tinyking:s,tinykingSettlement:{createSimulation:require("game/simulation").createSimulation}};
  const page={evaluate:async(fn,arg)=>fn(arg)},before=s.days;
  const {advanceTime}=require("../scripts/acceptance-selection");
  const result=await advanceTime(page,60);
  expect(result.steps).toBe(60);expect(s.days-before).toBeCloseTo(1/24,10);
  expect(s.ticker.stop).toHaveBeenCalledTimes(1);expect(s.ticker.start).toHaveBeenCalledTimes(1);
  s.chat={active:{}};s.game_speed="paused";const paused=s.days;
  expect((await advanceTime(page,60)).steps).toBe(0);expect(s.days).toBe(paused);
});
