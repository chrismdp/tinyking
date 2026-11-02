/* global it, expect, require, jest */
import { rollHexContents, generateWorldHistory, summarySeason } from "game/world_history";
import { generateWorld } from "game/overworld";
import { community } from "./support/travel";
import { ensureMap } from "game/travel";
import { serialiseGame, restoreGame } from "game/save_game";
let historyFixture;
const history=async()=>{
 if(!historyFixture){const s=fresh(),world={home:{x:5,y:3},hexes:[{x:5,y:3},{x:6,y:3},{x:8,y:2}].map(h=>({...community().s.world.hexes[0],...h}))},updates=[];await generateWorldHistory(s,13,async(label,value)=>updates.push({label,value}),world);historyFixture={s,world,updates};}
 return {s:restoreGame(serialiseGame(historyFixture.s)),world:historyFixture.world,updates:historyFixture.updates};
};
const fresh=()=>({ecs:{nextId:1},space:{},redraws:[],days:.375,ui:{show:{}},game_speed:"paused"});
it("rolls biome contents deterministically, including wilderness, villages, towns and optional roads",()=>{
  const kinds=new Set(),roads=new Set();
  for(let seed=0;seed<80;seed++)for(const biome of ["grassland","desert","taiga"]){
    const h={x:2,y:3,biome};const c=rollHexContents(seed,h);
    expect(c).toEqual(rollHexContents(seed,h));expect(c.discoveries).toHaveLength(1);
    kinds.add(c.kind);roads.add(c.roads);
    if(c.kind==="town")expect(c.settlements).toHaveLength(1);
    if(c.kind==="villages")expect(c.settlements.length).toBeGreaterThan(1);
  }
  expect([...kinds].sort()).toEqual(["empty","town","villages"]);expect(roads.size).toBe(2);
  expect(rollHexContents(13,{x:1,y:2,biome:"desert"},true).settlements.length).toBeGreaterThan(0);
});
it("generates all 180 seasons together, with cross-place people and no detailed terrain",async()=>{
  const {s,world,updates}=await history();
  expect(Object.keys(s.travel.maps).sort()).toEqual(world.hexes.filter(h=>!h.ocean).map(h=>h.x+","+h.y).sort());
  expect(updates.filter(u=>u.label.startsWith("Forty-five years"))).toHaveLength(180);
  expect(s.travel.season).toBe(0);
  expect(s.travel.transit.every(trip=>trip.due>s.days)).toBe(true);
  expect(Object.values(s.travel.maps).every(m=>m.compact&&!m.ecs.mappable&&!m.ecs.walkable&&!m.ecs.planner&&!m.map.geography)).toBe(true);
  for(const map of Object.values(s.travel.maps))if(Object.keys(map.ecs.building).length)expect(map.events.some(e=>e.type==="birth")).toBe(true);
  const events=Object.values(s.travel.events);
  expect(events.some(e=>e.type==="birth")).toBe(true);
  expect(events.some(e=>e.type==="world_visit"||e.type==="world_move")).toBe(true);
  for(const id of Object.keys(s.travel.people))expect(Object.values(s.travel.maps).filter(m=>m.residents[id]).length+s.travel.transit.filter(t=>t.bundle.id===id).length).toBeLessThanOrEqual(1);
  const map=Object.values(s.travel.maps).find(m=>Object.keys(m.residents).length);
  const before=serialiseGame(map);summarySeason(map,1);expect(map.social.lastSeason).toBe(1);expect(serialiseGame(map)).not.toBe(before);
  const once=serialiseGame(map);summarySeason(map,1);expect(serialiseGame(map)).toBe(once);
});
it("builds an arrival from stored history without running history again",async()=>{
  const {s}=await history();
  s.world=generateWorld(13);
  const key=s.travel.active, summary=s.travel.maps[key], ids=Object.keys(summary.residents),events=summary.events.map(e=>e.id);
  const replay=jest.spyOn(require("game/history"),"generateHistory");
  const map=await ensureMap(s,key);
  expect(replay).not.toHaveBeenCalled();replay.mockRestore();
  expect(map.compact).toBeFalsy();expect(Object.keys(map.ecs.mappable).length).toBeGreaterThan(100);
  expect(ids.every(id=>map.ecs.personable[id])).toBe(true);
  expect(map.events.map(e=>e.id)).toEqual(expect.arrayContaining(events));
  expect(map.historyGenerationMs).toBeUndefined();
  delete s.compact;Object.assign(s,map);s.ui.playerId=Object.keys(s.ecs.playable)[0];s.personName=id=>id;
  await require("game/travel").advanceWorldClock(s);
  require("game/new_game").startGame(s,{skip:true});
  for(const id of Object.keys(s.ecs.planner))if(s.residents[id]&&!s.ecs.personable[id].dead)expect(()=>require("game/manager").jobQueueFor(s.ecs,id)).not.toThrow();
  await require("game/simulation").createSimulation(s).step(1,0);
  expect(Object.keys(s.residents).filter(id=>!s.ecs.personable[id].dead && (!Number.isFinite(s.ecs.spatial[id]?.x)||!Number.isFinite(s.ecs.spatial[id]?.y)))).toEqual([]);
  expect(restoreGame(serialiseGame(s)).travel.season).toBe(0);
});
it("does not reveal an unvisited compact community as a visited world hex",()=>{
 const {reachFacts}=require("game/realm_map"),{community,attach}=require("./support/travel");
 const {s}=community(),away=attach(s,community({namespace:"away-",key:"6,5",player:false}).s);
 s.travel.maps["6,5"]={...away,compact:true};
 expect(reachFacts(s,s.world.hexes.find(h=>h.x===6&&h.y===5)).visited).toBe(false);
});
it("prepares the interior table for travellers in a hex with no households",()=>{
 const {installStoredHistory}=require("game/world_history"),{SUMMARY_COMPONENTS}=require("game/community_summary"),s=fresh();
 s.map={playerStartTile:{x:22,y:2},entrances:{}};s.ecs.spatial={};s.ecs.mappable={};
 const summary={ecs:Object.fromEntries(SUMMARY_COMPONENTS.map(k=>[k,{}])),residents:{},events:[],knowledge:{},social:{lastSeason:0},villages:{}};
 installStoredHistory(s,summary,{}, {discoveries:["ruins"]},true);
 expect(s.ecs.interior).toEqual({});
});
it("advances a founded household harvest through the light season",()=>{
  const {s,house}=community(),{newEntities}=require("game/entities");
  delete s.ecs.building[house];s.ecs.shelter={[house]:{id:house,stage:"house"}};
  const [store]=newEntities(s,[{container:{amounts:{grain:10}},controllable:{controllerId:house}}]);
  s.ecs.household[house].storeId=store;s.ecs.household[house].summaryFields=1;
  summarySeason(s,2);
  expect(s.ecs.container[store].amounts.grain).toBeGreaterThan(10);
  expect(s.events.some(e=>e.type==="harvest"&&e.items.includes(house))).toBe(true);
});

it("builds identical physical detail now or after a later approach with the same seed and world history", async () => {
  const { captureDetailOrigins, prepareDetail } = require("game/hex_detail");
  const { s } = await history();
  s.world = generateWorld(13);
  s.ui.playerId = "traveller";
  captureDetailOrigins(s);
  const before = restoreGame(serialiseGame(s));
  const key = "6,3";
  const early = await prepareDetail(s, key);
  before.days += 21;
  before.world = { ...before.world, home: { x: 6, y: 2 } };
  const later = await prepareDetail(before, key);
  expect(later).toEqual(early);
  expect(early.ecs.mappable).toBeDefined();
  expect(early.map.geography).toBeDefined();
  expect(Object.keys(early.ecs.building).length).toBeGreaterThan(0);
});
