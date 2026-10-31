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
