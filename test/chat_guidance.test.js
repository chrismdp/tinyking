/* global it, expect, require */
import { peopleWorld } from "./support/people";
import { openingGuidance } from "game/guidance";
it("keeps one concrete conversation hint after the first contact and after opening progress is dismissed",()=>{
  const {state:s,player,person,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.playable[player].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  expect(openingGuidance(s)).toMatchObject({key:"chat",targetId:expect.any(String)});
  s.knowledge={[player]:{people:{[person]:{conversation:{day:s.days}}},feelings:{}}};s.guidance={[player]:{opening:{dismissed:true,seen:[]}}};
  expect(openingGuidance(s)).toMatchObject({key:"chat", targetId:expect.any(String)});
});
it("names the real meal that delays a queued conversation",()=>{
  const {state:s,player,person}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.manager[player].jobs=[{job:{key:"chat"},targetId:person}];
  s.ecs.planner[person].world.feeling.hungry=true;
  expect(openingGuidance(s).key).toBe("waiting_meal");
});

it("gives chat guidance while the world is paused for chat",()=>{
  const {state:s,player:p}=peopleWorld();s.intro={active:false};s.game_speed="paused";
  s.ecs.manager[p].jobs=[{job:{key:"chat"}}];s.chat={active:{npcId:"someone"}};
  expect(openingGuidance(s).key).toBe("chat_open");
});

it("offers another available neighbour when the nearest person is unfriendly",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  s.ecs.spatial[n]={...s.ecs.spatial[p],x:s.ecs.spatial[p].x+40};
  s.ecs.relationships[n].known[p]={ring:"public",goodwill:-3,base:0};
  const hint=openingGuidance(s);
  expect(hint.targetId).toBeDefined();expect(hint.targetId).not.toBe(n);
  expect(require("game/manager").chatUnavailable(s,p,hint.targetId)).toBeNull();
});

it("offers a free neighbour instead of chasing the nearest walker",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  s.ecs.spatial[n]={...s.ecs.spatial[p],x:s.ecs.spatial[p].x+40};
  s.ecs.planner[n].task=["walk_to",tiles[5]];
  expect(openingGuidance(s).targetId).toBeDefined();
  expect(openingGuidance(s).targetId).not.toBe(n);
});

it.each(["blocked", "slow"])("does not offer a nearby chat without a short reachable route: %s", reason=>{
  const {state:s,player:p,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  for(const t of tiles)if(reason=="blocked")s.ecs.walkable[t].neighbours={};else s.ecs.walkable[t].speed=.1;
  expect(openingGuidance(s).targetId).toBeUndefined();
});

it("does not describe a personal promise or set-aside delivery as running work",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};s.days=1.4;
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  s.knowledge={[p]:{people:{},favours:["ask"]}};
  s.favours={requests:{ask:{id:"ask",actorId:p,giverId:n,targetId:n,kind:"word",status:"accepted"}}};
  expect(openingGuidance(s).key).not.toBe("working");
  s.favours.requests.ask.kind="food";expect(openingGuidance(s).key).not.toBe("working");
  s.ecs.manager[p].jobs=[{job:{key:"favour"},favourId:"ask"}];expect(openingGuidance(s).key).toBe("working");
  s.favours.requests.ask.status="expired";expect(openingGuidance(s).key).not.toBe("working");
});
it("updates a failed approach message when the neighbour is available again",()=>{
  const {state:s,player:p,person:n}=peopleWorld();
  const {enqueueTask,chatResultMessage}=require("game/manager");
  s.ecs.planner[n].task=["sleep"];enqueueTask(s,{key:"chat"},n);
  expect(chatResultMessage(s,n)).toBeTruthy();
  s.ecs.planner[n].task=null;s.ecs.planner[n].world.feeling={};
  expect(chatResultMessage(s,n)).toBeNull();
});

it.each(["paused", "normal"])("guides the current walk without offering speed controls at %s speed", speed => {
  const {state:s, player:p, tiles} = peopleWorld();
  s.intro = { active: false };
  s.ui.show = {};
  s.game_speed = speed;
  s.ecs.manager[p].jobs = [{ job: { key: "move_to_here" }, targetId: tiles[1] }];
  expect(openingGuidance(s)).toEqual({ actorId: p, key: "moving", text: "Let your character finish walking to the selected ground." });
});
