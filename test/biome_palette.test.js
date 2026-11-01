jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { generateWorld } from "game/overworld";
import { habitatAt } from "game/biome_field";
import { MAP_CENTRE, worldPoint } from "game/world_terrain";
import { createGroundColours, habitatColour } from "render/biomes";
import { treeProbability, generateTrees } from "game/map";
import { Grid } from "game/hex";

it("uses continuous local habitat colours despite category/morality summaries",()=>{
  const generated=generateWorld(13), home=generated.home;
  const world={...generated,hexes:generated.hexes.filter(h=>h.x==home.x && Math.abs(h.y-home.y)<=1).map((h,i)=>({...h,biome:i?"desert":"jungle",morality:i?"evil":"good"}))};
  const centre=MAP_CENTRE.toPoint();
  const state={world,map:{seed:13},days:4.5,ecs:{mappable:{},spatial:{}},space:{}};
  const p=worldPoint(home,centre),sample=habitatAt(world,p,100),terrain="grassland";
  state.ecs.spatial.tile=centre;state.ecs.mappable.tile={...sample,terrain};state.space[String(MAP_CENTRE)]=["tile"];
  const local=createGroundColours(state)("tile"),coarse=habitatColour(sample,terrain,p);
  expect(local.toArray()).toEqual(coarse.toArray());
  const left=habitatColour(habitatAt(world,{x:p.x-.01,y:p.y},100),terrain,{x:p.x-.01,y:p.y});
  const right=habitatColour(habitatAt(world,{x:p.x+.01,y:p.y},100),terrain,{x:p.x+.01,y:p.y});
  expect(left.distanceToSquared ? left.distanceToSquared(right) : left.toArray().reduce((s,n,i)=>s+(n-right.toArray()[i])**2,0)).toBeLessThan(.000001);
});

it("blends real tree establishment smoothly and generates deterministic intermediate woodland",()=>{
  const grid=Grid.rectangle({width:18,height:18}),landscape=Object.fromEntries(grid.map(h=>[h,{...h,terrain:"grassland"}]));
  const counts=[];
  for(const weight of [0,.25,.5,.75,1]) {
    const mix={desert:1-weight,jungle:weight};
    const trees=()=>generateTrees(13,landscape,{},grid.pointWidth(),grid.pointHeight(),{biomeAt:()=>mix});
    const a=trees();expect(a).toEqual(trees());counts.push(a.length);
    expect(treeProbability(.1,mix)).toBeCloseTo(weight,8);
  }
  expect(counts[0]).toBeLessThan(counts[1]);expect(counts[1]).toBeLessThan(counts[2]);
  expect(counts[2]).toBeLessThan(counts[3]);expect(counts[3]).toBeLessThan(counts[4]);
});
