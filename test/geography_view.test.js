jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { tileOverlay, tree, FLAT_GROUND } from "render/models";
import { BIOME_LOOKS } from "render/biomes";
import { MATURE_CANOPY_RADIUS } from "game/tree_clearance";
import { createHeightField } from "game/height";
import { Hex } from "game/hex";

it("drapes each dirt-track triangle exactly onto a steep pass and keeps it pickable", () => {
  const point=Hex(5,5).toPoint();
  const ground=createHeightField({seed:13,terrainAt:()=>"grassland",elevationAt:(x,y)=>20+Math.abs(x-point.x)*.4+Math.abs(y-point.y)*.25});
  const ecs={mappable:{tile:{terrain:"grassland",route:[0,3]}},spatial:{tile:point},walkable:{tile:{worn:{}}}};
  const model=tileOverlay(ground,ecs,"tile",{selected:false});
  expect(model.children.length).toBe(1);
  const positions=model.children[0].geometry.attributes.position;
  expect(positions.count).toBeGreaterThan(6);
  for(let i=0;i<positions.count;i++)expect(positions.getY(i)).toBeCloseTo(ground.heightAt(positions.getX(i),positions.getZ(i))+.4,3);
  model.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(point.x,1000,point.y),new THREE.Vector3(0,-1,0));
  expect(ray.intersectObject(model,true).length).toBeGreaterThan(0);
});

it("the clearance radius contains actual rendered crowns at full growth and maximum storm sway", () => {
  for(const biome of Object.keys(BIOME_LOOKS))for(const byWater of [false,true])for(let i=1;i<=9;i++){
    const id=String(i),look={biome,morality:"neutral",byWater};
    const model=tree(FLAT_GROUND,{spatial:{[id]:{x:0,y:0}},good:{[id]:{amount:3}},tree:{[id]:{fullLogs:3,stage:"mature"}}},id,look);
    const p=model.geometry.attributes.position;
    for(let j=0;j<p.count;j++){
      const radius=Math.hypot(p.getX(j),p.getZ(j));
      const sway=(Math.max(0,p.getY(j))/55)**2*1.5*2.2*5.1;
      expect(radius+sway).toBeLessThanOrEqual(MATURE_CANOPY_RADIUS);
    }
  }
});

it("renders partial route wear and removes faded dirt while retaining route sides", () => {
  const ecs={mappable:{tile:{terrain:"grassland",route:[0,3]}},spatial:{tile:Hex(5,5).toPoint()},walkable:{tile:{worn:{},routeWear:50}}};
  const partial=tileOverlay(FLAT_GROUND,ecs,"tile",{selected:false});
  expect(partial.children).toHaveLength(1);
  expect(partial.children[0].material.opacity).toBe(.5);
  ecs.walkable.tile.routeWear=0;
  expect(tileOverlay(FLAT_GROUND,ecs,"tile",{selected:false}).children).toHaveLength(0);
  expect(ecs.mappable.tile.route).toEqual([0,3]);
});
