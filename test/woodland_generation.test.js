import { treeProbability, generateTrees } from "game/map";
import { Grid } from "game/hex";

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
