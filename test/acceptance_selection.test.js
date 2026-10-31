jest.mock("../scripts/game-register",()=>({}));
import { discoverTimber } from "../scripts/acceptance-selection";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { resourcePermission } from "game/village_customs";
import { community } from "./support/travel";
import { newEntities } from "game/entities";

function view() {
  const {s,ids:[player,neighbour],tiles}=community();
  newEntities(s,[{spatial:{...s.ecs.spatial[player]},camp:{},controllable:{controllerId:player}}]);
  s.villages={};
  const at=Hex().fromPoint(s.ecs.spatial[player]);
  s.ecs.playable[player].known=[{x:at.x,y:at.y},{x:at.x-1,y:at.y}];
  const [tree]=newEntities(s,[{spatial:{...Hex(at.x-1,at.y).toPoint()},tree:{},good:{type:"wood",amount:5}}]);
  const g={Hex,path};
  global.window={tinyking:s,tinykingGeography:g,tinykingCustoms:{resourcePermission}};
  const page={evaluate:async(fn,arg)=>fn(arg)};
  return {s,player,neighbour,tiles,tree,page,at};
}
afterEach(()=>{delete global.window;});

it("chooses a reachable known frontier outside the old eastern strip without looking at hidden trees",async()=>{
  const {s,tree,page,at}=view();
  // INITIAL map facts: the only legal wood is still hidden. This test observes
  // the selected move, not a fabricated exploration outcome.
  s.ecs.spatial[tree]={...Hex(at.x-3,at.y).toPoint()};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("observed first frontier order");})).rejects.toThrow("observed first frontier order");
  expect(moves).toHaveLength(1);
  expect(s.ecs.playable[s.ui.playerId].known.map(h=>String(Hex(h)))).toContain(String(Hex().fromPoint(s.ecs.spatial[moves[0]])));
  expect(s.ecs.spatial[moves[0]].x).toBeLessThanOrEqual(s.ecs.spatial[s.ui.playerId].x);
});

it("counts only discovered permitted reachable timber and does not edit discovery or stock",async()=>{
  const {s,tree,page,neighbour}=view(),known=JSON.stringify(s.ecs.playable[s.ui.playerId].known),goods=JSON.stringify(s.ecs.good);
  const steps=await discoverTimber(page,5);
  expect(steps[0].trees).toEqual([tree]);expect(steps[0].logs).toBe(5);
  expect(JSON.stringify(s.ecs.playable[s.ui.playerId].known)).toBe(known);expect(JSON.stringify(s.ecs.good)).toBe(goods);
  s.ecs.controllable[tree]={id:tree,controllerId:neighbour};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("private wood excluded");})).rejects.toThrow("private wood excluded");
  expect(moves).toHaveLength(1);
});

it("does not count known timber across a disconnected route",async()=>{
  const {s,tree,page}=view();
  const tile=(s.space[Hex().fromPoint(s.ecs.spatial[tree])] || []).find(id=>s.ecs.mappable[id]);
  for(const id of Object.keys(s.ecs.walkable))for(const [side,to]of Object.entries(s.ecs.walkable[id].neighbours))if(to==tile)delete s.ecs.walkable[id].neighbours[side];
  await expect(discoverTimber(page,5)).rejects.toThrow(/"logs":0/);
});

it("prefers an already known unclaimed frontier to exploring further into private land",async()=>{
  const {s,player,page,at}=view();
  s.ecs.playable[player].known.push({x:at.x+1,y:at.y},{x:at.x+2,y:at.y});
  s.ecs.household[player]={id:player}; // INITIAL stranger at the camp, outside that household.
  const home=Object.keys(s.ecs.building)[0];
  s.ecs.household[home].plot={hexes:[String(Hex(at.x-1,at.y)),String(Hex(at.x+1,at.y))]};
  const tree=Object.keys(s.ecs.tree)[0];s.ecs.spatial[tree]={...Hex(at.x-3,at.y).toPoint()};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("frontier selected");})).rejects.toThrow("frontier selected");
  expect(resourcePermission(s,player,moves[0])).toMatchObject({kind:"unclaimed",permitted:true});
});

it("discovers native starting wood that has a standing wood good without a growth-stage tree component",async()=>{
  const {s,page,tree}=view();
  // INITIAL representation used by generateMap's existing arrival guarantee:
  // standing wood has good/spatial, while only ecological trees have tree.
  s.ecs.tree={};
  const steps=await discoverTimber(page,5);
  expect(steps[0].trees).toEqual([tree]);expect(steps[0].logs).toBe(5);
});
