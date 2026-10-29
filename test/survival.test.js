import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";
import { eat, perform_subtask_in_slot, walk_to, chop_tree } from "game/tasks";
import { give } from "game/holder";
import { TRIANGLES } from "game/map";
import { HOUR } from "game/time";
import { Task } from "game/htn";

function hungryVillage() {
  const fixture = rowOfTiles(3);
  const { state, villager } = fixture;
  state.game_speed = "fast";
  state.ui.playerId = villager;
  state.ecs.personable = { [villager]: { hunger: 1.4, tiredness: 0 } };
  state.ecs.planner = { [villager]: { id: villager, world: {
    places: {}, no_place_for: {}, feeling: {}, holding: {}, days: state.days
  } } };
  state.ecs.manager = { [villager]: { jobs: [] } };
  state.ecs.sleepable = {};
  state.ecs.interior = {};
  return fixture;
}

function advance(state, days) {
  const simulation = createSimulation(state);
  for (let frame = 0; frame < days * 1440; frame++) simulation.step(1);
}

it.each(["container", "stockpile"])("finds grain in a %s and eats porridge without player orders", storage => {
  const { state, villager, tiles } = hungryVillage();
  const at = state.ecs.spatial[tiles[1]];
  const [store] = newEntities(state, [{
    spatial: { ...at, immovable: true },
    controllable: { controllerId: villager },
    ...(storage == "container" ? { container: { capacity: 30, amounts: { grain: 3 } } } : {
      stockpile: {}, holder: { capacity: 19, held: [] }
    })
  }]);
  if (storage == "stockpile") {
    const [grain] = newEntities(state, [{
      spatial: { ...at, immovable: true }, good: { type: "grain", amount: 1 }, haulable: {},
      controllable: { controllerId: villager }
    }]);
    give(state.ecs, grain, store);
  }
  advance(state, HOUR * 5);
  expect(state.ecs.personable[villager].hunger).toBeLessThan(0.3);
  expect(state.ecs.planner[villager].world.feeling.hungry).toBe(false);
});

it("hauls a harvested grain portion into the home container", () => {
  const { state, villager, tiles } = hungryVillage();
  state.ecs.personable[villager].hunger = 0;
  const [store, field] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    controllable: { controllerId: villager }, container: { capacity: 30, amounts: {} }
  }, {
    spatial: { ...state.ecs.spatial[tiles[1]], immovable: true },
    controllable: { controllerId: villager }, farmable: { slots: TRIANGLES.map((_, i) => i == 0 ? { content: "grain", amount: 1, state: "harvestable" } : { state: "harvested" }) }
  }]);
  const point = state.ecs.spatial[field];
  const world = { places: { slot: { ...point, id: field, idx: 0, result: "harvested" } } };
  perform_subtask_in_slot(state, villager, world, 0, true, field, "slot");
  state.days += HOUR;
  expect(perform_subtask_in_slot(state, villager, world, HOUR, false, field, "slot")).toBe(Task.FINISH);
  const simulation = createSimulation(state);
  for (let frame = 0; frame < 300 && !state.ecs.container[store].amounts.grain; frame++) simulation.step(1);
  expect(state.ecs.container[store].amounts.grain).toBe(1);
});

it("a full meal resets even severe hunger to zero", () => {
  const { state, villager } = hungryVillage();
  state.ecs.personable[villager].hunger = 5;
  const [meal] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[villager] }, good: { type: "grain", amount: 1 }, haulable: {}
  }]);
  give(state.ecs, meal, villager);
  const world = state.ecs.planner[villager].world;
  let result = eat(state, villager, world, HOUR / 10, true, "grain");
  for (let i = 0; i < 20 && result == Task.CONTINUE; i++) result = eat(state, villager, world, HOUR / 10, false, "grain");
  expect(result).toBe(Task.FINISH);
  expect(state.ecs.personable[villager].hunger).toBe(0);
  expect(state.ecs.holder[villager].held).toEqual([]);
});

it.each([[0.9, 1], [0.91, 0.8], [2.5, 0.8], [2.51, 0.6]])("hunger %s changes walking and working speed to %s", (hunger, factor) => {
  const moved = [];
  for (const level of [0, hunger]) {
    const { state, villager, tiles } = hungryVillage();
    state.ecs.personable[villager].hunger = level;
    const start = { ...state.ecs.spatial[villager] };
    walk_to(state, villager, { places: {} }, 0.0001, true, tiles[2]);
    moved.push(Math.hypot(state.ecs.spatial[villager].x - start.x, state.ecs.spatial[villager].y - start.y));
    const [tree] = newEntities(state, [{ spatial: { ...start, immovable: true }, good: { type: "wood", amount: 3 } }]);
    const world = {};
    let result = chop_tree(state, villager, world, HOUR / 100, true, tree);
    let ticks = 1;
    while (result == Task.CONTINUE && ticks < 200) {
      state.days += HOUR / 100;
      result = chop_tree(state, villager, world, HOUR / 100, false, tree);
      ticks++;
    }
    expect(ticks * HOUR / 100).toBeCloseTo(HOUR / 2 / (level == 0 ? 1 : factor), 2);
  }
  expect(moved[1] / moved[0]).toBeCloseTo(factor, 10);
});

it("starvation kills only beyond six days and releases the dead villager's work", () => {
  const { state, villager, tiles } = hungryVillage();
  state.ecs.personable[villager].hunger = 6 - HOUR;
  const planner = state.ecs.planner[villager];
  planner.task = ["wait_for", 10];
  planner.plan = [];
  planner.world.wait_until = 100;
  state.ecs.farmable = { [tiles[1]]: { claimerId: villager, slots: [] } };
  state.ecs.manager[villager].jobs.push({ job: { key: "move_to_here" }, targetId: tiles[2], assignedId: villager });
  const simulation = createSimulation(state);
  simulation.step(60);
  expect(state.ecs.personable[villager].dead).toBeFalsy();
  expect(state.ecs.personable[villager].starving).toBe(true);
  simulation.step(60);
  expect(state.ecs.personable[villager].dead).toBe(true);
  expect(state.redraws).toContain(villager);
  expect(state.ecs.farmable[tiles[1]].claimerId).toBeNull();
  expect(state.ecs.manager[villager].jobs[0].assignedId).toBeNull();
  expect(planner.task).toBeNull();
});

it("dead people never plan, move, eat, or accumulate needs", () => {
  const { state, villager } = hungryVillage();
  state.ecs.personable[villager].dead = true;
  const before = structuredClone(state.ecs.personable[villager]);
  const position = { ...state.ecs.spatial[villager] };
  advance(state, HOUR * 3);
  expect(state.ecs.personable[villager]).toEqual(before);
  expect(state.ecs.spatial[villager]).toEqual(position);
  expect(state.ecs.planner[villager].task).toBeFalsy();
});

it("eating clears the starving flag immediately", () => {
  const { state, villager } = hungryVillage();
  state.ecs.personable[villager].hunger = 3;
  state.ecs.personable[villager].starving = true;
  const [meal] = newEntities(state, [{ spatial: { ...state.ecs.spatial[villager] }, good: { type: "grain", amount: 1 }, haulable: {} }]);
  give(state.ecs, meal, villager);
  eat(state, villager, {}, HOUR, true, "grain");
  expect(state.ecs.personable[villager].starving).toBe(false);
});
