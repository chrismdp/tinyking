import { generateMap, Hex } from "game/map";
import { markThroughRoutes, recordJourney } from "game/settlement_routes";
import { reserveRoad } from "game/land_use";
import { rowOfTiles } from "./support/world";

it("generates connected through roads and worn local approaches in seed 13",async()=>{
  const s={ecs:{nextId:1},days:.375,redraws:[],ui:{show:{}}};
  await generateMap(s,13,async()=>{});
  const tileAt=p=>s.space[Hex().fromPoint(p)].find(id=>s.ecs.mappable[id]);
  const through=Object.keys(s.ecs.mappable).filter(id=>s.ecs.mappable[id].throughRoute?.length);
  expect(through.length).toBeGreaterThan(10);
  for(const entry of Object.values(s.map.entrances)) {
    expect(s.ecs.mappable[entry.tileIds[0]].throughRoute.length).toBeGreaterThan(0);
  }
  // Every corridor edge is reciprocal, and no corridor has a house as an endpoint.
  const houses=Object.keys(s.ecs.building).map(id=>tileAt(s.ecs.spatial[id]));
  for(const id of through) {
    expect(houses).not.toContain(id);
    for(const side of s.ecs.mappable[id].throughRoute) {
      const next=s.ecs.walkable[id].neighbours[side];
      if(next)expect(s.ecs.mappable[next].throughRoute).toContain((side+3)%6);
    }
  }
  let localHouses=0,localFields=0;
  for(const village of Object.values(s.villages)) {
    const corridor=new Set(through),seen=new Set(),queue=[through[0]];
    for(let i=0;i<queue.length;i++) {
      const id=queue[i];if(seen.has(id))continue;seen.add(id);
      queue.push(...s.ecs.mappable[id].throughRoute.map(side=>s.ecs.walkable[id].neighbours[side]).filter(n=>corridor.has(n) && !seen.has(n)));
    }
    expect({village:village.id,connected:village.houses.some(h=>Object.values(s.ecs.walkable[tileAt(s.ecs.spatial[h])].neighbours).some(n=>seen.has(n)))}).toEqual({village:village.id,connected:true});
    for(const house of village.houses) {
      const tile=tileAt(s.ecs.spatial[house]);
      const visible=Object.values(s.ecs.walkable[tile].worn).some(w=>w>=10);
      if(visible) localHouses++;
      for(const field of s.ecs.household[house].fields) {
        const access=s.ecs.farmable[field].accessTileId;
        if(!s.ecs.mappable[access].throughRoute?.length && Object.values(s.ecs.walkable[access].worn).some(w=>w>=10)) {
          localFields++;
        }
      }
    }
  }
  expect(localHouses).toBeGreaterThan(3);
  expect(localFields).toBeGreaterThan(0);
});

it("keeps a border traveller's house spur local and preserves its speed, wear and navigation",()=>{
  const {state:s,tiles,villager}=rowOfTiles(5);
  s.map={entrances:{0:{tileIds:tiles.slice(0,3)}}};
  s.settlement={journeys:[],appliedJourneys:{}};
  expect(reserveRoad(s,tiles)).toBe(true);
  const navigation=tiles.map(id=>({...s.ecs.walkable[id].neighbours}));
  const speeds=tiles.map(id=>s.ecs.walkable[id].speed);
  markThroughRoutes(s,[tiles[3]]);
  expect(s.ecs.mappable[tiles[4]].throughRoute).toEqual([]);
  recordJourney(s,{key:"border-from-home",people:[villager],from:tiles[4],to:tiles[0],borderKey:"a|b",reason:"visiting household"});
  expect(Object.values(s.ecs.mappable[tiles[2]].roadRoles).some(r=>r.role=="main")).toBe(true);
  expect(s.ecs.mappable[tiles[3]].roadRoles).toEqual({});
  expect(Object.values(s.ecs.walkable[tiles[4]].worn)).toEqual([1]);
  expect(tiles.map(id=>s.ecs.walkable[id].neighbours)).toEqual(navigation);
  expect(tiles.map(id=>s.ecs.walkable[id].speed)).toEqual(speeds);
});
