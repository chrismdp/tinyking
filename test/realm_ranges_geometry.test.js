jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { Hex } from "game/hex";
import { generateWorld } from "game/overworld";
import { createLandField, worldPoint, MAP_CENTRE } from "game/world_terrain";
import { createHeightField } from "game/height";
import { createRealmTerrain } from "render/realm_terrain";

it.each([13,20])("preserves range heights between coarse vertices against the actual local field, seed %s",seed=>{
  const world=generateWorld(seed),field=createLandField(world.landSeed),centre=MAP_CENTRE.toPoint();
  const origin=worldPoint(world.home,centre);
  const global=p=>({x:p.x-centre.x+origin.x,y:p.y-centre.y+origin.y});
  const ground=createHeightField({seed,terrainAt:k=>field.terrainAt(worldPoint(world.home,Hex(...k.split(",").map(Number)).toPoint())),elevationAt:(x,y)=>field.elevationAt(global({x,y}))});
  const natural=createHeightField({seed,terrainAt:k=>field.terrainAt(Hex(...k.split(",").map(Number)).toPoint()),elevationAt:(x,y)=>field.elevationAt({x,y})});
  const realm=createRealmTerrain({world,map:{seed},days:.375},ground);
  let high=0,retained=0,error=0,finite=true,vertices=0,vertexError=0;
  for(const mesh of realm.mesh.children) {
    const a=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<a.count;i++) {
      const p=global({x:a.getX(i),y:a.getZ(i)});
      // The active perimeter intentionally reads its actual graded surface.
      if(Math.hypot(a.getX(i)-centre.x,a.getZ(i)-centre.y)<2700)continue;
      const expected=natural.heightAt(p.x,p.y),height=a.getY(i)+.12;
      finite=finite&&Number.isFinite(height);vertices++;
      vertexError=Math.max(vertexError,Math.abs(height-expected));
    }
    for(let i=0;i<index.count;i+=3) {
      const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
      const x=ids.reduce((n,k)=>n+a.getX(k),0)/3,y=ids.reduce((n,k)=>n+a.getZ(k),0)/3;
      if(Math.hypot(x-centre.x,y-centre.y)<2700)continue;
      const p=global({x,y}),expected=natural.heightAt(p.x,p.y);
      if(expected<700)continue;
      const coarse=ids.reduce((n,k)=>n+a.getY(k)+.12,0)/3;
      high++;retained+=coarse>=expected*.75;error+=Math.abs(coarse-expected);
    }
  }
  expect(finite).toBe(true);expect(vertices).toBeGreaterThan(10000);
  // Floating-point geometry storage changes coordinates by tiny amounts.
  expect(vertexError).toBeLessThan(.1);
  expect(high).toBeGreaterThan(200);
  expect(retained/high).toBeGreaterThan(.95);
  expect(error/high).toBeLessThan(100);
  realm.dispose();
});

it('keeps close cameras above the drawn remote triangles, including after surface refresh', () => {
  const THREE=require('three'),{createCameraRig}=require('render/camera');
  const world=generateWorld(13),field=createLandField(world.landSeed),centre=MAP_CENTRE.toPoint();
  const origin=worldPoint(world.home,centre),global=p=>({x:p.x-centre.x+origin.x,y:p.y-centre.y+origin.y});
  const ground=createHeightField({seed:13,terrainAt:k=>field.terrainAt(worldPoint(world.home,Hex(...k.split(',').map(Number)).toPoint())),elevationAt:(x,y)=>field.elevationAt(global({x,y}))});
  const realm=createRealmTerrain({world,map:{seed:13},days:.375},ground);
  globalThis.window={addEventListener(){},removeEventListener(){}};
  const camera=new THREE.PerspectiveCamera(40,1.6,5,200000),dom={clientWidth:1280,clientHeight:800,style:{},addEventListener(){},removeEventListener(){}};
  const rig=createCameraRig(camera,dom,{bounds:{centre:realm.layout.centre,apothem:realm.layout.radius},groundHeight:(x,z)=>realm.heightAt(x,z),maxDistance:()=>200000,onClick(){}});
  try {
    for(const pitch of [.8,.3]) {
      const x=5480,z=14341.381-Math.cos(pitch)*120;
      rig.shot({x,z,y:realm.heightAt(x,z),distance:120,yaw:0,pitch});realm.mesh.updateMatrixWorld(true);
      const ray=new THREE.Raycaster(new THREE.Vector3(camera.position.x,10000,camera.position.z),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(realm.mesh,true)[0];expect(hit).toBeDefined();
      expect(camera.position.y-hit.point.y).toBeGreaterThanOrEqual(25-1e-3);
    }
    realm.refreshGround();
    const x=5480,y=14341.381;
    const ray=new THREE.Raycaster(new THREE.Vector3(x,10000,y),new THREE.Vector3(0,-1,0));
    expect(realm.heightAt(x,y)).toBeCloseTo(ray.intersectObject(realm.mesh,true)[0].point.y,3);
  } finally {rig.dispose();realm.dispose();delete globalThis.window;}
});
