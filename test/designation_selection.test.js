jest.mock("../scripts/game-register", () => ({}));
import { designationTerrain } from "../scripts/designation-selection";
import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { Hex } from "game/hex";

function view() {
  const w = peopleWorld(), s = w.state;
  s.ecs.playable[w.player].known = w.tiles.map(id => Hex().fromPoint(s.ecs.spatial[id]));
  global.window = { tinyking: s };
  return { ...w, page: { evaluate: async fn => JSON.parse(JSON.stringify(fn())) } };
}
afterEach(() => { delete global.window; });

it("selects reachable legal natural forage without a single-entity assumption or editing the world", async () => {
  const { state: s, tiles, page } = view();
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, forageable: { kind: "roots", amount: 0 } }]);
  const before = JSON.stringify(s);
  expect((await designationTerrain(page)).map(c => c.id)).toContain(tiles[0]);
  expect(JSON.stringify(s)).toBe(before);
});

it("returns standing trees only for explicit clearing and excludes foreign plants, real objects and hidden terrain", async () => {
  const { state: s, tiles, player, person, page } = view();
  const [tree] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, good: { type: "wood", amount: 4 } }]);
  expect((await designationTerrain(page)).map(c => c.id)).not.toContain(tiles[0]);
  const before = JSON.stringify(s);
  expect((await designationTerrain(page, true)).find(c => c.id == tiles[0]).trees).toEqual([tree]);
  expect(JSON.stringify(s)).toBe(before);
  s.ecs.building = { [tree]: {} };
  expect((await designationTerrain(page, true)).map(c => c.id)).not.toContain(tiles[0]);
  delete s.ecs.building[tree];
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, forageable: { kind: "roots", amount: 1 }, controllable: { controllerId: person } }]);
  expect((await designationTerrain(page, true)).map(c => c.id)).not.toContain(tiles[0]);
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[5]], immovable: true }, stockpile: {} }]);
  expect((await designationTerrain(page, true)).map(c => c.id)).not.toContain(tiles[5]);
  s.ecs.playable[player].known = [];
  expect(await designationTerrain(page, true)).toEqual([]);
});

it("does not select disconnected known terrain", async () => {
  const { state: s, tiles, page } = view();
  for (const walk of Object.values(s.ecs.walkable)) {
    for (const [side, id] of Object.entries(walk.neighbours)) if (id == tiles[5]) delete walk.neighbours[side];
  }
  expect((await designationTerrain(page)).map(c => c.id)).not.toContain(tiles[5]);
});

it("finishes actual plot cuts through Cancel without hauling or losing their logs", () => {
  const {state:s,player,tiles}=view();
  const {enqueueTask,cancelTask}=require('game/manager'),{chop_tree}=require('game/tasks');
  const {finishDesignationCuts}=require('../scripts/designation-selection');
  const [tree,standing]=newEntities(s,[tiles[0],tiles[1]].map(tile=>({spatial:{...s.ecs.spatial[tile]},good:{type:'wood',amount:3},controllable:{controllerId:player}})));
  const order=enqueueTask(s,{key:'cut_tree_down'},tree),other=enqueueTask(s,{key:'cut_tree_down'},standing);
  s.ui.actions={cancel_task:id=>cancelTask(s,id)};
  expect(finishDesignationCuts([tree])).toBe(false);
  order.assignedId=player;
  const world=s.ecs.planner[player].world;world.ordered=true;
  chop_tree(s,player,world,1/24,true,tree);
  expect(s.ecs.good[tree]).toBeUndefined();expect(order.gatheredDone).toBe(true);
  const logs=JSON.stringify(order.gathered.map(id=>({id,good:s.ecs.good[id],position:s.ecs.spatial[id],owner:s.ecs.controllable[id]})));
  expect(finishDesignationCuts([tree])).toBe(true);
  expect(s.ecs.manager[player].jobs).not.toContain(order);expect(s.ecs.manager[player].jobs).toContain(other);
  expect(JSON.stringify(order.gathered.map(id=>({id,good:s.ecs.good[id],position:s.ecs.spatial[id],owner:s.ecs.controllable[id]})))).toBe(logs);
  expect(order.gathered).toHaveLength(3);expect(s.ecs.good[standing].amount).toBe(3);
});

it("cancels only a selected tree order after another worker really fells it", () => {
  const {state:s,player,person,tiles}=view();
  const {enqueueTask,cancelTask,readyPlayerTasks}=require('game/manager'),{chop_tree}=require('game/tasks');
  const [tree]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},good:{type:'wood',amount:2}}]);
  const order=enqueueTask(s,{key:'cut_tree_down'},tree);
  s.ui.actions={cancel_task:id=>cancelTask(s,id)};
  chop_tree(s,person,{places:{},ordered:false},1/24,true,tree);
  readyPlayerTasks(s);expect(order.waiting).toBe('Target gone');
  const goods=JSON.stringify(s.ecs.good);
  expect(require('../scripts/designation-selection').finishDesignationCuts([tree])).toBe(true);
  expect(s.ecs.manager[player].jobs).not.toContain(order);expect(JSON.stringify(s.ecs.good)).toBe(goods);
});
