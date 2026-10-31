import { buildingFootprint } from "game/tree_clearance";
import * as settlements from "game/settlement";
import * as landUse from "game/land_use";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";
import { addBidirectionalLink, removeBidirectionalLink } from "game/pathfinding";
import { constructHome, reserveFoundingFields } from "game/settlement";
import { generateVillageLife } from "game/villages";
import { expansionFits, expandedFootprint } from "game/settlement_growth";

function viableVillage(count,beforeSurvey=()=>{},build=true,beforeLife=()=>{}) {
  const centre=Hex(10,10), hexes=Grid.hexagon({center:centre,radius:8});
  const s={ecs:{nextId:1,building:{},personable:{},household:{},controllable:{},village:{},playable:{},container:{},good:{},farmable:{},pasture:{},profession:{},planner:{}},space:{},redraws:[],events:[],days:0,peopleSeed:13,opinionThresholds:{hate:-100,love:100},map:{seed:13,centre:{x:10,y:10},radius:8,worldKey:"fixture",entrances:{},playerStartTile:{x:0,y:0},geography:{version:1,heights:{},routes:[]}},villages:{v:{id:"v",name:"Initial viable village",centre:{x:10,y:10},houses:[],sharedPlaces:[]}},settlement:{version:1,sites:{v:[]},journeys:[],appliedJourneys:{}}};
  for(const h of hexes)for(const corner of Hex().corners()) {
    const p=h.toPoint();s.map.geography.heights[Math.round((p.x+corner.x)*1000)+","+Math.round((p.y+corner.y)*1000)]=20;
  }
  const tiles=newEntities(s,hexes.map(h=>({spatial:{...h.toPoint(),immovable:true},mappable:{terrain:"grassland",elevation:20,temperature:"temperate"},walkable:{speed:1,worn:{},neighbours:{}}})));
  const at=Object.fromEntries(hexes.map((h,i)=>[String(h),tiles[i]]));
  for(const h of hexes)Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).forEach((n,side)=>{if(at[n])addBidirectionalLink(s.ecs,at[h],side,at[n]);});
  const sites=[];
  for(const h of Grid.hexagon({center:centre,radius:3}).sort((a,b)=>centre.distance(b)-centre.distance(a) || a.x-b.x || a.y-b.y))if(sites.length<count && sites.every(other=>other.distance(h)>=2))sites.push(h);
  expect(sites).toHaveLength(count);
  s.settlement.sites.v=sites.map(h=>({point:h.toPoint(),entrance:1,establishSeason:0}));
  beforeSurvey(s);
  if(!build)return s;
  reserveFoundingFields(s);
  expect(Object.keys(s.ecs.building)).toHaveLength(0);
  expect(Object.keys(s.ecs.personable)).toHaveLength(0);
  for(let i=0;i<count;i++) {
    const people=newEntities(s,[true,false].map(male=>({spatial:{...sites[i].toPoint()},personable:{age:30,male},holder:{held:[],capacity:2},controllable:{},household:{},village:{villageId:"v"},kinship:{parents:[],children:[],spouse:null},relationships:{known:{}},personality:{traits:[],likes:[],dislikes:[]},planner:{world:{}},nameable:{nickname:"Initial household "+i}})));
    for(const id of people)s.ecs.controllable[id].controllerId=id;
    // Real initial construction budget: 12 home + 4 workshop + 8 venue.
    expect(constructHome(s,"v",people,{founding:i==0,timber:24})).toBeTruthy();
  }
  beforeLife(s);
  generateVillageLife(s,13,s.map.playerStartTile);
  return s;
}

it.each([3,4,5,6,7,8])("generates actual owned trades and adult workers in a viable %s-household fixture",count=>{
  const s=viableVillage(count),v=s.villages.v;
  expect(v.houses).toHaveLength(count);
  for(const house of v.houses) {
    const h=s.ecs.household[house];
    expect(h.fields.length).toBeGreaterThanOrEqual(1);
    for(const id of h.fields) {
      expect(s.ecs.mappable[s.ecs.farmable[id].accessTileId].cropPlot).not.toBe(true);
      expect(s.ecs.farmable[id].houseId).toBe(house);
    }
  }
  const trades=v.houses.map(id=>s.ecs.household[id]).filter(h=>h.trade);
  expect(trades).toHaveLength(Math.min(6,count-2));
  expect(new Set(trades.map(h=>h.trade)).size).toBe(trades.length);
  for(const h of trades) {
    const worker=Object.values(s.ecs.profession).find(p=>p.houseId==h.id);
    expect(s.ecs.personable[worker.id].age).toBeGreaterThanOrEqual(18);
    expect(s.ecs.workplace[worker.workplaceId].trade).toBe(h.trade);
    expect(s.ecs.workplace[worker.workplaceId].houseId).toBe(h.id);
    expect(s.ecs.controllable[worker.workplaceId].controllerId).toBe(h.id);
    expect(h.plot.hexes).toContain(String(Hex().fromPoint(s.ecs.spatial[worker.workplaceId])));
    expect(s.ecs.treeClearance[worker.workplaceId]).toBeDefined();
  }
});

it.each([3,5,8])("keeps the garden and fields beside an accessible work station with room for its first bay (%s homes)",count=>{
  const s=viableVillage(count),h=Object.values(s.ecs.household).find(h=>h.workplaceId && expansionFits(s,h.workplaceId,expandedFootprint(s,h.workplaceId,1)));
  expect(h.fields.length).toBeGreaterThan(0);
  expect(h.backyards.length).toBeGreaterThan(0);
  expect(expansionFits(s,h.workplaceId,expandedFootprint(s,h.workplaceId,1))).toBe(true);
  for(const tile of h.workYardTiles)expect(s.ecs.mappable[tile].cropPlot).not.toBe(true);
});

it("reserves full native station and garden footprints without taking hypothetical annex land",()=>{
  const s=viableVillage(5);
  for(const site of s.settlement.sites.v) {
    expect(site.yardTiles).toHaveLength(2);
    expect(site.workYardTiles).toEqual([]);
    const h=s.ecs.household[site.usedBy];
    expect(h.stationPoint).toEqual(site.stationPoint);
    expect(h.backyards.length).toBeGreaterThanOrEqual(1);
    expect(h.backyards.length).toBeLessThanOrEqual(2);
    if(h.workplaceId)expect(s.ecs.spatial[h.workplaceId]).toMatchObject(site.stationPoint);
    const roof=buildingFootprint({ecs:{spatial:{station:site.stationPoint},workplace:{station:{}}}},"station");
    expect(roof.halfWidth).toBe(31);expect(roof.halfDepth).toBe(45);
    for(const x of [-31,31])for(const y of [-45,45])expect(Hex().fromPoint({x:roof.x+x,y:roof.y+y}).toString()).toBe(Hex().fromPoint(site.yardPoint).toString());
    const next=expandedFootprint({ecs:{spatial:{station:site.stationPoint},workplace:{station:{}}}},"station",1);
    const depth=(next.halfDepth-roof.halfDepth)*2;
    for(const x of [-19,19])for(const y of [-45,-45-depth])expect(Hex().fromPoint({x:roof.x+x,y:roof.y+y}).toString()).toBe(Hex().fromPoint(site.yardPoint).toString());
  }
});

it("preserves another owner's standing timber when an optional second garden has no permitted parcel",()=>{
  const protectedTrees=[];
  const s=viableVillage(5,()=>{},true,state=>{
    const [owner]=newEntities(state,[{controllable:{}}]);state.ecs.controllable[owner].controllerId=owner;
    for(const site of state.settlement.sites.v) {
      const centre=Hex().fromPoint(site.yardPoint);
      for(const hex of Grid.hexagon({center:centre,radius:1}).neighborsOf(centre,ALL_SIDES)) {
        const tile=state.space[hex]?.find(id=>state.ecs.mappable[id]);
        if(!tile || !landUse.canReserveWorkYard(state,tile,site.usedBy) || state.ecs.mappable[tile].buildingPlot)continue;
        protectedTrees.push(...newEntities(state,[{spatial:{...hex.toPoint(),immovable:true},tree:{stage:"mature"},good:{type:"wood",amount:1},controllable:{controllerId:owner}}]));
      }
    }
  });
  expect(protectedTrees.length).toBeGreaterThan(0);
  for(const id of protectedTrees) {
    expect(s.ecs.good[id]).toMatchObject({type:"wood",amount:1});
    expect(s.ecs.tree[id]).toBeDefined();
    const hex=Hex().fromPoint(s.ecs.spatial[id]).toString();
    expect(Object.keys(s.ecs.backyard).some(g=>Hex().fromPoint(s.ecs.spatial[g]).toString()==hex)).toBe(false);
  }
});

it("clears actual green and well footprints and keeps them out of crops and private yards",()=>{
  const s=viableVillage(5);
  for(const id of s.villages.v.sharedPlaces.filter(id=>["green","well"].includes(s.ecs.meetingPlace[id].kind))) {
    const tile=s.space[Hex().fromPoint(s.ecs.spatial[id])].find(t=>s.ecs.mappable[t]);
    expect(s.ecs.mappable[tile].cropPlot).not.toBe(true);
    expect(s.ecs.mappable[tile].buildingPlot).toBeUndefined();
    expect(s.ecs.treeClearance[id]).toBeDefined();
  }
});

it("keeps every real field accessible when engineered road reservation is infeasible",()=>{
  const road=jest.spyOn(landUse,"reserveRoad").mockReturnValue(false);
  try {
    const s=viableVillage(3);
    expect(s.villages.v.houses).toHaveLength(3);
    expect(Object.keys(s.ecs.personable)).toHaveLength(6);
    for(const id of s.villages.v.houses) {
      expect(s.ecs.growth[id].construction.timber).toBe(12);
      for(const field of s.ecs.household[id].fields) {
        const f=s.ecs.farmable[field];
        expect(f.accessKind).toBe("foot");
        expect(s.ecs.mappable[f.accessTileId].fieldLane).toBe(true);
        const origin=s.space[Hex().fromPoint(s.ecs.spatial[id])].find(t=>s.ecs.mappable[t]);
        expect(require("game/pathfinding").path(s,origin,f.accessTileId)).not.toBeNull();
      }
    }
  } finally {road.mockRestore();}
});

it("reassigns a genuinely inaccessible proposal before people, preserving public reservations and construction costs",()=>{
  const original=landUse.reserveRoad,originalFoot=landUse.reserveFieldLane;let blockedDoor,oldRoad,originalPad,absent,remaining;
  const road=jest.spyOn(landUse,"reserveRoad").mockImplementation((s,tiles)=>{
    if(!blockedDoor) {
      expect(Object.keys(s.ecs.personable)).toHaveLength(0);
      expect(Object.keys(s.ecs.building)).toHaveLength(0);
      blockedDoor=tiles[0];
      expect(Object.values(s.ecs.walkable[blockedDoor].neighbours).some(n=>original(s,[blockedDoor,n]))).toBe(true);
      oldRoad=[...s.ecs.mappable[blockedDoor].route];
    }
    return tiles[0]==blockedDoor?false:original(s,tiles);
  });
  const foot=jest.spyOn(landUse,"reserveFieldLane").mockImplementation((s,tiles)=>tiles[0]==blockedDoor?false:originalFoot(s,tiles));
  try {
    const s=viableVillage(3,state=>{
      const site=state.settlement.sites.v[0];
      originalPad=state.space[Hex().fromPoint(site.point)].find(id=>state.ecs.mappable[id]);
      const sides=Object.keys(state.ecs.walkable[originalPad].neighbours).map(Number).filter(side=>side!=site.entrance);
      absent={side:sides[0],id:state.ecs.walkable[originalPad].neighbours[sides[0]]};
      remaining={side:sides[1],id:state.ecs.walkable[originalPad].neighbours[sides[1]]};
      removeBidirectionalLink(state.ecs,originalPad,absent.side);
      // This valid public edge cannot become a replacement pad or private yard.
      expect(original(state,[originalPad,remaining.id])).toBe(true);
    });
    expect(s.villages.v.houses).toHaveLength(3);
    expect(Object.keys(s.ecs.personable)).toHaveLength(6);
    expect(s.ecs.walkable[originalPad].neighbours[remaining.side]).toBe(remaining.id);
    expect(s.ecs.walkable[originalPad].neighbours[absent.side]).toBeUndefined();
    expect(Object.values(s.ecs.walkable[absent.id].neighbours)).not.toContain(originalPad);
    expect(s.ecs.mappable[blockedDoor].route).toEqual(expect.arrayContaining(oldRoad));
    expect(s.settlement.sites.v.every(site=>site.field && site.yard && site.usedBy)).toBe(true);
    for(const id of s.villages.v.houses)expect(s.ecs.growth[id].construction.timber).toBe(12);
  } finally {road.mockRestore();foot.mockRestore();}
});

it("releases only an infeasible opportunity's unused field proposal when reassigning its house pad",()=>{
  const original=landUse.reserveWorkYard;let rejected;
  const yards=jest.spyOn(landUse,"reserveWorkYard").mockImplementation((s,tile,owner)=>{
    rejected ||= owner;
    return owner==rejected?false:original(s,tile,owner);
  });
  try {
    const s=viableVillage(3);
    expect(s.villages.v.houses).toHaveLength(3);
    for(const tile of Object.keys(s.ecs.mappable).filter(id=>s.ecs.mappable[id].cropPlot)) {
      expect((s.space[Hex().fromPoint(s.ecs.spatial[tile])] || []).some(id=>s.ecs.farmable[id])).toBe(true);
    }
  } finally {yards.mockRestore();}
});

it("keeps an approved house pad when its real work yard must stand across an existing public lane",()=>{
  let original;
  const s=viableVillage(3,state=>{
    const site=state.settlement.sites.v[0],home=Hex().fromPoint(site.point);original={...site.point};
    const ring=Grid.hexagon({center:home,radius:1}).neighborsOf(home,ALL_SIDES);
    const tiles=ring.map(h=>state.space[h].find(id=>state.ecs.mappable[id]));
    expect(landUse.reserveRoad(state,[...tiles,tiles[0]])).toBe(true);
  });
  expect(s.settlement.sites.v[0].point).toEqual(original);
  const house=s.villages.v.houses[0],h=s.ecs.household[house],yard=Hex().fromPoint(h.yardPoint);
  expect(Hex().fromPoint(original).distance(yard)).toBeGreaterThan(1);
  expect(Hex().fromPoint(original).distance(yard)).toBeLessThanOrEqual(5);
  const origin=s.space[Hex().fromPoint(original)].find(id=>s.ecs.mappable[id]),end=s.space[yard].find(id=>s.ecs.mappable[id]);
  expect(require("game/pathfinding").path(s,origin,end)).not.toBeNull();
});

it("rejects an unestablished infeasible hamlet without dropping a person or consuming unrelated stock",()=>{
  const s=viableVillage(3,()=>{},false);
  const [person]=newEntities(s,[{personable:{age:30},playable:{},controllable:{controllerId:"self"},container:{capacity:100,amounts:{wood:37,grain:42}}}]);
  const before=structuredClone({person:s.ecs.personable[person],store:s.ecs.container[person]});
  const impossible=jest.spyOn(landUse,"reserveWorkYard").mockReturnValue(false);
  try {
    expect(()=>reserveFoundingFields(s)).not.toThrow();
    expect(s.villages).toEqual({});
    expect(s.settlement.rejectedSites).toHaveLength(3);
    expect(Object.keys(s.ecs.building)).toHaveLength(0);
    expect(Object.keys(s.ecs.personable)).toEqual([person]);
    expect(s.ecs.personable[person]).toEqual(before.person);
    expect(s.ecs.container[person]).toEqual(before.store);
    expect(s.events).toEqual([]);
  } finally {impossible.mockRestore();}
});

it("dates a real green relocation while retaining its founding site and enough separated public places",()=>{
  const s=viableVillage(3),v=s.villages.v,green=v.sharedPlaces.find(id=>s.ecs.meetingPlace[id].kind=="green"),from=String(Hex().fromPoint(s.ecs.spatial[green]));
  // Declared initial community around the actually built fixture green.
  v.origin={day:0,centreHex:from,people:Object.keys(s.ecs.personable).slice(0,2),houseId:v.houses[0]};
  const capacity=s.ecs.meetingPlace[green].gatheringPoints.length;
  s.ecs.personable[v.origin.people[0]].dead=true;
  const current=Object.keys(s.ecs.personable).filter(id=>!s.ecs.personable[id].dead).length;
  newEntities(s,Array.from({length:capacity-current+1},()=>({spatial:{...s.ecs.spatial[v.houses[0]]},personable:{age:19},household:{houseId:v.houses[0]},village:{villageId:"v"}})));
  const revision=s.landUseRevision;s.redraws=[];
  s.days=3;generateVillageLife(s,13,s.map.playerStartTile);
  expect(s.redraws).toContain(green);
  expect(s.landUseRevision).toBeGreaterThan(revision);
  expect(v.origin.centreHex).toBe(from);
  expect(v.origin.day).toBe(0);
  expect(v.greenMoves).toHaveLength(1);
  expect(v.greenMoves[0]).toMatchObject({day:3,fromHex:from,toHex:String(Hex().fromPoint(s.ecs.spatial[green]))});
  expect(s.events.some(e=>e.type=="green_moved" && e.day==3 && e.items.includes(green))).toBe(true);
  expect(s.space[from]).not.toContain(green);
  expect(s.space[v.greenMoves[0].toHex]).toContain(green);
  expect(s.events.filter(e=>e.type=="green_moved").every(e=>e.people.every(id=>!s.ecs.personable[id].dead))).toBe(true);
  const visitors=Object.keys(s.ecs.personable).filter(id=>!s.ecs.personable[id].dead),places=visitors.map(id=>require("game/villages").eveningPlace(s,id));
  expect(places.every(p=>p.id==green)).toBe(true);
  for(const [i,p] of places.entries())for(const q of places.slice(i+1))expect(Math.hypot(p.x-q.x,p.y-q.y)).toBeGreaterThanOrEqual(32);
});

it("keeps actual yard varieties when households arrive in separate layout phases",()=>{
  const original=settlements.constructHome;
  const build=jest.spyOn(settlements,"constructHome").mockImplementation((s,...args)=>{
    const house=original(s,...args);
    if(house)generateVillageLife(s,13,s.map.playerStartTile);
    return house;
  });
  try {
    const s=viableVillage(5);
    const kinds=s.villages.v.houses.map(id=>s.ecs.backyard[s.ecs.household[id].backyards[0]].kind);
    expect(kinds).toEqual(["vegetable","chicken","pig","goat","beehives"]);
  } finally {build.mockRestore();}
});
