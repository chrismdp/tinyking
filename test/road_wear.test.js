import { DAYS_IN_YEAR } from "game/time";
import { Hex } from "game/hex";
import { updateRoadWear, recordRoadUse, roadTracks } from "game/road_wear";
import { canPlaceField } from "game/land_use";

function scene() {
  const h=Hex(0,0), state={days:.375,space:{[h]:["tile"]},redraws:[],ecs:{
    spatial:{tile:h.toPoint()},mappable:{tile:{terrain:"grassland",route:[0,3]}},
    walkable:{tile:{speed:1,worn:{"0,3":100},neighbours:{0:"other"}}}
  }};
  updateRoadWear(state);
  return state;
}

it("fades partially after one canonical year and fully after two, without dropping road reservations or links", () => {
  const s=scene(), w=s.ecs.walkable.tile;
  s.days+=DAYS_IN_YEAR;updateRoadWear(s);
  expect(w.worn["0,3"]).toBeCloseTo(50);
  expect(w.routeWear).toBeCloseTo(50);
  expect(roadTracks(s.ecs,"tile")["0,3"]).toBeCloseTo(50);
  const before=JSON.stringify(w);updateRoadWear(s);
  expect(JSON.stringify(w)).toBe(before);
  s.days+=DAYS_IN_YEAR-.1;updateRoadWear(s);
  expect(w.routeWear).toBeLessThan(1);
  s.days+=.1;updateRoadWear(s);
  expect(w.routeWear).toBeCloseTo(0);
  expect(w.worn["0,3"]).toBeCloseTo(0);
  expect(roadTracks(s.ecs,"tile")["0,3"]).toBeCloseTo(0);
  expect(s.ecs.mappable.tile.route).toEqual([0,3]);
  expect(w.neighbours).toEqual({0:"other"});
  expect(canPlaceField(s,"tile")).toBe(false);
});

it("new real footsteps replenish fading wear, and a catch-up equals repeated hourly decay", () => {
  const a=scene(), b=scene();
  a.days+=DAYS_IN_YEAR;updateRoadWear(a);
  for(let h=1;h<=24*DAYS_IN_YEAR;h++){b.days=.375+h/24;updateRoadWear(b);}
  expect(b.ecs.walkable.tile.routeWear).toBeCloseTo(a.ecs.walkable.tile.routeWear,8);
  recordRoadUse(a,"tile",0,3);
  expect(a.ecs.walkable.tile.worn["0,3"]).toBeCloseTo(51);
  expect(a.ecs.walkable.tile.routeWear).toBeCloseTo(51);
  expect(a.ecs.walkable.tile.trackReserved).toBe(true);
  a.days+=2*DAYS_IN_YEAR;updateRoadWear(a);
  expect(a.ecs.walkable.tile.routeWear).toBe(0);
});

it("farm work never replenishes or creates transit wear", () => {
  const s=scene();s.ecs.mappable.tile.cropPlot=true;
  s.ecs.walkable.tile.worn={};s.ecs.walkable.tile.routeWear=0;
  recordRoadUse(s,"tile",0,null);
  expect(s.ecs.walkable.tile.worn).toEqual({});
  expect(s.ecs.walkable.tile.routeWear).toBe(0);
});
