/* global jest, it, expect, require, global */
jest.mock("three",()=>process.getBuiltinModule("module")._load(process.cwd()+"/node_modules/three/build/three.module.js"));
jest.mock("render/labels",()=>({label:()=>{const T=require("three");return new T.Sprite(new T.SpriteMaterial());}}));
import { createWorldView } from "render/world_view";
import { createTerrain } from "render/terrain";
import { createRealmTerrain } from "render/realm_terrain";
import { groundForState } from "game/height";
import { Grid } from "game/hex";
import { MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
const fixture=()=>{
  const s={ecs:{mappable:{},spatial:{},walkable:{}},space:{},days:.375,map:{seed:13},world:{landSeed:13,home:{x:0,y:0},hexes:[{x:0,y:0,biome:"grassland",temperature:"temperate",moisture:"normal"}]}};
  for(const h of Grid.hexagon({center:MAP_CENTRE,radius:MAP_RADIUS})){const id=String(h);s.ecs.spatial[id]=h.toPoint();s.ecs.mappable[id]={terrain:"grassland"};s.space[h]=[id];}
  return s;
};
it("fades known ground to exact black at an undiscovered edge and restores it when neighbours are discovered, including snow",()=>{
  const s=fixture(),t=createTerrain(s,groundForState(s)),id=String(MAP_CENTRE),offset=Object.keys(s.ecs.mappable).indexOf(id)*18;
  const colour=()=>Array.from(t.mesh.geometry.attributes.color.array.slice(offset*3,offset*3+9));
  t.show(id,true);t.update();expect(colour().slice(0,3).some(v=>v>0)).toBe(true);expect(colour().slice(3)).toEqual([0,0,0,0,0,0]);
  for(const h of Grid.hexagon({center:MAP_CENTRE,radius:1}))t.show(String(h),true);
  t.update();expect(colour().every(v=>v>0)).toBe(true);
  for(const h of Grid.hexagon({center:MAP_CENTRE,radius:1}))if(String(h)!=id)t.show(String(h),false);
  s.snow={[id]:1};s.snowRevision=1;t.update();expect(colour().slice(3)).toEqual([0,0,0,0,0,0]);
  const revision=t.mesh.geometry.attributes.color.version;t.update();expect(t.mesh.geometry.attributes.color.version).toBe(revision);t.dispose();
});
it("fades the public realm perimeter to black without extra meshes or frame work, and retains it when snow refreshes",()=>{
  const s=fixture(),r=createRealmTerrain(s,groundForState(s)),p=r.mesh.geometry.attributes.position,c=r.mesh.geometry.attributes.color;
  const edge=r.boundaries.values().next().value[0];
  let i=0;for(;i<p.count;i++)if(Math.hypot(p.getX(i)-edge.x,p.getZ(i)-edge.z)<.01)break;
  expect(i).toBeLessThan(p.count);expect([c.getX(i),c.getY(i),c.getZ(i)]).toEqual([0,0,0]);
  expect(Array.from(c.array).some(v=>v>0)).toBe(true);
  r.refreshSnow();expect([c.getX(i),c.getY(i),c.getZ(i)]).toEqual([0,0,0]);
  expect(r.mesh.children).toHaveLength(0);r.dispose();
});

it("keeps the local surround black by day and night and hides the continuous realm underneath local discovery",()=>{
  const s=fixture();s.ecs.playable={player:{known:[{x:MAP_CENTRE.x,y:MAP_CENTRE.y}]}};s.ecs.personable={};s.ecs.interior={};s.ecs.good={};s.ecs.building={};s.ui={playerId:"player"};s.redraws=[];s.travel={active:"0,0",maps:{},people:{}};
  Object.assign(s.map,{centre:MAP_CENTRE,radius:MAP_RADIUS,playerStartTile:MAP_CENTRE});
  const renderer={domElement:{clientWidth:1440,clientHeight:900,style:{},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:1440,height:900})},render:jest.fn(),setSize(){}};
  global.window={addEventListener(){},removeEventListener(){}};
  const view=createWorldView(renderer,s,{t:x=>x,onSelect(){}});
  try {
    for(const days of [.375,.95]){s.days=days;view.frame();const scene=renderer.render.mock.calls.at(-1)[0];expect(scene.background.getHex()).toBe(0);expect(view.realmTerrain.mesh.visible).toBe(false);}
    view.showRealm();for(let i=0;i<90;i++)view.frame();
    expect(view.realmTerrain.mesh.visible).toBe(true);expect(view.terrain.mesh.visible).toBe(false);
    expect(renderer.render.mock.calls.at(-1)[0].background.getHex()).toBe(0);
  } finally {view.dispose();delete global.window;}
});
