jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { generateWorld } from "game/overworld";
import { habitatAt } from "game/biome_field";
import { MAP_CENTRE, worldPoint, createLandField } from "game/world_terrain";
import { createRealmTerrain } from "render/realm_terrain";
import { createGroundColours, habitatColour } from "render/biomes";
import { treeProbability, generateTrees } from "game/map";
import { Grid } from "game/hex";

it("uses identical colours on both copies of shared reach vertices despite different category/morality summaries",()=>{
  const generated=generateWorld(13), home=generated.home;
  const world={...generated,hexes:generated.hexes.filter(h=>h.x==home.x && Math.abs(h.y-home.y)<=1).map((h,i)=>({...h,biome:i?"desert":"jungle",morality:i?"evil":"good"}))};
  const field=createLandField(world.landSeed),centre=MAP_CENTRE.toPoint();
  const ground={heightAt:(x,y)=>field.elevationAt(worldPoint(home,{x,y}))};
  const state={world,map:{seed:13},days:4.5,ecs:{mappable:{},spatial:{}},space:{}};
  const before=JSON.stringify(state),realm=createRealmTerrain(state,ground);
  const chunks=[realm.mesh,...realm.mesh.children];let shared=0;
  const seen=new Map();
  for(const mesh of chunks) {
    const pos=mesh.geometry.attributes.position,col=mesh.geometry.attributes.color;
    for(let i=0;i<pos.count;i++) {
      const key=pos.getX(i)+","+pos.getZ(i),rgb=[col.getX(i),col.getY(i),col.getZ(i)];
      if(seen.has(key)){expect({key,height:pos.getY(i),rgb}).toEqual({key,height:pos.getY(i),rgb:seen.get(key)});shared++;}else seen.set(key,rgb);
    }
  }
  expect(shared).toBeGreaterThan(20);
  expect(JSON.stringify(state)).toBe(before);realm.dispose();
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
