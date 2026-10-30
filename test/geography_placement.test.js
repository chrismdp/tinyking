import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";
import { addBidirectionalLink } from "game/pathfinding";
import { groundForState } from "game/geography";
import { canPlaceShelter, placeShelter } from "game/construction";
import { reserveRoad } from "game/land_use";

function siteFixture(slope) {
  const centre=Hex(5,5), origin=centre.toPoint();
  const s={ecs:{nextId:1,controllable:{},building:{}},space:{},redraws:[],ui:{playerId:"player"},days:.375};
  const grid=Grid.hexagon({center:centre,radius:4});
  const ids=newEntities(s,grid.map(h=>({spatial:{...h.toPoint(),immovable:true},mappable:{terrain:"grassland"},walkable:{speed:1,worn:{},neighbours:{}}})));
  const tile=h=>s.space[h]?.find(id=>s.ecs.mappable[id]);
  for(const h of grid) for(const [side,n] of Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).entries()) if(tile(n)) addBidirectionalLink(s.ecs,tile(h),side,tile(n));
  s.ecs.controllable.player={controllerId:"player"};
  newEntities(s,[{spatial:{...Hex(4,5).toPoint(),immovable:true},camp:{},controllable:{controllerId:"player"}}]);
  const heights={};
  for(const h of grid) for(const o of Hex().corners()) {
    const p=h.toPoint(),x=p.x+o.x,y=p.y+o.y;
    heights[Math.round(x*1000)+","+Math.round(y*1000)]=480+(x-origin.x)*slope;
  }
  s.map={seed:13,centre,radius:4,geography:{version:1,heights,routes:[]}};
  return {s,site:tile(centre),ids};
}

it("grades an actual highland shelter pad on the shared surface and preserves distant altitude",()=>{
  const {s,site,ids}=siteFixture(.3),p=s.ecs.spatial[site],original={...s.map.geography.heights};
  const cachedGround=groundForState(s);
  expect(canPlaceShelter(s,site)).toBe(true);
  expect(s.map.geography.heights).toEqual(original);
  const id=placeShelter(s,site);
  expect(id).toBeTruthy();
  const corners=groundForState(s).hex(p).corners;
  expect(Math.max(...corners)-Math.min(...corners)).toBeLessThan(1e-6);
  expect(cachedGround.hex(p).corners).toEqual(corners);
  expect(groundForState(s).hex(p).centre).toBeCloseTo(480,5);
  for(const tile of ids) if(Hex().fromPoint(s.ecs.spatial[tile]).distance(Hex().fromPoint(p))>=4) {
    const q=s.ecs.spatial[tile];
    for(const o of Hex().corners()) {
      const key=Math.round((q.x+o.x)*1000)+","+Math.round((q.y+o.y)*1000);
      expect(s.map.geography.heights[key]).toBe(original[key]);
    }
  }
});

it("rejects a steep shelter site using actual geometry before creating or clearing anything",()=>{
  const {s,site}=siteFixture(1.2),before=JSON.stringify(s);
  expect(canPlaceShelter(s,site)).toBe(false);
  expect(placeShelter(s,site)).toBeNull();
  expect(JSON.stringify(s)).toBe(before);
});

it("reserves real roads only on gentle hexes and contour links without changing their altitude",()=>{
  const {s,site}=siteFixture(.3), before={...s.map.geography.heights};
  const tile=h=>s.space[h].find(id=>s.ecs.mappable[id]);
  expect(reserveRoad(s,[site,tile(Hex(6,5))])).toBe(false);
  expect(s.ecs.mappable[site].route).toBeUndefined();
  expect(reserveRoad(s,[site,tile(Hex(5,6))])).toBe(true);
  expect(s.map.geography.heights).toEqual(before);
  const steep=siteFixture(.8);
  expect(reserveRoad(steep.s,[steep.site,steep.s.space[Hex(5,6)][0]])).toBe(false);
});
