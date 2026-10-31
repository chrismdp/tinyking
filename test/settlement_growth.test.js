import { repairHouseholds } from "game/possessions";
import { trade_work } from "game/tasks";
import { HOUR } from "game/time";
import { treeAllowed } from "game/tree_clearance";
import { newEntities } from "game/entities";
import * as geography from "game/geography";
import * as villages from "game/villages";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { addBidirectionalLink } from "game/pathfinding";
import { settleSeason, constructHome } from "game/settlement";
import { recordProduction, recordMeetingUse } from "game/settlement_growth";
import { historyStep } from "game/social";

function fixture() {
  const s = { ecs: { nextId: 1, personable: {}, building: {}, household: {}, controllable: {}, village: {}, playable: {} }, peopleSeed:13,opinionThresholds:{hate:-100,love:100},days: 0, map:{entrances:{},playerStartTile:{x:0,y:0},worldKey:"fixture"}, space: {}, redraws: [], events: [], villages: { v: { id: "v", houses: [], sharedPlaces: [] } }, settlement: { version: 1, lastSeason: -1, journeys: [], appliedJourneys: {}, sites: {} } };
  const hexes = Grid.hexagon({ center: Hex(4,4), radius: 4 });
  const tiles = newEntities(s, hexes.map(h => ({ spatial: { ...h.toPoint(), immovable: true }, mappable: { terrain: "grassland", elevation: 20, temperature: "temperate" }, walkable: { speed: 1, neighbours: {}, worn: {} } })));
  const tileByHex = Object.fromEntries(hexes.map((h,i)=>[String(h),tiles[i]]));
  for (const h of hexes) Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).forEach((n,side)=>{ if(tileByHex[n])addBidirectionalLink(s.ecs,tileByHex[h],side,tileByHex[n]); });
  const people = newEntities(s, [0,1].map(i=>({ spatial: {...Hex(4,4).toPoint()}, personable:{age:30}, holder:{held:[],capacity:2}, controllable:{}, kinship:{parents:[],children:[],spouse:null}, personality:{traits:["hard-working"],likes:[],dislikes:[]}, relationships:{known:{}}, household:{}, village:{villageId:"v"}, nameable:{nickname:"Founder "+i} })));
  for(const id of people)s.ecs.controllable[id].controllerId=id;
  s.settlement.sites.v = [{ point: Hex(4,4).toPoint(), entrance: 1 }, { point:Hex(6,4).toPoint(),entrance:1 }];
  const house=constructHome(s,"v",people,{ founding:true, timber:20 });
  delete s.settlement.layoutDirty;
  return {s,house,people,tiles};
}

it("builds only after material and spatial reservations succeed and keeps ownership and real stores", () => {
  const {s,house,people}=fixture();
  expect(house).toBeTruthy();
  expect(s.ecs.household[people[0]].houseId).toBe(house);
  const store=s.ecs.household[house].storeId;
  expect(s.ecs.container[store].amounts.wood).toBe(8);
  expect(s.ecs.controllable[house].controllerId).toBe(people[0]);
  const count=Object.keys(s.ecs.building).length;
  expect(constructHome(s,"v",people,{timber:0})).toBeNull();
  expect(Object.keys(s.ecs.building)).toHaveLength(count);
});

it("grows a productive occupied home and adjacent workshop in stages, and consumes real materials once", () => {
  const {s,house,people}=fixture();
  const h=s.ecs.household[house], store=s.ecs.container[h.storeId];
  store.amounts.wood=80; store.amounts.grain=60;
  const [work]=newEntities(s,[{spatial:{...Hex(5,3).toPoint(),immovable:true},workplace:{houseId:house,trade:"carpenter"},controllable:{controllerId:house},village:{villageId:"v"}}]);
  h.workplaceId=work; h.trade="carpenter";
  for(let season=0;season<8;season++) {
    s.days=season*3;
    recordProduction(s,work,people[0],"planks",2);
    settleSeason(s,season,false);
  }
  expect(s.ecs.growth[house].stage).toBe(2);
  expect(s.ecs.growth[work].stage).toBe(2);
  const before=JSON.stringify(s);
  settleSeason(s,7,false);
  expect(JSON.stringify(s)).toBe(before);
  expect(store.amounts.wood).toBeLessThan(80);
  expect(s.ecs.growth[house].additions).toHaveLength(2);
  expect(s.ecs.building[house].rooms.every(id=>s.ecs.controllable[id].controllerId==house)).toBe(true);
  expect(s.ecs.treeClearance[house].halfDepth).toBeGreaterThan(30.1);
});

it("leaves unsupported, empty, blocked and poor households small", () => {
  for(const kind of ["poor","empty","blocked","unsupported"]) {
    const {s,house,people}=fixture(), h=s.ecs.household[house];
    const store=s.ecs.container[h.storeId];
    store.amounts.wood=kind=="poor"?0:80; store.amounts.grain=60;
    if(kind=="empty")for(const id of people)s.ecs.personable[id].dead=true;
    if(kind=="blocked")newEntities(s,[{spatial:{...s.ecs.spatial[house],y:s.ecs.spatial[house].y-53,immovable:true},workplace:{houseId:"other",trade:"weaver"}}]);
    for(let season=0;season<6;season++) {
      s.days=season*3;
      if(kind!="unsupported")recordProduction(s,house,people[0],"grain",6);
      settleSeason(s,season,false);
    }
    expect(s.ecs.growth[house].stage).toBe(0);
  }
});

it("expands a pub from actual meetings and keeps summary catch-up immutable and once only", () => {
  const {s,house,people}=fixture();
  const [pub]=newEntities(s,[{spatial:{...Hex(2,4).toPoint(),immovable:true},meetingPlace:{kind:"alehouse",houseId:house},controllable:{controllerId:house},village:{villageId:"v"}}]);
  s.villages.v.sharedPlaces.push(pub);
  s.ecs.container[s.ecs.household[house].storeId].amounts.wood=80;
  for(let season=1;season<=4;season++) {
    s.days=season*3-.2;
    for(const p of people)recordMeetingUse(s,pub,p);
    s.days=season*3;
    settleSeason(s,season,false);
  }
  expect(s.ecs.growth[pub].stage).toBeGreaterThan(0);
  const before=JSON.stringify(s);
  const next=historyStep(s,5);
  expect(JSON.stringify(s)).toBe(before);
  const replay=historyStep(next,5);
  expect(replay).toEqual(next);
});


it("expands through completed trade work across actual seasonal boundaries", () => {
  const {s,house,people}=fixture(), h=s.ecs.household[house], store=s.ecs.container[h.storeId];
  store.amounts.wood=80;store.amounts.grain=60;
  const [work]=newEntities(s,[{spatial:{...Hex(5,3).toPoint(),immovable:true},workplace:{houseId:house,trade:"weaver"},controllable:{controllerId:house},village:{villageId:"v"}}]);
  h.workplaceId=work;h.trade="weaver";
  s.ecs.spatial[people[0]]={...s.ecs.spatial[work]};
  const initialOwner=s.ecs.controllable[house].controllerId, rooms=[...s.ecs.building[house].rooms];
  for(let period=0;period<8;period++) {
    s.days=period*3+.5;
    trade_work(s,people[0],{ordered:false},HOUR/2,true,work);
    s.days=(period+1)*3;settleSeason(s,period+1,false);
  }
  expect(s.ecs.growth[house].stage).toBe(2);
  expect(s.ecs.growth[work].stage).toBe(2);
  expect(s.ecs.controllable[house].controllerId).toBe(initialOwner);
  expect(s.ecs.building[house].rooms).toEqual(rooms);
  expect(s.ecs.sleepable[rooms[0]].capacity).toBe(10);
  expect(s.ecs.container[h.storeId].amounts.wood).toBe(48);
  const rear={x:s.ecs.spatial[house].x,y:s.ecs.spatial[house].y-70};
  expect(treeAllowed(s,rear)).toBe(false);
});

it("keeps a full store within capacity during summary harvest and preserves the uncollected crop", () => {
  const {s,house}=fixture(),h=s.ecs.household[house],store=s.ecs.container[h.storeId];
  store.capacity=20;store.amounts={grain:19};
  const [field]=newEntities(s,[{spatial:{...Hex(5,4).toPoint(),immovable:true},farmable:{houseId:house,slots:[{state:"harvestable",amount:6,content:"grain",growth:4.5}]},controllable:{controllerId:house}}]);
  h.fields=[field];s.days=3;settleSeason(s,1,true);
  expect(Object.values(store.amounts).reduce((n,v)=>n+v,0)).toBeLessThanOrEqual(20);
  expect(s.ecs.farmable[field].slots[0].state).toBe("harvestable");
});


it("keeps a grown cottage out of an unbuilt household's surveyed space without spending its materials",()=>{
  const {s,house,people}=fixture();
  s.ecs.container[s.ecs.household[house].storeId].amounts.wood=40;
  s.settlement.sites.v[1].establishSeason=4;
  s.settlement.sites.v.push({point:Hex(6,5).toPoint(),entrance:1,unsurveyed:true});
  expect(constructHome(s,"v",people)).toBeNull();
  expect(s.ecs.container[s.ecs.household[house].storeId].amounts.wood).toBe(40);
  expect(s.villages.v.houses).toEqual([house]);
});

it("preserves the arrival camp clearance when an established household builds another home",()=>{
  const {s,house,people}=fixture();
  s.map.playerStartTile={x:6,y:4};
  s.settlement.sites.v[1].unsurveyed=true;
  const store=s.ecs.container[s.ecs.household[house].storeId];
  store.amounts.wood=40;
  expect(constructHome(s,"v",people)).toBeNull();
  expect(store.amounts.wood).toBe(40);
  expect(s.villages.v.houses).toEqual([house]);
});

it("plans a grown home's safe surface once and applies that same plan after paying",()=>{
  const {s,house,people}=fixture();
  s.villages.v.centre={x:4,y:4};
  s.settlement.sites.v=s.settlement.sites.v.slice(0,1);
  s.map.geography={version:1,routes:[],heights:{}};
  for(const tile of Object.keys(s.ecs.mappable))for(const corner of Hex().corners()) {
    const p=s.ecs.spatial[tile];s.map.geography.heights[Math.round((p.x+corner.x)*1000)+","+Math.round((p.y+corner.y)*1000)]=20;
  }
  const store=s.ecs.container[s.ecs.household[house].storeId];store.amounts.wood=40;
  const plan=jest.spyOn(geography,"shelterSurface");
  try {
    expect(constructHome(s,"v",people)).toBeTruthy();
    expect(plan).toHaveBeenCalledTimes(1);
    expect(s.map.geography).toBe(plan.mock.results[0].value);
    expect(store.amounts.wood).toBe(28);
  } finally {plan.mockRestore();}
});

it("does not repeat a failed historical field layout until its real spatial inputs change",()=>{
  const {s,house}=fixture();
  s.generatingHistory=true;s.settlement.estatesInitialized=true;
  // A legacy incomplete estate has no recorded field proposal. Test its
  // unchanged-input retry policy without removing a constructed crop entity.
  delete s.ecs.household[house].fieldReservation;
  for(const tile of Object.values(s.ecs.mappable))tile.route=[0,1,2,3,4,5];
  const layout=jest.spyOn(villages,"generateVillageLife");
  try {
    s.days=3;settleSeason(s,1,false);
    expect(s.ecs.household[house].fields).toHaveLength(0);
    s.days=6;settleSeason(s,2,false);
    expect(layout).toHaveBeenCalledTimes(1);
    s.landUseRevision=(s.landUseRevision || 0)+1;
    s.days=9;settleSeason(s,3,false);
    expect(layout).toHaveBeenCalledTimes(2);
  } finally {layout.mockRestore();}
});


it("requires the same real forge fuel during summary work as live work",()=>{
  for(const wood of [0,1]) {
    const {s,house}=fixture(),h=s.ecs.household[house],store=s.ecs.container[h.storeId];
    store.amounts={grain:60,wood};
    const [work]=newEntities(s,[{spatial:{...Hex(5,3).toPoint(),immovable:true},workplace:{houseId:house,trade:"smith"},controllable:{controllerId:house},village:{villageId:"v"}}]);
    h.workplaceId=work;h.trade="smith";s.days=3;
    settleSeason(s,1,true);
    expect(s.ecs.growth[work].production).toBe(wood?2:0);
    expect(s.ecs.container[h.storeId].amounts.wood).toBe(0);
    if(wood)expect(s.ecs.workplace[work].fuelHours).toBe(3.5);
  }
});


it("does not add beds for deceased or remote records, while a real large household still fits",()=>{
  const {s,house,people}=fixture(),bed=s.ecs.building[house].rooms[0];
  s.residents=Object.fromEntries(people.map(id=>[id,true]));
  newEntities(s,Array.from({length:12},()=>({personable:{age:80,dead:true},household:{houseId:house}})));
  const [remote]=newEntities(s,[{personable:{age:30},household:{houseId:house}}]);
  s.residents[remote]=false;
  repairHouseholds(s);
  expect(s.ecs.sleepable[bed].capacity).toBe(6);
  const children=newEntities(s,Array.from({length:6},()=>({personable:{age:8},household:{houseId:house},controllable:{controllerId:people[0]}})));
  for(const id of children)s.residents[id]=true;
  repairHouseholds(s);
  const occupants=[...people,...children].length;
  expect(s.ecs.sleepable[bed].capacity).toBeGreaterThanOrEqual(occupants);
});


it("records the actual return trips needed to bring a tree's wood home in two working hands",()=>{
  const {s,house}=fixture(),store=s.ecs.container[s.ecs.household[house].storeId];
  store.amounts={wood:0,grain:60};
  const [tree]=newEntities(s,[{spatial:{...Hex(5,4).toPoint(),immovable:true},good:{type:"wood",amount:3}}]);
  s.days=3;settleSeason(s,1,true);
  const trip=s.settlement.journeys.find(j=>j.reason=="household timber");
  expect(trip.count).toBe(2);
  expect(store.amounts.wood).toBe(3);
  expect(s.ecs.good[tree]).toBeUndefined();
});


it("collects needed timber before optional harvest fills the household store",()=>{
  const {s,house}=fixture(),h=s.ecs.household[house],store=s.ecs.container[h.storeId];
  store.capacity=20;store.amounts={wood:0,grain:14};
  const [tree]=newEntities(s,[{spatial:{...Hex(5,4).toPoint(),immovable:true},good:{type:"wood",amount:3}}]);
  const [field]=newEntities(s,[{spatial:{...Hex(5,5).toPoint(),immovable:true},farmable:{houseId:house,slots:[{state:"harvestable",content:"grain",amount:6,growth:4.5}]},controllable:{controllerId:house}}]);
  h.fields=[field];s.days=3;settleSeason(s,1,true);
  expect(store.amounts.wood).toBe(3);
  expect(s.ecs.good[tree]).toBeUndefined();
  expect(s.ecs.farmable[field].slots[0].state).toBe("harvestable");
  expect(Object.values(store.amounts).reduce((n,v)=>n+v,0)).toBeLessThanOrEqual(20);
});

it("requires a real field before spending a new household's construction timber",()=>{
  const {s,house,people}=fixture(),store=s.ecs.container[s.ecs.household[house].storeId];
  expect(s.ecs.household[house].fieldReservation).toBeDefined();
  store.amounts.wood=40;
  for(const tile of Object.values(s.ecs.mappable))tile.terrain="stone";
  s.settlement.sites.v[1].point=Hex(7,4).toPoint();
  expect(constructHome(s,"v",people)).toBeNull();
  expect(store.amounts.wood).toBe(40);
  expect(s.villages.v.houses).toEqual([house]);
});

it("cannot collect the same physical timber twice across households in one summary season",()=>{
  const {s,house}=fixture();
  const people=newEntities(s,[0,1].map(()=>({spatial:{...Hex(6,4).toPoint()},personable:{age:30},household:{},controllable:{}})));
  for(const id of people)s.ecs.controllable[id].controllerId=id;
  const other=constructHome(s,"v",people,{timber:20});
  expect(other).toBeTruthy();
  for(const home of [house,other])s.ecs.container[s.ecs.household[home].storeId].amounts={wood:0,grain:60};
  const [tree]=newEntities(s,[{spatial:{...Hex(6,5).toPoint(),immovable:true},good:{type:"wood",amount:3}}]);
  s.days=3;settleSeason(s,1,true);
  const wood=[house,other].reduce((n,home)=>n+(s.ecs.container[s.ecs.household[home].storeId].amounts.wood || 0),0);
  expect(wood).toBe(3);
  expect(s.ecs.good[tree]).toBeUndefined();
  expect(s.settlement.journeys.filter(j=>j.reason=="household timber")).toHaveLength(1);
});
