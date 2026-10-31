import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";
import { path, addBidirectionalLink } from "game/pathfinding";
import { reserveWorkYard, reserveRoad, canPlaceField } from "game/land_use";
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
