jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { generateMap, Hex } from "game/map";
import { roadTracks } from "game/road_wear";
import { tileOverlay, FLAT_GROUND } from "render/models";
import { COLOURS } from "render/colours";
import { markThroughRoutes, recordJourney } from "game/settlement_routes";
import { reserveRoad } from "game/land_use";
import { rowOfTiles } from "./support/world";

const GREY=0x8B8D88;
const colours=(ecs,id)=>tileOverlay(FLAT_GROUND,ecs,id,{selected:false}).children.map(mesh=>mesh.material.color.getHex());

it("colours only the through pair grey at a junction, keeping the house spur in walking-wear brown",()=>{
  const ecs={spatial:{tile:Hex(0,0).toPoint()},mappable:{tile:{route:[1,0,3],throughRoute:[0,3],roadRoles:{"0,1":{role:"main"},"0,3":{role:"main"}}}},walkable:{tile:{worn:{"0,1":100,"0,3":100},routeWear:100}}};
  const overlays=tileOverlay(FLAT_GROUND,ecs,"tile",{selected:false}).children;
  const keys=Object.keys(roadTracks(ecs,"tile"));
  expect(overlays[keys.indexOf("0,3")].material.color.getHex()).toBe(GREY);
  expect(overlays[keys.indexOf("0,1")].material.color.getHex()).toBe(COLOURS.dirt);
  expect(colours({...ecs,mappable:{tile:{route:[1],throughRoute:[]}},walkable:{tile:{worn:{"1,C":100},routeWear:100}}},"tile")).not.toContain(GREY);
});

it("generates connected through roads and already worn brown local approaches in seed 13",async()=>{
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
      if(visible) {expect(colours(s.ecs,tile)).not.toContain(GREY);localHouses++;}
      for(const field of s.ecs.household[house].fields) {
        const access=s.ecs.farmable[field].accessTileId;
        if(!s.ecs.mappable[access].throughRoute?.length && Object.values(s.ecs.walkable[access].worn).some(w=>w>=10)) {
          expect(colours(s.ecs,access)).not.toContain(GREY);localFields++;
        }
      }
    }
  }
  expect(localHouses).toBeGreaterThan(3);
  expect(localFields).toBeGreaterThan(0);
  expect(through.some(id=>colours(s.ecs,id).includes(GREY))).toBe(true);
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
  expect(colours(s.ecs,tiles[4])).toEqual([COLOURS.dirt]);
  expect(tiles.map(id=>s.ecs.walkable[id].neighbours)).toEqual(navigation);
  expect(tiles.map(id=>s.ecs.walkable[id].speed)).toEqual(speeds);
});
