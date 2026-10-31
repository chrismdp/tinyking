jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { building, FLAT_GROUND } from "render/models";
import { villageModel } from "render/villages";
import { expandedFootprint } from "game/settlement_growth";

it.each(["home","alehouse","carpenter"])("keeps every %s addition inside its actual tree-clearance envelope",kind=>{
  const s={ecs:{spatial:{a:{x:0,y:0}},growth:{a:{stage:0}},...(kind=="home"?{building:{a:{entrance:1}}}:kind=="alehouse"?{meetingPlace:{a:{kind}}}:{workplace:{a:{trade:kind}}})}};
  const depths=[];
  for(const stage of [0,1,2]) {
    s.ecs.growth.a.stage=stage;
    const f=expandedFootprint(s,"a",stage), model=kind=="home"?building(FLAT_GROUND,s,"a",{}):villageModel(FLAT_GROUND,s,"a");
    const box=new THREE.Box3().setFromObject(model);
    expect(box.min.z).toBeGreaterThanOrEqual(f.y-f.halfDepth-.6);
    expect(box.min.x).toBeGreaterThanOrEqual(f.x-f.halfWidth-.6);
    expect(box.max.x).toBeLessThanOrEqual(f.x+f.halfWidth+.6);
    depths.push(box.min.z);
  }
  expect(depths[1]).toBeLessThan(depths[0]);
  expect(depths[2]).toBeLessThan(depths[1]);
});
