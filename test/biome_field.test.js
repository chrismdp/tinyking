import { generateWorld } from "game/overworld";
import { climateAt, habitatAt, chooseBiome, mixValue, woodsAt, localHabitat, setTileElevation } from "game/biome_field";
import { worldPoint, MAP_CENTRE } from "game/world_terrain";
import { Hex, WorldHex, WorldGrid, ALL_SIDES } from "game/hex";
import { snowlineAt, frozenAt } from "game/climate";

it.each([13,20])("samples finite normalised varied habitats without world mutation, seed %s",seed=>{
  const world=generateWorld(seed), before=JSON.stringify(world);
  const h=world.home, p=worldPoint(h,MAP_CENTRE.toPoint());
  const samples=[];
  for(let x=-1500;x<=1500;x+=300) samples.push(habitatAt(world,{x:p.x+x,y:p.y},100));
  for(const s of samples) {
    expect(Object.values(s.biomeMix).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
    expect(Object.values(s.biomeMix).every(w=>Number.isFinite(w) && w>=0 && w<=1)).toBe(true);
    expect(s.biomeMix[chooseBiome(s.biomeMix,.37)]).toBeGreaterThan(0);
  }
  expect(Math.max(...samples.map(s=>s.warmth))-Math.min(...samples.map(s=>s.warmth))).toBeGreaterThan(.01);
  expect(JSON.stringify(world)).toBe(before);
});

it("agrees at the same physical edge point from either active reach and changes smoothly across it",()=>{
  const world=generateWorld(13), a=WorldHex(world.home);
  const b=WorldGrid.hexagon({center:a,radius:1}).neighborsOf(a,ALL_SIDES)[0];
  const ap=worldPoint(a,MAP_CENTRE.toPoint()),bp=worldPoint(b,MAP_CENTRE.toPoint());
  const p={x:(ap.x+bp.x)/2,y:(ap.y+bp.y)/2};
  const first=habitatAt({...world,home:a},p,200),second=habitatAt({...world,home:b},p,200);
  expect(first).toEqual(second);
  const centre=MAP_CENTRE.toPoint();
  const local=(origin)=>({x:centre.x+p.x-origin.x,y:centre.y+p.y-origin.y});
  const fromA=localHabitat({...world,home:a},local(ap),200),fromB=localHabitat({...world,home:b},local(bp),200);
  expect(fromA.climateWarmth).toBeCloseTo(fromB.climateWarmth,12);
  expect(fromA.moistureValue).toBeCloseTo(fromB.moistureValue,12);
  expect(woodsAt({...world,home:a},p)).toBe(woodsAt({...world,home:b},p));
  const left=habitatAt(world,{x:p.x-.01,y:p.y},200),right=habitatAt(world,{x:p.x+.01,y:p.y},200);
  expect(Math.abs(left.moistureValue-right.moistureValue)).toBeLessThan(.0001);
  expect(Math.abs(left.warmth-right.warmth)).toBeLessThan(.0001);
  const profiles={desert:{density:.02},savanna:{density:.035},jungle:{density:1},steppe:{density:.04},grassland:{density:.2},marsh:{density:.12},tundra:{density:.025},taiga:{density:.4},snowfield:{density:.06}};
  expect(Math.abs(mixValue(left.biomeMix,profiles,"density")-mixValue(right.biomeMix,profiles,"density"))).toBeLessThan(.0001);
});

it("uses continuous sea-level temperature for a shared seasonal snowline, with alpine habitat at altitude",()=>{
  const world=generateWorld(13),p=worldPoint(world.home,MAP_CENTRE.toPoint());
  const climate=climateAt(world,p),low=habitatAt(world,p,20),high=habitatAt(world,p,1400);
  expect(high.warmth).toBeLessThan(low.warmth);
  expect(high.temperature).toBe("cold");
  for(const day of [0,3,6,9]) {
    expect(snowlineAt(high,day)).toBe(snowlineAt({...climate,elevation:1400},day));
    expect(frozenAt(high,day)).toBe(true);
  }
});

it("refreshes physical habitat and regrowth habitat when a real building pad changes altitude",()=>{
  const world=generateWorld(13),p=MAP_CENTRE.toPoint();
  const state={world,ecs:{spatial:{tile:p},mappable:{tile:localHabitat(world,p,100)}},ecology:{tiles:{[String(Hex().fromPoint(p))]:{id:"tile"}}}};
  setTileElevation(state,"tile",700);
  expect(state.ecs.mappable.tile).toEqual(localHabitat(world,p,700));
  expect(state.ecology.tiles[String(Hex().fromPoint(p))].biomeMix).toBe(state.ecs.mappable.tile.biomeMix);
});
