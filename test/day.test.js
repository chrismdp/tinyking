import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { Hex } from "game/hex";
import { slotChoices, playSlot, currentSlot } from "game/day";

function village() {
  const w=peopleWorld(),s=w.state;
  s.ecs.playable[w.player].known=w.tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  Object.assign(s.villages.village,{id:"village",centre:{x:3,y:0},houses:[],sharedPlaces:[]});
  s.ecs.meetingPlace={};s.ecs.interior={};s.ecs.building={};
  const [camp]=newEntities(s,[{spatial:{...s.ecs.spatial[w.player]},camp:{},sleepable:{capacity:1,occupiers:[]},
    container:{capacity:100,amounts:{grain:10}},controllable:{controllerId:w.player}}]);
  return {...w,camp};
}
const choice=(s,activity,id)=>slotChoices(s).choices.find(c=>c.activity==activity&&c.personId==id&&c.available);

it("lists discovered places and people with honest activity reasons without teaching hidden facts", () => {
  const w=village(),s=w.state;
  s.ecs.playable[w.player].known=[Hex().fromPoint(s.ecs.spatial[w.player])];
  const before=JSON.stringify(s.knowledge);
  expect(slotChoices(s).choices.some(c=>c.personId==w.person)).toBe(false);
  s.ecs.playable[w.player].known=w.tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  const choices=slotChoices(s);
  expect(choices.places.length).toBe(w.tiles.length);
  expect(choices.choices.find(c=>c.activity=="work"&&c.personId==w.person)).toMatchObject({available:false,reason:expect.any(String)});
  expect(JSON.stringify(s.knowledge)).toBe(before);
});

it("refuses invented or unavailable choices without advancing time", async () => {
  const w=village(),s=w.state,day=s.days;
  await expect(playSlot(s,{id:"invented"})).rejects.toThrow(/choice/i);
  const work=slotChoices(s).choices.find(c=>c.activity=="work");
  await expect(playSlot(s,work)).rejects.toThrow(work.reason);
  expect(s.days).toBe(day);
});

it("walks into a real chat, lets the callback choose authored lines and returns learned facts and regard", async () => {
  const w=village(),s=w.state;let calls=0;
  const result=await playSlot(s,choice(s,"talk",w.person),{chooseLine:(game,lines)=>{calls++;return lines.find(l=>!l.risk)?.key;}});
  expect(calls).toBeGreaterThan(0);
  expect(s.chat.history.some(c=>c.npcId==w.person&&c.lines.some(l=>l.speaker=="player"))).toBe(true);
  expect(s.social.contacts[[w.player,w.person].sort().join(":")]).toBeDefined();
  expect(result.facts.length).toBeGreaterThan(0);
  expect(result.regard).toEqual(expect.any(Array));
  expect(currentSlot(s).slot).toBe("afternoon");
  expect(s.days).toBeCloseTo(.5,8);
});

it("gives actual food from the player's store and returns only events the player knows", async () => {
  const w=village(),s=w.state;
  const result=await playSlot(s,choice(s,"give_food",w.person));
  expect(result.events.some(e=>e.type=="gift"&&e.people.includes(w.person))).toBe(true);
  expect(s.ecs.container[w.camp].amounts.grain).toBe(9);
  expect(result.events.every(e=>!e.sealed)).toBe(true);
});

it("runs three slots and sleeps through the real night to the next morning", async () => {
  const w=village(),s=w.state;
  for(let n=0;n<3;n++)await playSlot(s,choice(s,"talk",w.person)||slotChoices(s).choices.find(c=>c.available));
  expect(currentSlot(s).slot).toBe("morning");
  expect(s.days).toBeCloseTo(1.25,8);
  expect(s.ui.dayMessage).toMatch(/Morning/);
});

it("continues through the season boundary with the existing ageing rules", async () => {
  const w=village(),s=w.state;
  s.days=6.75;s.social={lastSeason:0,courtships:{},avoidance:{}};
  s.ecs.playable[w.player].arrivedAt=0;
  const age=s.ecs.personable[w.person].age;
  const result=await playSlot(s,choice(s,"talk",w.person));
  expect(s.days).toBeCloseTo(7.25,8);
  expect(s.ecs.personable[w.person].age).toBe(age+2);
  expect(result.slot).toBe("evening");
});

it("completes real offered harvest work and stores its real grain", async () => {
  const w=village(),s=w.state;
  const [house,store,field]=newEntities(s,[
    {spatial:{...s.ecs.spatial[w.tiles[3]]},building:{rooms:[]},household:{fields:[],farming:true},controllable:{controllerId:w.person}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},container:{amounts:{grain:20},capacity:100},controllable:{controllerId:w.person}},
    {spatial:{...s.ecs.spatial[w.tiles[4]]},farmable:{slots:[{state:"harvestable",content:"grain",amount:2}]},controllable:{controllerId:w.person}}
  ]);
  Object.assign(s.ecs.household[house],{storeId:store,fields:[field]});s.ecs.farmable[field].houseId=house;
  for(const id of [w.person,w.parent,w.sibling]) {
    s.ecs.household[id].houseId=house;
    s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];
  }
  require("game/favours").updateFavours(s);
  const r=Object.values(s.favours.requests).find(r=>r.kind=="harvest");
  // Initial fixture: the household already made this real offer in person.
  s.knowledge ||= {};s.knowledge[w.player]={people:{[w.person]:{conversation:{day:s.days}}},favours:[r.id],offers:{[r.id]:{speakerId:w.person,day:s.days}}};
  const result=await playSlot(s,choice(s,"work",w.person));
  expect(r.status).toBe("completed");
  expect(s.ecs.container[store].amounts.grain).toBe(21);
  expect(r.gleaned).toHaveLength(1);
  expect(s.ecs.good[r.gleaned[0]].amount).toBe(1);
  expect(s.ecs.controllable[r.gleaned[0]].controllerId).toBe(w.player);
  expect(result.events.some(e=>e.type=="favour")).toBe(true);
});


it("turns a chosen introduction into real contact and a courtship, without skipping the wait or housing", async () => {
  const w=village(),s=w.state,a=w.person,b=w.parent;
  for(const [id,other] of [[a,b],[b,a]]) {
    s.ecs.personable[id].age=28;s.ecs.nameable[id].male=false;
    s.ecs.personality[id].orientation="both";s.ecs.kinship[id]={parents:[],children:[]};
    s.ecs.relationships[id].known[w.player]={ring:"personal",goodwill:45};
    s.ecs.relationships[id].known[other]={ring:"personal",goodwill:40};
    s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];
  }
  const c=slotChoices(s).choices.find(c=>c.activity=="introduce"&&c.available&&[a,b].includes(c.personId)&&[a,b].includes(c.otherId));
  const result=await playSlot(s,c);
  expect(result.outcomes).toContainEqual({kind:"introduce",requested:true,reason:null});
  expect(s.social.contacts[[a,b].sort().join(":")]).toBeDefined();
  expect(s.social.courtships[[a,b].sort().join(":")]).toEqual(expect.any(Number));
  expect(s.events.some(e=>e.type=="marriage"&&e.people.includes(a))).toBe(false);
});

it("lets the player visit discovered ground when no neighbour can meet, with real walking discovery", async () => {
  const w=village(),s=w.state;
  s.ecs.playable[w.player].known=w.tiles.slice(0,2).map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  const c=slotChoices(s).choices.find(c=>c.activity=="visit"&&c.placeId==w.tiles[1]);
  expect(c).toBeDefined();
  await playSlot(s,c);
  expect(s.ecs.playable[w.player].known.length).toBeGreaterThan(2);
});

it("ends the default conversation when only already-spoken fallback lines remain", () => {
  const w=village(),s=w.state;
  s.chat={active:{actorId:w.player,npcId:w.person,usedIds:["fallback"],row:[]}};
  expect(require("game/day").sensibleLine(s,[{id:"fallback",key:"fallback",icons:[]}])).toBeUndefined();
});

it("checks food offers from one consistent inventory snapshot per choice query, then refreshes after stores change", () => {
  const w=village(),s=w.state;
  const [house,store]=newEntities(s,[
    {spatial:{...s.ecs.spatial[w.tiles[3]]},building:{rooms:[]},household:{fields:[]},controllable:{controllerId:w.person}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},container:{amounts:{grain:0},capacity:100},controllable:{controllerId:w.person}}
  ]);
  s.ecs.household[house].storeId=store;s.ecs.household[w.person].houseId=house;
  s.ecs.spatial[w.player]={...s.ecs.spatial[w.person]};
  require("game/favours").updateFavours(s);
  const r=Object.values(s.favours.requests).find(r=>r.kind=="food");
  require("game/chat").openChat(s,w.player,w.person);
  let scans=0;
  s.ecs.good=new Proxy(s.ecs.good || {},{ownKeys:target=>{scans++;return Reflect.ownKeys(target);}});
  const first=require("game/chat").chatChoices(s);
  expect(scans).toBeLessThanOrEqual(1);
  const same=require("game/chat").chatChoices(s);
  expect(same.map(l=>l.key)).toEqual(first.map(l=>l.key));
  s.ecs.container[store].amounts.grain=100;
  expect(require("game/favours").reasonGone(s,r)).toMatch(/food need is already met/);
});

it("chooses a line that fits the real conversation row", () => {
  const w=village(),s=w.state;
  s.chat={active:{actorId:w.player,npcId:w.person,usedIds:[],row:["work","food","family","season","village","faith"].map(key=>({kind:"topic",key}))}};
  const unfit={id:"intro",key:"intro",family:"introduction",icons:[{kind:"topic",key:"help"},{kind:"topic",key:"woodland"}]};
  const fit={id:"work",key:"work",icons:[{kind:"topic",key:"work"}]};
  expect(require("game/chat").previewLine(s,unfit).fits).toBe(false);
  expect(require("game/day").sensibleLine(s,[unfit,fit])).toBe("work");
});

it("gathers real food near a chosen place, which the player can then give", async () => {
  const w=village(),s=w.state;
  const plants=newEntities(s,[1,2,3].map(n=>({spatial:{...s.ecs.spatial[w.tiles[n%w.tiles.length]],immovable:true},
    forageable:{kind:"roots",biome:"grassland",amount:1,growth:0}})));
  const gather=slotChoices(s).choices.find(c=>c.activity=="forage"&&c.available);
  expect(gather).toBeDefined();
  await playSlot(s,gather);
  expect(plants.filter(id=>s.ecs.forageable[id].amount==0).length).toBeGreaterThanOrEqual(1);
  const loose=Object.keys(s.ecs.good).filter(id=>s.ecs.good[id].type=="roots").length;
  expect(loose+(s.ecs.container[w.camp].amounts.roots||0)).toBeGreaterThanOrEqual(1);
});

it("delivers the player's own food to a household whose request they accepted, even while the asker rests", async () => {
  const w=village(),s=w.state;
  const [house,store,roots]=newEntities(s,[
    {spatial:{...s.ecs.spatial[w.tiles[3]]},building:{rooms:[]},household:{fields:[]},controllable:{controllerId:w.person}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},container:{amounts:{grain:0},capacity:100},controllable:{controllerId:w.person}},
    {spatial:{...s.ecs.spatial[w.camp]},good:{type:"roots",amount:1},haulable:{},controllable:{controllerId:w.player}}
  ]);
  s.ecs.household[house].storeId=store;s.ecs.household[w.person].houseId=house;
  s.ecs.container[w.camp].amounts.grain=0;
  const favours=require("game/favours");
  favours.updateFavours(s);
  const r=Object.values(s.favours.requests).find(r=>r.kind=="food");
  // Initial fixture: the household asked in person and the player said yes earlier.
  s.knowledge ||= {};s.knowledge[w.player]={people:{[w.person]:{conversation:{day:s.days}}},favours:[r.id],offers:{[r.id]:{speakerId:w.person,day:s.days}}};
  expect(favours.acceptFavour(s,r.id,w.person)).toBeTruthy();
  // The promise outlasts the night: evening sets the work aside, not the request.
  s.days=0.75;
  await playSlot(s,slotChoices(s).choices.find(c=>c.activity=="visit"&&c.available));
  expect(r.status).toBe("accepted");
  s.ecs.planner[w.person].world.feeling.tired=true;
  const deliver=choice(s,"work",w.person);
  expect(deliver).toBeDefined();
  await playSlot(s,deliver);
  expect(s.ecs.container[store].amounts.roots||0).toBeGreaterThanOrEqual(1);
  expect(s.ecs.good[roots]?.amount||0).toBe(0);
});
