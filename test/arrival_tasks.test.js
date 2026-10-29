import { Grid, Hex } from "game/map";
import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { enqueueTask, reorderTask, cancelTask } from "game/manager";
import { createSimulation } from "game/simulation";
import { placeShelter, STAGES } from "game/construction";
import { find_place } from "game/tasks";

function arrival() {
  const f = rowOfTiles(5);
  const { state, villager: player, tiles } = f;
  state.ui.playerId = player;
  state.game_speed = "fast";
  state.ecs.personable = { [player]: { hunger: 0, tiredness: 0 } };
  state.ecs.playable[player] = { id: player, known: [] };
  state.ecs.planner = { [player]: { id: player, world: {
    places: {}, no_place_for: {}, feeling: {}, holding: {}, days: state.days, ordered: true
  } } };
  state.ecs.manager = { [player]: { id: player, ordered: true, jobs: [] } };
  state.ecs.building = {};
  state.ecs.container = {};
  state.ecs.interior = {};
  const [camp] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    camp: {}, controllable: { controllerId: player }, sleepable: { capacity: 1, occupiers: [] } }]);
  const sim = createSimulation(state);
  const step = (hours = 1) => { for (let n = 0; n < hours * 60; n++) sim.step(1); };
  return { ...f, player, camp, step };
}

it("appends orders with favour metadata, reorders, cancels, and advances in user order", () => {
  const { state, player, tiles, step } = arrival();
  const jobs = state.ecs.manager[player].jobs;
  const a = enqueueTask(state, { key: "move_to_here" }, tiles[3]);
  const b = enqueueTask(state, { key: "create_field" }, tiles[2], { forId: "agnes", expectedGoodwill: "about +9 goodwill" });
  const c = enqueueTask(state, { key: "move_to_here" }, tiles[4]);
  expect(jobs.map(j => j.id)).toEqual([a.id, b.id, c.id]);
  expect(b.forId).toBe("agnes");
  reorderTask(state, c.id, 1);
  expect(jobs.map(j => j.id)).toEqual([a.id, c.id, b.id]);
  cancelTask(state, c.id);
  step(0.1);
  expect(jobs[0].assignedId).toBe(player);
  for (let i = 0; i < 100 && jobs[0]?.id == a.id; i++) step(1 / 60);
  expect(jobs.map(j => j.id)).toEqual([b.id]);
  step(1);
  expect(jobs).toEqual([]);
  expect(Object.keys(state.ecs.farmable)).toHaveLength(1);
});

it("cancels running work without later completing it, and can reorder the active task", () => {
  const { state, player, tiles, step } = arrival();
  const a = enqueueTask(state, { key: "create_field" }, tiles[4]);
  const b = enqueueTask(state, { key: "move_to_here" }, tiles[1]);
  step(0.05);
  reorderTask(state, b.id, 0);
  step(0.3);
  cancelTask(state, a.id);
  step(2);
  expect(Object.keys(state.ecs.farmable || {})).toHaveLength(0);
  expect(state.ecs.manager[player].jobs).toEqual([]);
});

it("delivers logs before work, then upgrades lean-to, hut and house in the same place", () => {
  const { state, player, camp, tiles, step } = arrival();
  const site = placeShelter(state, tiles[1]);
  const position = { ...state.ecs.spatial[site] };
  for (const stage of ["lean-to", "hut", "house"]) {
    if (stage != "lean-to") expect(placeShelter(state, site)).toBe(site);
    enqueueTask(state, { key: "build_shelter" }, site);
    step(0.5);
    expect(state.ecs.construction[site].work).toBe(0);
    newEntities(state, Array.from({ length: STAGES[stage].logs }, () => ({
      spatial: { ...state.ecs.spatial[camp] }, good: { type: "wood", amount: 1 }, haulable: {},
      controllable: { controllerId: player }
    })));
    // No meal pressure during this isolated construction check.
    for (let i = 0; i < 48 && state.ecs.construction[site]; i++) {
      state.ecs.personable[player].hunger = 0;
      step(0.5);
    }
    expect(state.ecs.shelter[site].stage).toBe(stage);
    expect(state.ecs.spatial[site]).toEqual(position);
    expect(state.ecs.construction[site]).toBeUndefined();
    expect(state.ecs.container[site].capacity).toBeGreaterThan(0);
  }
  const world = state.ecs.planner[player].world;
  delete world.places.sleep;
  find_place(state, player, world, 0, true, "sleep", "allows_sleep");
  expect(world.places.sleep).toBe(site);
});

it("a hungry player forages and survives ten days from an empty camp", () => {
  const { state, player, tiles, step } = arrival();
  newEntities(state, Array.from({ length: 12 }, (_, i) => ({
    spatial: { ...state.ecs.spatial[tiles[1 + i % 4]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 }
  })));
  step(24 * 10);
  expect(state.ecs.personable[player].dead).toBeFalsy();
  expect(state.ecs.personable[player].hunger).toBeLessThan(2.5);
  expect(Object.values(state.ecs.forageable).some(p => p.amount == 0)).toBe(true);
});

it("a player who never eats reaches Starving", () => {
  const { state, player, step } = arrival();
  step(24 * 3);
  expect(state.ecs.personable[player].starving).toBe(true);
  expect(state.ecs.personable[player].dead).toBeFalsy();
});

it("chops and forages through the queue, carries both to camp, and reports work progress", () => {
  const { state, player, camp, tiles, step } = arrival();
  const [tree, bush] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[2]], immovable: true },
    good: { type: "wood", amount: 2 } }, { spatial: { ...state.ecs.spatial[tiles[1]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 } }]);
  const chop = enqueueTask(state, { key: "cut_tree_down" }, tree);
  enqueueTask(state, { key: "forage" }, bush);
  step(0.4);
  expect(chop.progress).toBeGreaterThan(0);
  step(4);
  expect(state.ecs.manager[player].jobs).toEqual([]);
  const goods = Object.keys(state.ecs.haulable).filter(id => !state.ecs.haulable[id].heldBy);
  expect(goods.filter(id => state.ecs.good[id].type == "wood")).toHaveLength(2);
  expect(goods.filter(id => state.ecs.good[id].type == "forage")).toHaveLength(1);
  for (const id of goods) expect(Math.hypot(state.ecs.spatial[id].x - state.ecs.spatial[camp].x,
    state.ecs.spatial[id].y - state.ecs.spatial[camp].y)).toBeLessThan(40);
});

it("resumes a chopped tree's delivery after reordering and keeps meals intact when appending", () => {
  const { state, player, tiles, step } = arrival();
  const [tree] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[4]], immovable: true }, good: { type: "wood", amount: 3 } }]);
  const chop = enqueueTask(state, { key: "cut_tree_down" }, tree);
  for (let i = 0; i < 150 && state.ecs.good[tree]; i++) step(1 / 60);
  const move = enqueueTask(state, { key: "move_to_here" }, tiles[1]);
  reorderTask(state, move.id, 0);
  step(5);
  expect(state.ecs.manager[player].jobs).toEqual([]);
  expect(chop.progress).toBe(1);
  const planner = state.ecs.planner[player];
  planner.task = ["eat", "forage"];
  planner.plan = [];
  planner.world.mealRemaining = 0.02;
  enqueueTask(state, { key: "move_to_here" }, tiles[1]);
  expect(planner.task).toEqual(["eat", "forage"]);
});

it("cancelling queued work leaves a meal in progress intact", () => {
  const { state, player, tiles } = arrival();
  const job = enqueueTask(state, { key: "move_to_here" }, tiles[1]);
  const planner = state.ecs.planner[player];
  planner.task = ["eat", "forage"];
  planner.world.mealRemaining = 0.02;
  cancelTask(state, job.id);
  expect(planner.task).toEqual(["eat", "forage"]);
});

it("the bedroll is used for sleep before building, then gathered food is stored and eaten from the lean-to", () => {
  const { state, player, camp, tiles, step } = arrival();
  const world = state.ecs.planner[player].world;
  state.days = world.days = 0.9;
  state.ecs.personable[player].tiredness = 1.1;
  step(1);
  expect(world.places.sleep).toBe(camp);
  state.days = world.days = 1.375;
  state.ecs.personable[player].tiredness = 0;
  world.feeling.tired = false;
  state.ecs.planner[player].task = null;
  state.ecs.planner[player].plan = null;
  const site = placeShelter(state, tiles[1]);
  newEntities(state, Array.from({ length: 4 }, () => ({ spatial: { ...state.ecs.spatial[camp] },
    good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: player } })));
  enqueueTask(state, { key: "build_shelter" }, site);
  step(4);
  expect(state.ecs.shelter[site].stage).toBe("lean-to");
  const [bush] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[2]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 } }]);
  enqueueTask(state, { key: "forage" }, bush);
  step(3);
  expect(state.ecs.container[site].amounts.forage).toBe(1);
  state.ecs.personable[player].hunger = 1.3;
  step(5);
  expect(state.ecs.container[site].amounts.forage).toBe(0);
  expect(state.ecs.personable[player].hunger).toBeLessThan(0.5);
});

it("requires the full work time after delivery and combines effort from two workers", () => {
  const { state, player, tiles } = arrival();
  const site = placeShelter(state, tiles[1]);
  enqueueTask(state, { key: "build_shelter" }, site);
  const [helper] = newEntities(state, [{ spatial: { ...state.ecs.spatial[site] },
    controllable: { controllerId: player }, holder: { held: [], capacity: 2 }, personable: { hunger: 0 } }]);
  state.ecs.spatial[player] = { ...state.ecs.spatial[site] };
  state.ecs.planner[helper] = { world: { places: { sleep: "own-bed" } } };
  const world = state.ecs.planner[player].world;
  const helperWorld = { places: {}, holding: {} };
  const work = require("game/construction").workOnShelter;
  state.ecs.construction[site].delivered = 4;
  expect(work(state, player, world, 1 / 24, true, site)).toBe(2);
  expect(state.ecs.construction[site].work).toBe(1);
  expect(state.ecs.shelter[site].stage).toBeNull();
  expect(work(state, helper, helperWorld, 1 / 24, true, site)).toBe(1);
  expect(state.ecs.shelter[site].stage).toBe("lean-to");
  expect(state.ecs.household[helper]).toBeUndefined();
  expect(state.ecs.planner[helper].world.places.sleep).toBe("own-bed");
});

it("allows repeated destinations and keeps an eaten plant waiting while later orders finish", () => {
  const { state, player, tiles, step } = arrival();
  const [bush] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 0, growth: 0 } }]);
  const forage = enqueueTask(state, { key: "forage" }, bush);
  const a = enqueueTask(state, { key: "move_to_here" }, tiles[2]);
  const b = enqueueTask(state, { key: "move_to_here" }, tiles[2]);
  expect(a.id).not.toBe(b.id);
  expect(state.ecs.manager[player].jobs).toHaveLength(3);
  step(2);
  expect(state.ecs.manager[player].jobs).toEqual([forage]);
  expect(forage.waiting).toBe("Waiting for food to grow");
  expect(a.progress).toBe(1);
  expect(b.progress).toBe(1);
});


it("takes construction wood from a stockpile and redraws it after pickup", () => {
  const { state, player, tiles, step } = arrival();
  const [store, log] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    stockpile: {}, holder: { held: [], capacity: 19 }, controllable: { controllerId: player } },
  { spatial: { ...state.ecs.spatial[tiles[0]], immovable: true }, good: { type: "wood", amount: 1 },
    haulable: {}, controllable: { controllerId: player } }]);
  require("game/holder").give(state.ecs, log, store);
  const site = placeShelter(state, tiles[1]);
  enqueueTask(state, { key: "build_shelter" }, site);
  state.redraws = [];
  state.ecs.playable[player].known = Grid.hexagon({ center: Hex(0, 0), radius: 6 }).map(h => ({ x: h.x, y: h.y }));
  for (let n = 0; n < 60 && state.ecs.holder[store].held.length; n++) step(1 / 60);
  expect(state.ecs.holder[store].held).toEqual([]);
  expect(state.redraws).toContain(store);
  expect(state.space[Hex().fromPoint(state.ecs.spatial[store])]).not.toContain(log);
});

it("cancels a running forage order from the existing popup without inventing held food", () => {
  const { state, player, tiles, step } = arrival();
  const [bush] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[1]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 } }]);
  enqueueTask(state, { key: "forage" }, bush);
  for (let n = 0; n < 60 && state.ecs.planner[player].task?.[0] != "forage"; n++) step(1 / 60);
  expect(state.ecs.planner[player].task[0]).toBe("forage");
  require("game/manager").cancelJob(state, player, "forage", bush);
  step(0.1);
  expect(state.ecs.manager[player].jobs).toEqual([]);
  expect(state.ecs.planner[player].world.holding.forage).toBeFalsy();
  expect(state.ecs.forageable[bush].amount).toBe(1);
});

it("waits for logs without chopping on its own and runs the next task", () => {
  const { state, player, tiles, step } = arrival();
  const [tree] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[3]], immovable: true }, good: { type: "wood", amount: 4 } }]);
  const site = placeShelter(state, tiles[1]);
  const build = enqueueTask(state, { key: "build_shelter" }, site);
  const move = enqueueTask(state, { key: "move_to_here" }, tiles[2]);
  step(2);
  expect(build.waiting).toBe("Waiting for logs");
  expect(build.detail).toBe("Waiting for logs · 0 of 4");
  expect(build.assignedId).toBeFalsy();
  expect(state.ecs.good[tree].amount).toBe(4);
  expect(move.progress).toBe(1);
  expect(state.ecs.manager[player].jobs).toEqual([build]);
});

it("stores chopped logs at camp then resumes the waiting build before later work", () => {
  const { state, player, camp, tiles, step } = arrival();
  const [tree] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[3]], immovable: true }, good: { type: "wood", amount: 4 } }]);
  const site = placeShelter(state, tiles[1]);
  const build = enqueueTask(state, { key: "build_shelter" }, site);
  const chop = enqueueTask(state, { key: "cut_tree_down" }, tree);
  const later = enqueueTask(state, { key: "create_field" }, tiles[4]);
  step(0.1);
  expect(build.waiting).toBe("Waiting for logs");
  expect(chop.assignedId).toBe(player);
  for (let n = 0; n < 500 && state.ecs.manager[player].jobs.includes(chop); n++) step(1 / 60);
  const logs = Object.keys(state.ecs.haulable).filter(id => state.ecs.good[id]?.type == "wood");
  expect(logs).toHaveLength(4);
  for (const id of logs) expect(Hex().fromPoint(state.ecs.spatial[id])).toEqual(Hex().fromPoint(state.ecs.spatial[camp]));
  for (let n = 0; n < 500 && state.ecs.construction[site]; n++) step(1 / 60);
  expect(state.ecs.shelter[site].stage).toBe("lean-to");
  expect(build.progress).toBe(1);
  expect(later.progress).toBe(0);
});

it("builds immediately from an owned store, without a gathering order", () => {
  const { state, camp, tiles, step } = arrival();
  state.ecs.container[camp] = { capacity: 8, amounts: { wood: 4 } };
  const site = placeShelter(state, tiles[1]);
  const build = enqueueTask(state, { key: "build_shelter" }, site);
  step(4);
  expect(build.progress).toBe(1);
  expect(state.ecs.container[camp].amounts.wood).toBe(0);
  expect(state.ecs.shelter[site].stage).toBe("lean-to");
});

it("cancels a waiting build without interrupting a later running task", () => {
  const { state, player, tiles, step } = arrival();
  const site = placeShelter(state, tiles[1]);
  const build = enqueueTask(state, { key: "build_shelter" }, site);
  const field = enqueueTask(state, { key: "create_field" }, tiles[3]);
  step(0.1);
  expect(build.waiting).toBe("Waiting for logs");
  const running = state.ecs.planner[player].task;
  cancelTask(state, build.id);
  expect(state.ecs.planner[player].task).toEqual(running);
  step(2);
  expect(field.progress).toBe(1);
  expect(state.ecs.manager[player].jobs).toEqual([]);
  expect(state.ecs.construction[site].delivered).toBe(0);
});

it.each(["move_to_here", "cut_tree_down", "forage", "recruit", "create_field", "create_stockpile", "build_shelter"])("keeps a missing %s target with a reason and advances the queue", key => {
  const { state, player, tiles, step } = arrival();
  const gone = enqueueTask(state, { key }, "gone");
  const next = enqueueTask(state, { key: "move_to_here" }, tiles[2]);
  step(2);
  expect(gone.waiting).toBe("Target gone");
  expect(next.progress).toBe(1);
  expect(state.ecs.manager[player].jobs).toEqual([gone]);
});

it("skips unreachable work then retries it when the route opens", () => {
  const { state, tiles, step } = arrival();
  const links = { ...state.ecs.walkable[tiles[1]].neighbours };
  state.ecs.walkable[tiles[1]].neighbours = {};
  const blocked = enqueueTask(state, { key: "create_field" }, tiles[4]);
  const next = enqueueTask(state, { key: "move_to_here" }, tiles[0]);
  step(1);
  expect(blocked.waiting).toBe("No path there");
  expect(next.progress).toBe(1);
  state.ecs.walkable[tiles[1]].neighbours = links;
  step(3);
  expect(blocked.progress).toBe(1);
});

it("keeps a depleted plant waiting and retries when food grows back", () => {
  const { state, tiles, step } = arrival();
  const [bush] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[1]], immovable: true }, forageable: { kind: "roots", biome: "grassland", amount: 0, growth: 0 } }]);
  const forage = enqueueTask(state, { key: "forage" }, bush);
  const next = enqueueTask(state, { key: "move_to_here" }, tiles[2]);
  step(1);
  expect(forage.waiting).toBe("Waiting for food to grow");
  expect(next.progress).toBe(1);
  state.ecs.forageable[bush].amount = 1;
  step(3);
  expect(forage.progress).toBe(1);
});

it("delivers partial stores, waits with the delivered count, then wakes when more logs arrive", () => {
  const { state, camp, tiles, step } = arrival();
  state.ecs.container[camp] = { capacity: 8, amounts: { wood: 1 } };
  const site = placeShelter(state, tiles[1]);
  const build = enqueueTask(state, { key: "build_shelter" }, site);
  step(1);
  expect(build.detail).toBe("Waiting for logs · 1 of 4");
  expect(state.ecs.construction[site].work).toBe(0);
  state.ecs.container[camp].amounts.wood = 3;
  step(4);
  expect(state.ecs.shelter[site].stage).toBe("lean-to");
});

it("retains a target removed during a walk and completes the next task", () => {
  const { state, player, tiles, step } = arrival();
  const [tree] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[4]], immovable: true }, good: { type: "wood", amount: 4 } }]);
  const chop = enqueueTask(state, { key: "cut_tree_down" }, tree);
  const next = enqueueTask(state, { key: "move_to_here" }, tiles[0]);
  step(1 / 60);
  require("game/entities").deleteEntity(state, tree);
  step(1);
  expect(chop.waiting).toBe("Target gone");
  expect(next.progress).toBe(1);
  expect(state.ecs.manager[player].jobs).toEqual([chop]);
});

it("yields a runtime failure and retries after the character finishes another task", () => {
  const { state, player, tiles, step } = arrival();
  const [bush] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 } }]);
  state.ecs.holder[player].capacity = 0;
  const forage = enqueueTask(state, { key: "forage" }, bush);
  const move = enqueueTask(state, { key: "move_to_here" }, tiles[1]);
  step(1);
  expect(forage.waiting).toBe("Can't do this yet");
  expect(move.progress).toBe(1);
  state.ecs.holder[player].capacity = 2;
  step(3);
  expect(forage.progress).toBe(1);
});

it("reorders the active task behind later work even with a waiting task first", () => {
  const { state, player, tiles, step } = arrival();
  const site = placeShelter(state, tiles[1]);
  enqueueTask(state, { key: "build_shelter" }, site);
  const active = enqueueTask(state, { key: "create_field" }, tiles[4]);
  const next = enqueueTask(state, { key: "move_to_here" }, tiles[0]);
  step(0.1);
  expect(active.assignedId).toBe(player);
  reorderTask(state, active.id, 2);
  for (let n = 0; n < 120 && next.progress != 1; n++) step(1 / 60);
  expect(next.progress).toBe(1);
  expect(active.progress).toBe(0);
});

it("uses reachable stored logs when the first owned stockpile cannot be reached", () => {
  const { state, player, camp, tiles, step } = arrival();
  const [store, log] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[4]], immovable: true },
    stockpile: {}, holder: { held: [], capacity: 19 }, controllable: { controllerId: player } },
  { spatial: { ...state.ecs.spatial[tiles[4]] }, good: { type: "wood", amount: 1 },
    haulable: {}, controllable: { controllerId: player } }]);
  require("game/holder").give(state.ecs, log, store);
  state.ecs.walkable[tiles[2]].neighbours = {};
  state.ecs.container[camp] = { capacity: 8, amounts: { wood: 4 } };
  const site = placeShelter(state, tiles[1]);
  const build = enqueueTask(state, { key: "build_shelter" }, site);
  step(4);
  expect(build.progress).toBe(1);
  expect(state.ecs.shelter[site].stage).toBe("lean-to");
  expect(state.ecs.holder[store].held).toEqual([log]);
});

it("wakes waiting work without restarting a walk to sleep", () => {
  const { state, player, camp, tiles, step } = arrival();
  state.ecs.container[camp] = { capacity: 8, amounts: { wood: 4 } };
  const site = placeShelter(state, tiles[1]);
  enqueueTask(state, { key: "build_shelter" }, site);
  const planner = state.ecs.planner[player];
  state.ecs.spatial[player] = { ...state.ecs.spatial[tiles[4]] };
  planner.world.places.sleep = camp;
  state.days = planner.world.days = 0.9;
  planner.world.feeling.tired = true;
  planner.task = ["walk_to", "sleep"];
  planner.plan = [["sleep"]];
  require("game/tasks").walk_to(state, player, planner.world, 0, true, "sleep");
  const plan = planner.plan;
  step(1 / 60);
  expect(planner.plan).toBe(plan);
  expect(planner.task).toEqual(["walk_to", "sleep"]);
});

it("skips a chop delivery that cannot pick up its logs and runs later work", () => {
  const { state, player, tiles, step } = arrival();
  const [tree] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[1]], immovable: true }, good: { type: "wood", amount: 1 } }]);
  state.ecs.holder[player].capacity = 0;
  const chop = enqueueTask(state, { key: "cut_tree_down" }, tree);
  const next = enqueueTask(state, { key: "move_to_here" }, tiles[2]);
  step(2);
  expect(chop.waiting).toBe("Can't do this yet");
  expect(next.progress).toBe(1);
});
