import { community, attach } from "./support/travel";
import { slotChoices, playSlot, currentSlot, sensibleLine } from "game/day";
import { it, expect } from "@jest/globals";
import { neighbours, worldKey } from "game/travel_geometry";
import { Hex } from "game/hex";
import { attachPeople } from "game/person_storage";
import { serialiseGame, restoreGame, replaceGame } from "game/save_game";
import { recordEvent } from "game/events";
import { compactMap } from "game/community_summary";
import { applyPreparedDetail } from "game/hex_detail";
import { departNpc } from "game/travel";

function roadWorld() {
  const w=community(),s=w.s;
  s.ecs.playable[w.ids[0]].known=w.tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  s.ecs.playable[w.ids[0]].arrivedAt=0;
  const next=worldKey(neighbours(s.world.home)[0]);
  const away=community({key:next,namespace:"away-",player:false});
  attach(s,away.s);
  return {...w,next,away};
}
const travel=(s,to,personId=null)=>slotChoices(s).choices.find(c=>c.activity=="travel" && c.destination==to && c.personId==personId);
const onward=s=>slotChoices(s).choices.find(c=>c.activity=="continue_travel");
async function hop(s,to,personId=null,hooks) {
  const results=[await playSlot(s,travel(s,to,personId),hooks)];
  results.push(await playSlot(s,onward(s),hooks));
  results.push(await playSlot(s,onward(s),hooks));
  return results;
}

it("offers exactly the neighbouring land passes and lists nightfall as unavailable", async()=>{
  const {s,next}=roadWorld();
  const sea=worldKey(neighbours(s.world.home)[1]);
  s.world.hexes.find(h=>worldKey(h)==sea).ocean=true;
  delete s.map.entrances[2];
  const choices=slotChoices(s).choices.filter(c=>c.activity=="travel");
  expect(choices).toHaveLength(4);
  expect(choices.every(c=>c.available && c.label.startsWith("Travel to "))).toBe(true);
  expect(travel(s,next)).toBeDefined();
  s.days=.5;expect(travel(s,next).available).toBe(true);
  s.days=.75;
  expect(travel(s,next)).toMatchObject({available:false,reason:"You cannot set out at nightfall"});
  await expect(playSlot(s,travel(s,next))).rejects.toThrow("You cannot set out at nightfall");
  expect(s.days).toBe(.75);
});

it.each([[.25,"morning",1.25],[.5,"afternoon",1.5]])("spends three road parts after setting out at %s and arrives in the same part next day",async(start,part,end)=>{
  const {s,next,ids}=roadWorld();s.days=start;
  const results=await hop(s,next);
  expect(results.map(r=>r.slot)).toEqual(part=="morning"?["morning","afternoon","evening"]:["afternoon","evening","morning"]);
  expect(results.every(r=>r.road.from=="5,5" && r.road.to==next && r.road.weather.type && r.road.lines.length)).toBe(true);
  expect(results.find(r=>r.slot=="evening").road.camp).toBe(true);
  expect(results[0].road.arrived).toBe(false);
  expect(results[2].road.arrived).toBe(true);
  expect(results[0].seen.some(o=>o.personId==ids[0] && o.activity=="walk_to")).toBe(true);
  expect(s.days).toBeCloseTo(end,8);
  expect(currentSlot(s).slot).toBe(part);
  expect(s.travel.active).toBe(next);
  expect(Hex().fromPoint(s.ecs.spatial[ids[0]]).toString()).toBe(Hex().fromPoint(s.map.entrances[3].campPoint).toString());
});

it("keeps home detail and returns in six parts and two days without a season of ageing",async()=>{
  const {s,next,ids,house}=roadWorld();s.days=.25;
  const age=ids.map(id=>s.ecs.personable[id].age);
  s.ecs.household[house].keptDetail="work already done";
  const results=[...await hop(s,next),...await hop(s,"5,5")];
  expect(results).toHaveLength(6);expect(s.days).toBeCloseTo(2.25,8);
  expect(s.travel.active).toBe("5,5");
  expect(s.ecs.household[house].keptDetail).toBe("work already done");
  expect(ids.map(id=>s.ecs.personable[id].age)).toEqual(age);
  expect(s.travel.historyCalls).toEqual([]);
});

it("includes the real walk to a distant pass within the chosen departure part",async()=>{
  const {s,next,ids}=roadWorld();s.days=.5-1/1440;
  const results=await hop(s,next);
  expect(results[0].seen.some(o=>o.personId==ids[0] && o.activity=="walk_to")).toBe(true);
  expect(results.map(r=>r.slot)).toEqual(["morning","afternoon","evening"]);
  expect(s.days).toBeCloseTo(1.25,8);
});

it("opens a new valley with its people on detailed ground before the return walk",()=>{
  const {s,next,away}=roadWorld(),detail=away.s,summary=compactMap(detail),npc=away.ids[1];
  summary.ecs.spatial={...summary.ecs.spatial,[npc]:{id:npc,x:-10000,y:-10000}};
  const expected={...detail.ecs.spatial[npc]};
  const opened=applyPreparedDetail(s,next,detail,summary);
  expect(opened.ecs.spatial[npc]).toEqual(expected);
  expect(opened.space[Hex().fromPoint(opened.ecs.spatial[npc])]).toBeDefined();
});

it("records a genuine departure from an away valley without a renderer queue",()=>{
  const {s,next,ids}=roadWorld();
  s.settlement={journeys:[],appliedJourneys:{}};delete s.redraws;
  departNpc(s,ids[1],{to:next,side:0});
  expect(s.travel.transit.some(t=>t.bundle.id==ids[1] && t.to==next)).toBe(true);
  expect(s.settlement.journeys.some(j=>j.people.includes(ids[1]))).toBe(true);
});

it("steps every community once when the road crosses a season boundary",async()=>{
  const {s,next,ids,away}=roadWorld();s.days=6.5;
  const ages=[s.ecs.personable[ids[0]].age,s.ecs.personable[ids[1]].age,away.s.ecs.personable[away.ids[1]].age];
  await hop(s,next);
  expect(s.days).toBeCloseTo(7.5,8);expect(s.travel.season).toBe(1);
  expect([s.ecs.personable[ids[0]].age,s.travel.maps["5,5"].ecs.personable[ids[1]].age,s.ecs.personable[away.ids[1]].age]).toEqual(ages.map(a=>a+2));
  expect(s.travel.historyCalls).toEqual(expect.arrayContaining([{key:"5,5",season:1,kind:"away"},{key:next,season:1,kind:"away"}]));
});

it.each([false,true])("offers only a real same-way departure (returning %s) and shares three real chats and arrival",async returning=>{
  const {s,next,ids}=roadWorld(),companion=ids[1];s.days=.25;
  expect(travel(s,next,companion)).toBeUndefined();
  if(returning)s.travel.visits[companion]={home:next,arrived:-3,household:{houseId:null},village:{villageId:null}};
  s.ecs.planner[companion].world.worldJourney={to:next,side:0,tileId:s.map.entrances[0].tileIds[0],returning};
  const another=ids[2];
  s.ecs.planner[another].world.worldJourney={to:worldKey(neighbours(s.world.home)[1]),side:1,tileId:s.map.entrances[1].tileIds[0]};
  expect(travel(s,next,companion)).toMatchObject({available:true,label:expect.stringContaining("Travel with Person 1")});
  expect(travel(s,next,another)).toBeUndefined();
  let calls=0;
  const results=await hop(s,next,companion,{chooseLine:(game,lines)=>{calls++;return sensibleLine(game,lines);}});
  expect(calls).toBeGreaterThanOrEqual(3);
  expect(results.every(r=>r.conversations.some(c=>c.personId==companion && c.lines.some(l=>l.speaker=="player")))).toBe(true);
  expect(s.residents[companion]).toBe(true);expect(s.travel.transit.some(t=>[ids[0],companion].includes(t.bundle.id))).toBe(false);
  expect(s.ecs.personable[companion].age).toBe(25);
  expect(s.ecs.spatial[companion]).toMatchObject(s.map.entrances[3].campPoint);
  expect(!!s.travel.visits[companion]).toBe(!returning);
});

it("resumes the remaining road parts after a save in a world with canonical people",async()=>{
  const {s,next,ids}=roadWorld();s.days=6.5;
  s.travel.wholeWorld=true;s.travel.localPeople=true;
  for(const map of [s,...Object.values(s.travel.maps)])attachPeople(map,s.travel);
  await playSlot(s,travel(s,next));
  const loaded={};replaceGame(loaded,restoreGame(serialiseGame(s)));
  const results=[await playSlot(loaded,onward(loaded)),await playSlot(loaded,onward(loaded))];
  expect(results.map(r=>r.road.part)).toEqual([2,3]);
  expect(loaded.days).toBeCloseTo(7.5,8);
  expect(loaded.travel.active).toBe(next);
  expect(loaded.ecs.personable[ids[0]].age).toBe(27);
  expect(loaded.travel.maps["5,5"].ecs.personable[ids[1]].age).toBe(27);
});

it.each([false,true])("keeps distinct real event identities across road parts and later journeys (canonical people %s)",async canonical=>{
  const {s,next,ids}=roadWorld();s.days=.25;
  if(canonical) {
    s.travel.wholeWorld=true;s.travel.localPeople=true;
    for(const map of [s,...Object.values(s.travel.maps)])attachPeople(map,s.travel);
  }
  const eventIds=[];
  async function journey(to) {
    s.ecs.planner[ids[1]].world.worldJourney={to,side:to==next?0:3,tileId:s.map.entrances[to==next?0:3].tileIds[0]};
    const results=await hop(s,to,ids[1],{chooseLine:(game)=>{
      if(!game.chat.active.transcript.some(l=>l.speaker=="player")) {
        const event=recordEvent(game,"quarrel",[ids[0],ids[1]],[],{});eventIds.push(event.id);
      }
      return null;
    }});
    expect(results.every(r=>r.events.some(e=>e.type=="quarrel"))).toBe(true);
  }
  await journey(next);await journey("5,5");
  expect(eventIds).toHaveLength(6);
  expect(new Set(eventIds).size).toBe(6);
});
