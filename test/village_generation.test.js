import * as landUse from "game/land_use";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";
import { addBidirectionalLink } from "game/pathfinding";
import { constructHome, reserveFoundingFields } from "game/settlement";
import { generateVillageLife } from "game/villages";
import { expansionFits, expandedFootprint } from "game/settlement_growth";

function viableVillage(count) {
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
  reserveFoundingFields(s);
  expect(Object.keys(s.ecs.building)).toHaveLength(0);
  expect(Object.keys(s.ecs.personable)).toHaveLength(0);
  for(let i=0;i<count;i++) {
    const people=newEntities(s,[true,false].map(male=>({spatial:{...sites[i].toPoint()},personable:{age:30,male},holder:{held:[],capacity:2},controllable:{},household:{},village:{villageId:"v"},kinship:{parents:[],children:[],spouse:null},relationships:{known:{}},personality:{traits:[],likes:[],dislikes:[]},planner:{world:{}},nameable:{nickname:"Initial household "+i}})));
    for(const id of people)s.ecs.controllable[id].controllerId=id;
    // Real initial construction budget: 12 home + 4 workshop + 8 venue.
    expect(constructHome(s,"v",people,{founding:i==0,timber:24})).toBeTruthy();
  }
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
  const original=landUse.reserveRoad,originalFoot=landUse.reserveFieldLane;let blockedDoor,oldRoad;
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
    const s=viableVillage(3);
    expect(s.villages.v.houses).toHaveLength(3);
    expect(Object.keys(s.ecs.personable)).toHaveLength(6);
    expect(s.ecs.mappable[blockedDoor].route).toEqual(expect.arrayContaining(oldRoad));
    expect(s.settlement.sites.v.every(site=>site.field && site.yard && site.usedBy)).toBe(true);
    for(const id of s.villages.v.houses)expect(s.ecs.growth[id].construction.timber).toBe(12);
  } finally {road.mockRestore();foot.mockRestore();}
});
