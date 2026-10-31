import { moistureSweep, annualClimate } from "game/annual_moisture";
import { generateWorld, AXES, biomeOf } from "game/overworld";
import { WorldHex, WorldGrid, ALL_SIDES } from "game/hex";
import { weatherForWorld } from "game/weather";
import { createLandField, worldPoint, MAP_CENTRE } from "game/world_terrain";

const row = heights => heights.map((height,i)=>({height,water:i<2}));
it("replenishes ocean air, wets ascent and leaves a dry rain shadow with the same coastal supply",()=>{
  const flat=moistureSweep(row([0,0,40,40,40,40,40,40,40]));
  const ridge=moistureSweep(row([0,0,40,500,1200,500,40,40,40]));
  expect(ridge[3].moisture).toBeGreaterThan(flat[3].moisture);
  expect(ridge[6].moisture).toBeLessThan(flat[6].moisture-.15);
  expect(ridge[3].moisture).toBeGreaterThan(ridge[5].moisture);
  const coast=moistureSweep(row([0,0,...Array(25).fill(40),0,40]).map((h,i)=>({...h,water:h.water || i==27})));
  expect(coast[2].moisture).toBeGreaterThan(coast[24].moisture);
  expect(coast[28].moisture).toBeGreaterThan(coast[24].moisture);
});
it("uses wind orientation and the shared terrain deterministically without detailed maps",()=>{
  const hexes=[{x:4,y:4},{x:5,y:4},{x:6,y:4}];
  const field=createLandField("13:0");
  const a=annualClimate(hexes,field,13),b=annualClimate([...hexes].reverse(),field,13);
  expect(a.wind).toEqual(b.wind);
  for(const h of a.hexes)expect(h).toEqual(b.hexes.find(n=>n.x==h.x && n.y==h.y));
  expect(a.hexes.every(h=>Number.isFinite(h.annualMoisture) && h.annualMoisture>=0 && h.annualMoisture<=1)).toBe(true);
});

it.each([13,20])("stores terrain climate once, retains neighbour categories and leaves annual moisture fixed through hourly weather, seed %s",seed=>{
  const world=generateWorld(seed),before=JSON.stringify(world);
  const byKey=new Map(world.hexes.map(h=>[String(WorldHex(h)),h]));
  for(const h of world.hexes) {
    expect(Number.isFinite(h.annualMoisture)).toBe(true);
    expect(h.biome).toBe(biomeOf(h.temperature,h.moisture));
    const neighbours=WorldGrid.hexagon({center:WorldHex(h),radius:1}).neighborsOf(WorldHex(h),ALL_SIDES);
    for(const key of neighbours.map(String)) {
      const n=byKey.get(key);if(!n)continue;
      for(const axis of ["temperature","moisture"])expect(Math.abs(AXES[axis].indexOf(h[axis])-AXES[axis].indexOf(n[axis]))).toBeLessThanOrEqual(1);
    }
  }
  const a=weatherForWorld(world,seed,.375),b=weatherForWorld(world,seed,.375+1/24);
  expect(Object.values(a).some((w,i)=>w.pressure!==Object.values(b)[i].pressure)).toBe(true);
  expect(JSON.stringify(world)).toBe(before);
});

it("carries a coastal supply across an actual sampled barrier in the seeded wind direction",()=>{
  const hexes=Array.from({length:11},(_,y)=>({x:5,y}));
  const wind=annualClimate(hexes,{landAt:()=>1,elevationAt:()=>40},13).wind;
  const u=p=>p.x*wind.x+p.y*wind.y;
  const points=hexes.map(h=>({...h,u:u(worldPoint(h,MAP_CENTRE.toPoint()))})).sort((a,b)=>a.u-b.u);
  const crest=points[5].u;
  const coast={landAt:p=>u(p)<crest-6500?-1:1,elevationAt:()=>40};
  const barrier={...coast,elevationAt:p=>40+1400*Math.exp(-(((u(p)-crest)/2400)**2))};
  const flat=annualClimate(hexes,coast,13),ridge=annualClimate(hexes,barrier,13);
  const at=(climate,index)=>climate.hexes.find(h=>h.y==points[index].y).annualMoisture;
  expect(at(ridge,5)).toBeGreaterThan(at(flat,5));
  expect(at(ridge,6)).toBeLessThan(at(flat,6)-.1);
  expect(at(ridge,4)).toBeGreaterThan(at(ridge,6));
});
