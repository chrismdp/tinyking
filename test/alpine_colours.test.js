jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { Hex } from "game/hex";
import { createGroundColours } from "render/biomes";
import { createTerrain } from "render/terrain";

it("a thawed alpine snowfield exposes bare ground and receives actual seasonal snow through the depth buffer", () => {
  const h=Hex(0,0), state={days:4.5,map:{seed:13},world:{home:{x:0,y:0},hexes:[{x:0,y:0,temperature:"temperate",moisture:"wet",morality:"neutral"}]},
    space:{[h]:["tile"]},snow:{tile:0},snowRevision:0,ecs:{spatial:{tile:h.toPoint()},mappable:{tile:{terrain:"grassland",temperature:"cold",climateTemperature:"temperate",elevation:460}}}};
  const bare=createGroundColours(state)("tile");
  expect(bare.r).toBeLessThan(.65);
  expect(bare.g).toBeLessThan(.65);
  expect(bare.b).toBeLessThan(.65);
  const terrain=createTerrain(state,{hex:()=>({centre:460,corners:Array(6).fill(460)})});
  terrain.update();
  const original=[...terrain.mesh.geometry.attributes.color.array];
  state.snow.tile=1;state.snowRevision++;
  terrain.update();
  expect(terrain.mesh.geometry.attributes.color.array[0]).toBeGreaterThan(original[0]);
  state.snow.tile=0;state.snowRevision++;terrain.update();
  expect([...terrain.mesh.geometry.attributes.color.array]).toEqual(original);
  terrain.dispose();
});
