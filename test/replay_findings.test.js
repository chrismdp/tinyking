import { economy } from "./support/economy";
import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { enqueueTask, expireChatApproach, readyPlayerTasks } from "game/manager";
import { openChat, closeChat, chatChoices, chooseLine, lineCandidates, speakLine, patience } from "game/chat";
import { openingGuidance } from "game/guidance";
import { updateFavours, favourWaiting } from "game/favours";
import { solve } from "game/htn";
import { FOODS } from "game/goods";
import { Hex } from "game/hex";

it("does not plan a successful hungry Find food after all source lookups failed",()=>{
  const {world}=economy();world.days=10.85;world.feeling.hungry=true;
  for(const type of FOODS)for(const prefix of ["container_with ","stockpile_with ","haulable_with "])world.no_place_for[prefix+type]=100;
  world.no_place_for.forage_plant=100;
  const [plan]=solve(world,[],[["ordered_meal"]]);
  expect(plan).toContainEqual(["meal_unavailable"]);
});
it("keeps a failed winter meal visible with a seasonal next step instead of completing hungry",()=>{
  const f=economy(),{s,p,camp}=f;s.days=10.855215416665336;s.intro={active:false};
  s.ecs.container[camp].amounts={};s.ecs.personable[p].hunger=2.791666666666665;
  const job=enqueueTask(s,{key:"find_food"},p);f.step(60);
  expect(s.ecs.manager[p].jobs).toContain(job);
  expect(job.waiting).toMatch(/No accessible meal/);
  expect(job.waiting).toMatch(/Move here/);
  expect(openingGuidance(s).text).toBe(job.waiting);
  expect(openingGuidance(s).action).not.toBe("Find food");
});
it("eats a real remaining root portion in winter without waiting for spring growth",()=>{
  const f=economy(),{s,p,camp,tiles}=f;s.days=10.85;s.ecs.container[camp].amounts={};
  s.ecs.personable[p].hunger=2.79;
  const [root]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},forageable:{kind:"roots",biome:"grassland",amount:1,growth:0}}]);
  enqueueTask(s,{key:"find_food"},p);f.step(180);
  expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
  expect(s.ecs.forageable[root].amount).toBe(0);
});
it("retires the exact approach when chat closes, even before another simulation frame",()=>{
  const {state:s,player:p,person:n,parent}=peopleWorld();
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  const first=enqueueTask(s,{key:"chat"},n),next=enqueueTask(s,{key:"chat"},parent);
  first.assignedId=p;s.ecs.planner[p].world.currentJob="chat";
  openChat(s,p,n);closeChat(s);
  expect(s.ecs.manager[p].jobs).toEqual([next]);
  expect(s.ecs.planner[p].world.currentJob).toBeNull();
});
it("actually ends a timed-out approach and preserves its single reason",()=>{
  const {state:s,player:p,person:n}=peopleWorld();
  const job=enqueueTask(s,{key:"chat"},n);expireChatApproach(s);s.days+=1.1/24;expireChatApproach(s);
  expect(s.ecs.manager[p].jobs).not.toContain(job);
  expect(s.ui.talkResult.message).toBe(job.detail);
  expect(readyPlayerTasks(s)).not.toContain(job);
});
it("knocks on a sleeping neighbour's real door at night and returns without contact",()=>{
  const w=peopleWorld(),{state:s,player:p,person:n,tiles}=w;s.days=1/24;
  const [home]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[3]]},building:{entrance:3},household:{},controllable:{controllerId:n}}]);
  s.ecs.household[n].houseId=home;s.ecs.spatial[n]={...s.ecs.spatial[home]};
  s.ecs.interior={[n]:{buildingId:home}};s.ecs.planner[n].task=["sleep"];s.ecs.planner[n].plan=[];
  s.ecs.personable[n].tiredness=1.5;s.ecs.planner[n].world.feeling.tired=true;
  const before={...s.ecs.spatial[p]},job=enqueueTask(s,{key:"chat"},n);
  expect(s.ecs.manager[p].jobs).toContain(job);
  for(let i=0;i<2500&&!s.ui.talkResult?.message.includes("No answer");i++)w.step(.005);
  expect(s.ecs.manager[p].jobs).not.toContain(job);expect(s.ecs.spatial[p]).not.toEqual(before);
  expect(s.ui.talkResult.message).toMatch(/No answer.*morning/);
  expect(s.ecs.planner[n].world.capturedBy).toBeFalsy();
  expect(s.knowledge?.[p]?.people?.[n]?.conversation).toBeUndefined();
});
it("leads to a concrete shelter after two chats even after arrival day",()=>{
  const {state:s,player:p,person:n,parent,tiles}=peopleWorld();s.intro={active:false};s.days=4.4;
  newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},camp:{},controllable:{controllerId:p}}]);
  s.ecs.playable[p].known=tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  s.knowledge={[p]:{people:{[n]:{conversation:{}},[parent]:{conversation:{}}}}};
  expect(openingGuidance(s)).toMatchObject({key:"shelter",selectId:expect.any(String)});
});
it("turns owned seed into Create Field, Plough and Sow instructions using existing mechanics",()=>{
  const {state:s,player:p,tiles}=peopleWorld();s.intro={active:false};
  s.ecs.playable[p].known=tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  newEntities(s,[{spatial:{...s.ecs.spatial[p]},good:{type:"grain",amount:1},haulable:{},controllable:{controllerId:p}}]);
  expect(openingGuidance(s)).toMatchObject({key:"seed_field",text:expect.stringMatching(/Create Field/),selectId:expect.any(String)});
  const [field]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},farmable:{houseId:s.ecs.household[p].houseId,slots:[{state:"empty"}]},controllable:{controllerId:p}}]);
  expect(openingGuidance(s)).toMatchObject({key:"seed_plough",selectId:field,text:expect.stringMatching(/Plough/)});
  s.ecs.farmable[field].slots[0].state="ploughed";
  expect(openingGuidance(s)).toMatchObject({key:"seed_sow",selectId:field,text:expect.stringMatching(/Sow/)});
});
it("keeps a first introduction personal, but answers an explicit help question with a real request",()=>{
  const {state:s,player:p,person:n,parent,tiles}=peopleWorld();
  const h=tiles[3];s.ecs.controllable[h].controllerId=n;s.ecs.household[parent].houseId="elsewhere";
  s.ecs.household[h]={fields:[],storeId:h};s.ecs.container={[h]:{capacity:20,amounts:{}}};updateFavours(s);
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};openChat(s,p,n);
  chooseLine(s,chatChoices(s).find(l=>l.family=="introduction").key);
  expect(s.chat.active.transcript.some(l=>l.family=="favour_ask")).toBe(false);
  s.chat.active.focus="help";
  chooseLine(s,chatChoices(s).find(l=>l.family=="need_question").key);
  expect(s.chat.active.transcript.some(l=>l.family=="favour_ask")).toBe(true);
  expect(chatChoices(s).some(l=>l.family=="favour_accept")).toBe(true);
});
it("keeps accepted ripe harvests ready when pantry space shrinks",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld(),h=tiles[3];
  s.ecs.household[h]={fields:[],storeId:h};s.ecs.container={[h]:{capacity:10,amounts:{grain:8}}};
  const [field]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[2]]},farmable:{houseId:h,slots:[{state:"harvestable",amount:6}]},controllable:{controllerId:n}}]);
  const r={id:"harvest",status:"accepted",kind:"harvest",householdId:h,targetId:field,actorId:p,progress:0,quantity:1,cargo:[]};s.favours={requests:{harvest:r}};
  expect(favourWaiting(s,{favourId:r.id})).toBeNull();
  expect(s.ecs.container[h]).toMatchObject({capacity:10,amounts:{grain:8}});
});
it("does not call the row full after the closing reply clears its icons",()=>{
  const {state:s,player:p,person:n}=peopleWorld();s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};openChat(s,p,n);
  const c=s.chat.active;c.row=[];c.phase="player_turn";c.finishAfterReply=true;
  chooseLine(s,chatChoices(s).find(l=>l.family=="introduction").key);
  expect(c.row.length).toBeLessThan(patience(s,p,n).max);
  expect(c.endReason).not.toBe("row_full");
});
it("cannot complete a meal order using a stale fed planner flag",()=>{
  const {s,p,world}=economy();s.ecs.personable[p].hunger=2.79;world.feeling.hungry=false;
  const order=enqueueTask(s,{key:"find_food"},p);order.assignedId=p;
  expect(require("game/tasks").complete_job(s,p,world,0,true,"find_food")).toBe(require("game/htn").Task.ABORT);
  expect(s.ecs.manager[p].jobs).toContain(order);
});
it("does not promote an unfinished meal's planner effects when tiredness changes",()=>{
  const f=economy(),{s,p,world}=f;s.ecs.personable[p].hunger=2;
  enqueueTask(s,{key:"find_food"},p);
  for(let minute=0;minute<60 && s.ecs.planner[p].task?.[0]!="eat";minute++)f.step(1);
  expect(s.ecs.planner[p].task[0]).toBe("eat");
  s.ecs.personable[p].tiredness=1;world.feeling.tired=false;
  f.step(1);
  expect(s.ecs.personable[p].hunger).toBeGreaterThan(.9);
  expect(world.feeling.hungry).toBe(true);
  f.step(65);
  expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
});
it("leads home after the first completed favour even with only one acquaintance",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};s.days=4.4;
  newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},camp:{},controllable:{controllerId:p}}]);
  s.ecs.playable[p].known=tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  s.knowledge={[p]:{people:{[n]:{conversation:{}}}}};s.favours={requests:{done:{actorId:p,status:"completed"}}};
  expect(openingGuidance(s)).toMatchObject({key:"shelter",selectId:expect.any(String)});
});
it("retains the actual failed harvest stage instead of a generic supply failure",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld(),h=tiles[3];
  s.ecs.household[h]={storeId:h,fields:[]};s.ecs.container={[h]:{capacity:100,amounts:{}}};
  const [field]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[5]]},farmable:{houseId:h,slots:[{state:"harvestable",amount:6}]},controllable:{controllerId:n}}]);
  const r={id:"harvest",status:"accepted",kind:"harvest",giverId:n,householdId:h,targetId:field,actorId:p,progress:0,quantity:1,cargo:[]};s.favours={requests:{harvest:r}};
  const task=enqueueTask(s,{key:"favour"},field,{favourId:r.id});task.assignedId=p;
  for(const id of tiles)s.ecs.walkable[id].neighbours={};
  expect(require("game/tasks").do_favour(s,p,s.ecs.planner[p].world,1/1440,true,r.id)).toBe(require("game/htn").Task.ABORT);
  expect(task.failureReason).toMatch(/route.*harvest patch.*blocked/i);
});
it("replaces a timed-out Chat hint with one concrete movement order",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};
  s.ecs.playable[p].known=tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  const job=enqueueTask(s,{key:"chat"},n);expireChatApproach(s);s.days+=1.1/24;expireChatApproach(s);
  const hint=openingGuidance(s);
  expect(hint).toMatchObject({key:"move_closer",job:"move_to_here",targetId:expect.any(String)});
  enqueueTask(s,{key:hint.job},hint.targetId);
  expect(s.ui.talkResult).toBeUndefined();
  expect(openingGuidance(s).key).toBe("moving");
  expect(s.ecs.manager[p].jobs).not.toContain(job);
});
it("removes a failed meal order once its alternative supplies a real meal",()=>{
  const f=economy(),{s,p,camp}=f;s.days=10.85;s.ecs.container[camp].amounts={};s.ecs.personable[p].hunger=2.79;
  const job=enqueueTask(s,{key:"find_food"},p);f.step(60);expect(job.failed).toBe(true);
  const [food]=newEntities(s,[{spatial:{...s.ecs.spatial[p]},good:{type:"forage",amount:1},haulable:{},controllable:{controllerId:p}}]);
  require("game/holder").give(s.ecs,food,p);f.step(150);
  expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
  expect(s.ecs.manager[p].jobs).not.toContain(job);
});
