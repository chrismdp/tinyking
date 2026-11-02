import { community, attach } from "./support/travel";
import { planJourney, journeyRoute, stopJourney, updateJourney, completeTravel, acceptTravel } from "game/travel";
import { skipIntro } from "game/intro";
import { createSimulation } from "game/simulation";
import { serialiseGame, restoreGame } from "game/save_game";
import { Hex } from "game/hex";

it("plans adjacent land hops without generating maps, rejects ocean and disconnected routes", () => {
  const {s}=community();
  const before=Object.keys(s.travel.maps);
  expect(journeyRoute(s,"7,5")).toEqual(["5,5","6,5","7,5"]);
  expect(planJourney(s,"7,5")).toBe(true);
  expect(Object.keys(s.travel.maps)).toEqual(before);
  expect(s.travel.journey.route).toEqual(["6,5","7,5"]);
  expect(s.ecs.manager[s.ui.playerId].jobs[0]).toMatchObject({destination:"6,5",side:0,detail:expect.stringContaining("2 seasons remain")});
  s.world.hexes.find(h=>h.x==7&&h.y==5).ocean=true;
  expect(journeyRoute(s,"7,5")).toBeNull();
  expect(planJourney(s,"7,5")).toBe(false);
  expect(s.travel.journey.route).toHaveLength(2);
  for (const e of Object.values(s.map.entrances)) e.blocked=true;
  s.map.entrances={};
  expect(journeyRoute(s,"6,5")).toBeNull();
});

it("arrives at dawn through the matching edge, then walks the middle hex with one road-ageing step per hop", async () => {
  const {s,ids}=community();
  attach(s,community({namespace:"middle-",key:"6,5",player:false}).s);
  const end=community({namespace:"end-",key:"6,5",player:false}).s;
  end.map.worldKey="7,5";end.world.home={x:7,y:5};attach(s,end);
  s.ecs.playable[ids[0]].arrivedAt=s.days;
  const life=s.ecs.personable[ids[0]].lifeYears;
  expect(planJourney(s,"7,5")).toBe(true);
  const first=s.ecs.manager[ids[0]].jobs[0];
  await completeTravel(s,first);
  expect(s.travel.active).toBe("6,5");
  expect(s.days%1).toBeCloseTo(.25);
  expect(s.ecs.personable[ids[0]].lifeYears).toBeCloseTo(life+.25);
  expect(s.intro.points[0]).toEqual(s.map.entrances[3].start);
  expect(s.travel.journey.route).toEqual(["7,5"]);
  skipIntro(s); updateJourney(s);
  const second=s.ecs.manager[ids[0]].jobs[0];
  expect(second).toMatchObject({destination:"7,5",targetId:s.map.entrances[0].tileIds[0],detail:expect.stringContaining("1 season remains")});
  expect(Hex().fromPoint(s.ecs.spatial[ids[0]]).distance(Hex().fromPoint(s.ecs.spatial[second.targetId]))).toBeGreaterThan(5);
  await completeTravel(s,second);
  expect(s.travel.active).toBe("7,5");
  expect(s.days%1).toBeCloseTo(.25);
  expect(s.ecs.personable[ids[0]].lifeYears).toBeCloseTo(life+.5);
  expect(s.travel.journey).toBeNull();
});

it("stops and changes course in a middle hex, and queue cancellation stops the remaining journey", async () => {
  const {s}=community();attach(s,community({namespace:"b-",key:"6,5",player:false}).s);
  planJourney(s,"7,5"); await completeTravel(s,s.ecs.manager[s.ui.playerId].jobs[0]);skipIntro(s);
  stopJourney(s);updateJourney(s);
  expect(s.travel.journey).toBeNull();expect(s.ecs.manager[s.ui.playerId].jobs).toEqual([]);
  expect(planJourney(s,"5,5")).toBe(true);
  expect(s.ecs.manager[s.ui.playerId].jobs[0].side).toBe(3);
  const {cancelTask}=require("game/manager");cancelTask(s,s.ecs.manager[s.ui.playerId].jobs[0].id);updateJourney(s);
  expect(s.travel.journey).toBeNull();
});

it("persists the remaining route and one resident copy through a mid-journey reload", async () => {
  const {s}=community();attach(s,community({namespace:"b-",key:"6,5",player:false}).s);
  planJourney(s,"7,5");await completeTravel(s,s.ecs.manager[s.ui.playerId].jobs[0]);skipIntro(s);updateJourney(s);
  const restored=restoreGame(serialiseGame(s));updateJourney(restored);
  expect(restored.travel.journey.route).toEqual(["7,5"]);
  expect(restored.ecs.manager[restored.ui.playerId].jobs).toHaveLength(1);
  expect(Object.values(restored.travel.maps).filter(m=>m.residents[restored.ui.playerId])).toHaveLength(1);
});

it("camps at the actual exhausted position, sits until bedtime and resumes the same route at dawn", () => {
  const {s,ids}=community();planJourney(s,"7,5");s.days=.84;s.ecs.personable[ids[0]].energy=0;
  const point={...s.ecs.spatial[ids[0]]};updateJourney(s);
  const camp=s.travel.journey.campId;
  expect(s.ecs.spatial[camp]).toMatchObject({x:point.x,y:point.y});
  expect(s.ecs.camp[camp]).toBeDefined();expect(s.ecs.sleepable[camp].capacity).toBe(1);
  const simulation=createSimulation(s);simulation.step(10*(1), 0);
  expect(s.ecs.spatial[ids[0]]).toEqual(point);
  expect(s.ecs.planner[ids[0]].task?.[0]).toBe("settle_fire");
  const restored=restoreGame(serialiseGame(s));
  restored.days=1.25;restored.ecs.personable[ids[0]].energy=60;updateJourney(restored);
  expect(restored.travel.journey.campId).toBeUndefined();
  expect(restored.ecs.camp[camp]).toBeUndefined();
  expect(restored.ecs.manager[ids[0]].jobs).toHaveLength(1);
});

it("uses the same planned-hop contract for the existing edge invitation", () => {
  const {s}=community();expect(acceptTravel(s,s.map.entrances[0].tileIds[0])).toBe(true);
  expect(s.travel.journey.route).toEqual(["6,5"]);
});

it("runs only the current hex live between seasonal history steps", async () => {
  const {s}=community();const away=community({namespace:"away-",key:"6,5",player:false}).s;
  const snapshot=attach(s,away), before=JSON.stringify(snapshot);
  const simulation=createSimulation(s);
  for(let i=0;i<90;i++)await simulation.step(10*(1), 0);
  expect(s.days).toBeGreaterThan(.375);
  expect(JSON.stringify(snapshot)).toBe(before);
  expect(s.travel.historyCalls).toEqual([]);
});

it("rests overnight at a journey camp without accumulating negative tiredness", () => {
  const {s,ids}=community();planJourney(s,"7,5");s.days=.84;s.ecs.personable[ids[0]].energy=0;updateJourney(s);
  const {sleep}=require("game/tasks"),id=ids[0],planner=s.ecs.planner[id];
  sleep(s,id,planner.world,1/2);
  expect(s.ecs.personable[id].tiredness).toBe(.1);
});

it("keeps other queued local work when the remaining journey is stopped", () => {
  const {s,tiles}=community();planJourney(s,"7,5");
  const {enqueueTask}=require("game/manager");
  const local=enqueueTask(s,{key:"move_to_here"},tiles[0]);
  stopJourney(s);
  expect(s.ecs.manager[s.ui.playerId].jobs).toEqual([local]);
});
it('keeps travelling at dusk and makes camp on exhaustion without returning to a distant home',()=>{
 const {s,ids}=community();const a=ids[0];s.ecs.personable[a].energy=50;
 planJourney(s,'6,5');s.days=.75;
 require('game/energy').playerDay(s);updateJourney(s);
 expect(s.ecs.planner[a].world.duskHome).toBeUndefined();
 expect(s.travel.journey.campId).toBeUndefined();
 s.ecs.personable[a].energy=0;updateJourney(s);
 expect(s.travel.journey.campId).toBeTruthy();
 expect(s.ecs.planner[a].world.journeyCamp).toBe(true);
});
it('sleeps on the journey bedroll rather than a distant household bed',()=>{
 const {s,ids}=community();const a=ids[0],p=s.ecs.personable[a];
 p.energy=0;planJourney(s,'6,5');s.days=.75;updateJourney(s);p.energy=20;
 const w=s.ecs.planner[a].world;
 s.ecs.sleepable.homeBed={capacity:2,occupiers:[]};w.restBed='homeBed';
 require('game/tasks').sleep(s,a,w,1/24,true);
 expect(w.places.sleep).toBe(s.travel.journey.campId);
 expect(p.energy).toBe(28);
});
it('finishes forced rest after a full night at the journey camp before packing',()=>{
 const {s,ids}=community();const a=ids[0],person=s.ecs.personable[a];
 person.energy=0;person.collapsed=true;planJourney(s,'6,5');s.days=.75;updateJourney(s);
 const w=s.ecs.planner[a].world;w.forcedRest=true;
 for(let hour=0;hour<12;hour++){s.days=.75+hour/24;require('game/tasks').sleep(s,a,w,1/24,hour==0);}
 expect(w.forcedRest).toBe(true);
 s.days=1.25;updateJourney(s);
 expect(w.forcedRest).toBeUndefined();expect(person.collapsed).toBeUndefined();
 expect(person.energy).toBe(55);expect(s.travel.journey.campId).toBeUndefined();
 expect(s.ecs.manager[a].jobs[0].job.key).toBe('travel');
});
