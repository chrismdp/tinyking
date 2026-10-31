import { rowOfTiles } from "./support/world";
import { walk_to } from "game/tasks";
import { Task } from "game/htn";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";
import { path, addBidirectionalLink } from "game/pathfinding";
import { reserveWorkYard, reserveRoad, canPlaceField, fieldAtTile } from "game/land_use";
import { recordRoadUse } from "game/road_wear";

it("reserves an actual work yard for its household, keeping public journeys and fields outside it",()=>{
  const s={ecs:{nextId:1},space:{},redraws:[],days:0};
  const hexes=Grid.hexagon({center:Hex(4,4),radius:3});
  const ids=newEntities(s,hexes.map(h=>({spatial:{...h.toPoint(),immovable:true},mappable:{terrain:"grassland"},walkable:{speed:1,worn:{},neighbours:{}}})));
  const byHex=Object.fromEntries(hexes.map((h,i)=>[String(h),ids[i]]));
  for(const h of hexes)Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).forEach((n,side)=>{if(byHex[n])addBidirectionalLink(s.ecs,byHex[h],side,byHex[n]);});
  const yard=byHex[Hex(4,4)],from=byHex[Hex(2,4)],to=byHex[Hex(6,4)];
  expect(reserveWorkYard(s,yard,"actual-household")).toBe(true);
  expect(s.ecs.mappable[yard].buildingPlot).toBe("actual-household");
  expect(path(s,from,to).map(p=>p.id)).not.toContain(yard);
  expect(path(s,from,yard).at(-1).id).toBe(yard);
  expect(recordRoadUse(s,yard,1,4,3)).toBe(false);
  expect(reserveRoad(s,[yard])).toBe(false);
  expect(canPlaceField(s,yard)).toBe(false);
  expect(reserveWorkYard(s,yard,"another-household")).toBe(false);
});

function neck() {
  const s={ecs:{nextId:1},space:{},redraws:[],days:0};
  const ids=newEntities(s,[Hex(3,4),Hex(4,4),Hex(5,4),Hex(4,3)].map(h=>({spatial:{...h.toPoint(),immovable:true},mappable:{terrain:"grassland"},walkable:{speed:1,worn:{},neighbours:{}}})));
  addBidirectionalLink(s.ecs,ids[0],0,ids[1]);
  addBidirectionalLink(s.ecs,ids[1],0,ids[2]);
  addBidirectionalLink(s.ecs,ids[1],4,ids[3]);
  return {s,ids};
}

it("refuses private yards that sever a public neck or the sole exit of a door",()=>{
  const {s,ids}=neck(),before=JSON.stringify(s);
  expect(reserveWorkYard(s,ids[1],"house")).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
  expect(path(s,ids[0],ids[2])).toBeTruthy();
});

it("keeps public access to existing fields and private work endpoints",()=>{
  for(const kind of ["cropPlot","buildingPlot"]) {
    const {s,ids}=neck();
    s.ecs.mappable[ids[0]][kind]=kind=="buildingPlot"?"other-house":true;
    // The two remaining public neighbours have an alternate public lane.
    addBidirectionalLink(s.ecs,ids[2],3,ids[3]);
    expect(reserveWorkYard(s,ids[1],"new-house")).toBe(false);
    expect(canPlaceField(s,ids[1])).toBe(false);
  }
});

it("allows connected property interiors with an exit, without using them as a public bypass",()=>{
  const {s,ids}=neck();
  s.ecs.mappable[ids[0]].buildingPlot="house";
  addBidirectionalLink(s.ecs,ids[2],3,ids[3]);
  expect(reserveWorkYard(s,ids[1],"house")).toBe(true);
  expect(path(s,ids[0],ids[2])).toBeTruthy();
  expect(path(s,ids[2],ids[0])).toBeTruthy();
  expect(path(s,ids[2],ids[3]).map(p=>p.id)).not.toContain(ids[1]);
});

it("preserves a worn public reservation even after its visible wear fades",()=>{
  const {s,ids}=neck();
  s.ecs.walkable[ids[3]].trackReserved=true;
  const before=JSON.stringify(s);
  expect(reserveWorkYard(s,ids[3],"house")).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
});

it.each([false,true])("walks into and out of connected private work space without transit wear (fenced %s)",fenced=>{
  const {state:s,tiles,villager}=rowOfTiles(5);
  s.ecs.mappable[tiles[2]].buildingPlot="house";
  s.ecs.mappable[tiles[3]].buildingPlot="house";
  if(fenced)newEntities(s,[{spatial:{...s.ecs.spatial[tiles[3]]},fence:{halfWidth:14,halfDepth:14}}]);
  const walk=target=>{
    const w={places:{}};let result;
    for(let i=0;i<3000 && result!=Task.FINISH && result!=Task.ABORT;i++)result=walk_to(s,villager,w,1/86400,i==0,target);
    return result;
  };
  expect(walk(tiles[3])).toBe(Task.FINISH);
  expect(Math.hypot(s.ecs.spatial[villager].x-s.ecs.spatial[tiles[3]].x,s.ecs.spatial[villager].y-s.ecs.spatial[tiles[3]].y)).toBeLessThan(10);
  expect(walk(tiles[0])).toBe(Task.FINISH);
  expect(s.ecs.walkable[tiles[2]].worn).toEqual({});
  expect(s.ecs.walkable[tiles[3]].worn).toEqual({});
  expect(walk(tiles[4])).toBe(Task.ABORT);
  s.ecs.mappable[tiles[2]].cropPlot=true;
  expect(walk(tiles[3])).toBe(Task.ABORT);
});

it("reads live crop membership after cached tile lookup, replacement and coordinate changes",()=>{
  const {state:s,tiles}=rowOfTiles(2),p=s.ecs.spatial[tiles[0]];
  expect(fieldAtTile(s,tiles[0])).toBe(false);
  const [farm]=newEntities(s,[{spatial:{...p,immovable:true},farmable:{slots:[]}}]);
  expect(fieldAtTile(s,tiles[0])).toBe(true);
  delete s.ecs.farmable[farm];
  expect(fieldAtTile(s,tiles[0])).toBe(false);
  s.ecs.farmable[farm]={slots:[]};
  const original={...p};
  Object.assign(p,s.ecs.spatial[tiles[1]]);
  expect(fieldAtTile(s,tiles[0])).toBe(false);
  Object.assign(p,original);
  expect(fieldAtTile(s,tiles[0])).toBe(true);
  s.space={...s.space,[Hex().fromPoint(p)]:[tiles[0]]};
  expect(fieldAtTile(s,tiles[0])).toBe(false);
});

it("reserves a connected private parcel atomically while retaining public connections and work exits",()=>{
  const {s,ids}=neck();
  const before=JSON.stringify(s);
  expect(reserveWorkYard(s,[ids[1],ids[3]],"house")).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
  addBidirectionalLink(s.ecs,ids[0],5,ids[2]);
  expect(reserveWorkYard(s,[ids[1],ids[3]],"house")).toBe(true);
  expect(path(s,ids[0],ids[2]).map(p=>p.id)).not.toContain(ids[1]);
  expect(path(s,ids[0],ids[3])).toBeTruthy();
});
