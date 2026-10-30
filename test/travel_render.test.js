jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { tree, foragePlant, groundItem, FLAT_GROUND } from "render/models";
import { treeKind, BIOME_LOOKS } from "render/biomes";

it("renders stable finite vegetation and cargo transforms for independently namespaced maps",()=>{
 for(const id of ["w5_2-1650","w6_3-1650","w5_2-3143"]){
  const ecs={spatial:{[id]:{x:100,y:200}},good:{[id]:{type:"wood",amount:2}},tree:{[id]:{stage:"mature",fullLogs:2}}};
  for(const biome of Object.keys(BIOME_LOOKS)){
   const look={biome,morality:"neutral",byWater:true};expect(treeKind(look,id)).toBeTruthy();expect(treeKind(look,id)).toBe(treeKind(look,id));
   const model=tree(FLAT_GROUND,ecs,id,look);model.updateMatrixWorld();expect(model.matrixWorld.elements.every(Number.isFinite)).toBe(true);
  }
  const bush=foragePlant(FLAT_GROUND,{days:1,ecs:{spatial:ecs.spatial,forageable:{[id]:{kind:"berries",amount:1}}}},id);bush.updateMatrixWorld();expect(bush.matrixWorld.elements.every(Number.isFinite)).toBe(true);
  const item=groundItem(FLAT_GROUND,ecs,id);item.updateMatrixWorld();expect(item.matrixWorld.elements.every(Number.isFinite)).toBe(true);
 }
});
it("keeps existing numeric tree variation and orientation",()=>{
 const id="1650",look={biome:"grassland",morality:"neutral",byWater:false},kinds=Object.keys(BIOME_LOOKS.grassland.trees);
 expect(treeKind(look,id)).toBe(kinds[(+id*7)%kinds.length]);
 const model=tree(FLAT_GROUND,{spatial:{[id]:{x:0,y:0}},good:{[id]:{amount:2}}},id,look);expect(model.rotation.y).toBe((+id*2.399)%(Math.PI*2));
});
