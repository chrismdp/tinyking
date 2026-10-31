jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { Hex } from "game/hex";
import { MAP_CENTRE, worldPoint, createLandField } from "game/world_terrain";
import { createHeightField } from "game/height";
import { realmLayout, createRealmTerrain, overviewLevel } from "render/realm_terrain";
import { knownCommunities, reachFacts, inspectRealm, setMapLayer } from "game/realm_map";

const world={landSeed:"13:0",home:{x:0,y:0},hexes:[{x:0,y:0,biome:"grassland",temperature:"temperate"},{x:1,y:0,biome:"taiga",temperature:"cold"}]};
it("tiles coarse reaches on canonical world coordinates, shares exact boundaries and active heights",()=>{
  const layout=realmLayout(world);
  expect(layout.reaches[1].centre.x-layout.reaches[0].centre.x).toBeCloseTo(worldPoint({x:1,y:0},MAP_CENTRE.toPoint()).x);
  const ground=createHeightField({seed:13,terrainAt:()=>"grassland",cornerAt:()=>321});
  const state={world,days:.375,ecs:{spatial:{},mappable:{}},map:{centre:MAP_CENTRE,radius:22}};
  const mesh=createRealmTerrain(state,ground);
  const a=mesh.boundaries.get("0,0"), b=mesh.boundaries.get("1,0"), shared=a.filter(p=>b.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<.01));
  expect(shared.length).toBeGreaterThan(20);
  for(const p of shared) { expect(p.y).toBe(321);expect(b.find(q=>Math.hypot(p.x-q.x,p.z-q.z)<.01).y).toBe(p.y); }
  expect(mesh.mesh.geometry.attributes.position.count/3).toBeLessThan(20000);
  const remote=mesh.mesh.children[0].geometry.attributes.position;
  expect([...remote.array].every(Number.isFinite)).toBe(true);
  expect(Math.max(...Array.from({length:remote.count},(_,i)=>remote.getY(i)))).toBeGreaterThan(100);
  const disposed=jest.spyOn(mesh.mesh.geometry,"dispose");mesh.dispose();expect(disposed).toHaveBeenCalledTimes(1);
});
it("bounds every actual reach, and stages detail without changing world scale",()=>{
  const layout=realmLayout(world);
  for(const reach of layout.reaches)for(const p of reach.border) {
    expect(p.x).toBeGreaterThanOrEqual(layout.min.x);expect(p.x).toBeLessThanOrEqual(layout.max.x);
    expect(p.y).toBeGreaterThanOrEqual(layout.min.y);expect(p.y).toBeLessThanOrEqual(layout.max.y);
  }
  expect(overviewLevel(900)).toEqual(expect.objectContaining({people:true,props:true,communities:false}));
  expect(overviewLevel(3400)).toEqual(expect.objectContaining({people:false,props:true,communities:true}));
  expect(overviewLevel(18000)).toEqual(expect.objectContaining({people:false,props:false,reaches:true}));
});
const fixture=()=>{
  const point=MAP_CENTRE.toPoint(), tile=String(MAP_CENTRE);
  return {world,days:.375,ui:{playerId:"you",show:{}},travel:{active:"0,0",maps:{},people:{}},
    ecs:{spatial:{green:point,house:point,elder:point},meetingPlace:{green:{kind:"green"}},building:{house:{}},
      household:{elder:{houseId:"house"},house:{plot:{hexes:[tile]}}},village:{elder:{villageId:"v"},house:{villageId:"v"}},
      personable:{elder:{age:70},secret:{age:40}},nameable:{elder:{nickname:"Ada"},secret:{nickname:"Secret"}},
      controllable:{house:{controllerId:"secret"}},playable:{you:{known:[]}},relationships:{}},
    knowledge:{you:{people:{}}},villages:{v:{id:"v",name:"Oakstead",houses:["house"],sharedPlaces:["green"]}}};
};
it("uses the actor's discovered village and real household/elder roles without leaking identities",()=>{
  const s=fixture();expect(knownCommunities(s)).toEqual([]);
  s.ecs.playable.you.known.push({x:MAP_CENTRE.x,y:MAP_CENTRE.y});
  const [v]=knownCommunities(s);expect(v.name).toBe("Oakstead");expect(v.elder).toBe("an unknown person");
  expect(v.households[0].owner).toBe("an unknown person");expect(JSON.stringify(v)).not.toContain("Secret");
  s.knowledge.you.people.elder={conversation:{day:0}};
  expect(knownCommunities(s)[0].elder).toBe("Ada");
  expect(reachFacts(s,world.hexes[1]).communities).toEqual([]);
  s.travel.maps["1,0"]={...s,villages:{v:{...s.villages.v,name:"Hidden remote"}},ecs:{...s.ecs,playable:{}}};
  expect(JSON.stringify(reachFacts(s,world.hexes[1]))).not.toContain("Hidden remote");
  s.ecs.playable.you.knownByMap={"1,0":[{x:MAP_CENTRE.x,y:MAP_CENTRE.y}]};
  expect(reachFacts(s,world.hexes[1]).communities[0].name).toBe("Hidden remote");
  s.ui.playerId="heir";s.ecs.playable.heir={known:[]};
  expect(reachFacts(s,world.hexes[1]).communities).toEqual([]);
});
it("inspection and layer changes only change view state; weather is the real model object",()=>{
  const s=fixture();s.weather={"1,0":{type:"snow",wind:{x:-.8,y:.6,strength:.4},pressure:1001}};
  const before=JSON.stringify({ecs:s.ecs,travel:s.travel,days:s.days,world:s.world,weather:s.weather});
  inspectRealm(s,"1,0");setMapLayer(s,"wind",true);setMapLayer(s,"weather",false);
  expect(s.ui.realmSelection).toEqual({reachKey:"1,0",villageId:null});
  expect(s.ui.mapLayers).toEqual(expect.objectContaining({wind:true,weather:false,communities:true}));
  expect(reachFacts(s,world.hexes[1]).weather).toBe(s.weather["1,0"]);
  expect(JSON.stringify({ecs:s.ecs,travel:s.travel,days:s.days,world:s.world,weather:s.weather})).toBe(before);
});

it("keeps every coarse land vertex finite and samples real relief beyond the active map",()=>{
  const field=createLandField("13:0");
  const candidates=Array.from({length:121},(_,i)=>({x:i%11,y:Math.floor(i/11)}));
  const h=candidates.find(h=>field.landAt(worldPoint(h,MAP_CENTRE.toPoint()))>.3 && field.elevationAt(worldPoint(h,MAP_CENTRE.toPoint()))>600);
  expect(h).toBeDefined();
  const w={...world,home:{x:h.x-1,y:h.y},hexes:[{...world.hexes[0],x:h.x-1,y:h.y},{...world.hexes[1],...h}]};
  const ground=createHeightField({seed:13,terrainAt:()=>"grassland",cornerAt:()=>100});
  const terrain=createRealmTerrain({world:w,map:{seed:13},days:.375},ground);
  const remote=terrain.mesh.children[0].geometry.attributes.position;
  expect([...remote.array].every(Number.isFinite)).toBe(true);
  expect(Math.max(...Array.from({length:remote.count},(_,i)=>remote.getY(i)))).toBeGreaterThan(400);
  terrain.dispose();
});

it.each([[1440,900],[390,664]])("fits the finite realm's real 3D bounds without a distant empty margin at %sx%s",(width,height)=>{
  const THREE=require("three"), {WorldGrid,WorldHex}=require("game/hex");
  const hexes=[...WorldGrid.hexagon({center:WorldHex(5,5),radius:5})].map(h=>({x:h.x,y:h.y,biome:"grassland",temperature:"temperate"}));
  const state={world:{landSeed:"13:0",home:{x:5,y:3},hexes},map:{seed:13},days:.375};
  const ground=createHeightField({seed:13,terrainAt:()=>"grassland",cornerAt:()=>100});
  const terrain=createRealmTerrain(state,ground), aspect=width/height, pitch=.95;
  expect(terrain.triangles).toBeLessThan(70000);
  const d=terrain.fitDistance(aspect,40,0,pitch,(height-190)/height), c=terrain.layout.centre;
  const y=terrain.heightAt(c.x,c.y),camera=new THREE.PerspectiveCamera(40,aspect,5,d*10);
  camera.position.set(c.x,y+Math.sin(pitch)*d,c.y+Math.cos(pitch)*d);camera.lookAt(c.x,y,c.y);camera.updateMatrixWorld();
  let extent=0,finite=true,xMax=0,yMax=0,zMax=-Infinity;
  terrain.mesh.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).project(camera);
      finite=finite && Number.isFinite(p.y);xMax=Math.max(xMax,Math.abs(p.x));yMax=Math.max(yMax,Math.abs(p.y));zMax=Math.max(zMax,p.z);
      extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y));
    }
  });
  expect(finite).toBe(true);expect(xMax).toBeLessThan(.93);expect(yMax).toBeLessThan(.95);expect(zMax).toBeLessThan(1);
  expect(extent).toBeGreaterThan(.65);
  terrain.dispose();
});

it("samples shared geometry vertices once instead of repeating active ground queries per triangle",()=>{
  const ground=createHeightField({seed:13,terrainAt:()=>"grassland",cornerAt:()=>100});
  const query=jest.spyOn(ground,"heightAt");
  const terrain=createRealmTerrain({world,map:{seed:13},days:.375},ground);
  expect(query.mock.calls.length).toBeLessThan(6000);
  terrain.dispose();
});
