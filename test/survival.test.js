import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";
import { eat, perform_subtask_in_slot, walk_to, chop_tree, pick_up_from_stockpile, find_place } from "game/tasks";
import { give } from "game/holder";
import { TRIANGLES, Hex, Grid, ALL_SIDES } from "game/map";
import { addBidirectionalLink } from "game/pathfinding";
import { HOUR } from "game/time";
import { anyControlledAlive } from "game/playable";
import { Task, solve } from "game/htn";

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
  // Six-minute steps keep the multi-day checks fast; movement and work
  // timing have separate minute-scale assertions below.
  for (let frame = 0; frame < days * 240; frame++) simulation.step(6);
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

it("a hungry villager walks to wild food, forages it, and eats", () => {
  const { state, villager, tiles } = hungryVillage();
  const [bush] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[tiles[2]], immovable: true },
    forageable: { kind: "berries", biome: "grassland", amount: 1, growth: 0 }
  }]);
  const before = { ...state.ecs.spatial[villager] };
  const simulation = createSimulation(state);
  let travelled = 0;
  for (let frame = 0; frame < 480; frame++) {
    simulation.step(1);
    const p = state.ecs.spatial[villager];
    travelled = Math.max(travelled, Math.hypot(p.x - before.x, p.y - before.y));
  }
  expect(state.ecs.personable[villager].hunger).toBeLessThan(0.5);
  expect(state.ecs.forageable[bush].amount).toBe(0);
  expect(travelled).toBeGreaterThan(100);
});

it("the player's forage order carries a portion home for winter", () => {
  const { state, villager, tiles } = hungryVillage();
  state.ecs.personable[villager].hunger = 0;
  const [store, bush] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    controllable: { controllerId: villager }, container: { capacity: 30, amounts: {} }
  }, {
    spatial: { ...state.ecs.spatial[tiles[2]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 }
  }]);
  state.ecs.manager[villager].jobs.push({ job: { key: "forage" }, targetId: bush });
  advance(state, HOUR * 8);
  expect(state.ecs.container[store].amounts.forage).toBe(1);
  expect(state.ecs.forageable[bush].amount).toBe(0);
  expect(state.ecs.manager[villager].jobs).toEqual([]);
});

it("winter offers no wild meals and crops keep only their growing-season progress", () => {
  const { state, villager, tiles } = hungryVillage();
  // Initial layout: a public lane around the middle crop tile. The old row
  // placed the only food behind a field, which through-walkers now skirt.
  for (const h of Grid.hexagon({center:Hex(1,0),radius:1})) {
    if (state.space[h]) continue;
    newEntities(state,[{spatial:{...h.toPoint(),immovable:true},mappable:{terrain:"grassland"},walkable:{speed:1,worn:{},neighbours:{}}}]);
  }
  const tileAt=h=>state.space[h]?.find(id=>state.ecs.mappable[id]);
  for (const h of Grid.hexagon({center:Hex(1,0),radius:1})) for(const [side,n] of Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).entries()) {
    if(tileAt(h) && tileAt(n)) addBidirectionalLink(state.ecs,tileAt(h),side,tileAt(n));
  }
  state.days = 9;
  state.ecs.planner[villager].world.days = 9;
  const [field, bush] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[tiles[1]], immovable: true },
    farmable: { claimerId: "other", slots: [{ content: "grain", state: "sown", updated: 0, growth: 4 }] },
    controllable: { controllerId: villager }
  }, {
    spatial: { ...state.ecs.spatial[tiles[2]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 }
  }]);
  advance(state, 2.9);
  expect(state.ecs.farmable[field].slots[0].state).toBe("sown");
  expect(state.ecs.farmable[field].slots[0].growth).toBe(4);
  expect(state.ecs.forageable[bush].amount).toBe(1);
  expect(state.ecs.personable[villager].hunger).toBeGreaterThan(4);
  expect(state.ecs.personable[villager].starving).toBe(true);
  expect(state.ecs.personable[villager].dead).toBeFalsy();
  advance(state, 0.8);
  expect(state.ecs.farmable[field].slots[0].state).toBe("harvestable");
  expect(state.ecs.personable[villager].hunger).toBeLessThan(0.9);
  expect(state.ecs.personable[villager].starving).toBe(false);
});

it("a harvested slot cannot produce a second crop without being sown again", () => {
  const { state, villager, tiles } = hungryVillage();
  state.ecs.planner = {};
  state.ecs.farmable = { [tiles[1]]: { slots: [{ content: "grain", state: "harvested", updated: -10 }] } };
  advance(state, 1);
  expect(state.ecs.farmable[tiles[1]].slots[0].state).toBe("harvested");
});

it("same-seed planners replay identically without global randomness", () => {
  const a = hungryVillage().state;
  const b = hungryVillage().state;
  a.map = b.map = { seed: 4321 };
  const random = jest.spyOn(Math, "random").mockImplementation(() => { throw new Error("unseeded simulation randomness"); });
  try {
    advance(a, 1);
    advance(b, 1);
    expect(a.ecs).toEqual(b.ecs);
  } finally {
    random.mockRestore();
  }
});

it("starvation death can be checked even when the player owns buildings", () => {
  const { state, villager, tiles } = hungryVillage();
  state.ecs.personable[villager].dead = true;
  state.ecs.controllable[tiles[0]] = { id: tiles[0], controllerId: villager };
  expect(anyControlledAlive(state.ecs, villager)).toBe(false);
});

it("a second villager cannot pick up a stockpiled meal that someone already ate", () => {
  const { state, villager } = hungryVillage();
  state.ecs.haulable = {};
  const world = { places: { food: { ...state.ecs.spatial[villager], id: "gone", stockpileId: "store" } } };
  expect(pick_up_from_stockpile(state, villager, world, 0, true, "food")).toBe(Task.ABORT);
  expect(world.places.food).toBeFalsy();
});

it("chooses reachable forage even when a closer plant is across water", () => {
  const { state, villager, tiles } = hungryVillage();
  const [island, unreachable, reachable] = newEntities(state, [{
    spatial: { x: 0, y: -104, immovable: true },
    mappable: { terrain: "grassland" }, walkable: { worn: {}, speed: 1, neighbours: {} }
  }, {
    spatial: { x: 0, y: -104, immovable: true },
    forageable: { kind: "berries", biome: "grassland", amount: 1, growth: 0 }
  }, {
    spatial: { ...state.ecs.spatial[tiles[2]], immovable: true },
    forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 }
  }]);
  const world = state.ecs.planner[villager].world;
  find_place(state, villager, world, 0, true, "food", "forage_plant");
  expect(world.places.food).toBe(reachable);
});

it("forgets a held-food claim if an interrupted meal already consumed that portion", () => {
  const { state, villager } = hungryVillage();
  const world = state.ecs.planner[villager].world;
  world.holding.forage = true;
  expect(eat(state, villager, world, 0, true, "forage")).toBe(Task.ABORT);
  expect(world.holding.forage).toBe(false);
});

it("eats carried grain before attempting storage when hunger and a full store compete", () => {
  const { state, villager } = hungryVillage();
  const world = state.ecs.planner[villager].world;
  world.days = .4; world.feeling.hungry = true; world.holding.grain = true;
  world.places.container_with_space = "full-store";
  const [plan] = solve(world, [], [["person"]]);
  expect(plan).toContainEqual(["eat", "grain"]);
  expect(plan.some(t => t[0] == "drop_entity_into_container")).toBe(false);
});

it("eats held food without a trip to an old cached gathering place", () => {
  const { state, villager } = hungryVillage();
  const w = state.ecs.planner[villager].world;
  w.days = .4; w.feeling.hungry = true; w.holding.grain = true; w.places.meet = "far-away-green";
  const [plan] = solve(w, [], [["person"]]);
  expect(plan).toContainEqual(["eat", "grain"]);
  expect(plan).not.toContainEqual(["walk_to", "meet"]);
});

it("eats accessible household grain before chasing loose grain beyond a broken route", () => {
  const { state: s, villager: a, tiles } = hungryVillage();
  const [store, loose] = newEntities(s, [{
    spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, controllable: { controllerId: a },
    container: { capacity: 30, amounts: { grain: 3 } }
  }, { spatial: { ...s.ecs.spatial[tiles[2]] }, controllable: { controllerId: a },
    good: { type: "grain", amount: 1 }, haulable: {} }]);
  s.ecs.walkable[tiles[1]].neighbours = {}; s.ecs.walkable[tiles[0]].neighbours = {};
  advance(s, HOUR * 5);
  expect(s.ecs.personable[a].hunger).toBeLessThan(.3);
  expect(s.ecs.container[store].amounts.grain).toBe(2);
  expect(s.ecs.good[loose].amount).toBe(1);
});

it("does not use a stranger's private reserve when its own food runs out", () => {
  const { state: s, villager: a, tiles } = hungryVillage();
  const [owner, store] = newEntities(s, [{ controllable: {} }, {
    spatial: { ...s.ecs.spatial[tiles[0]] }, container: { capacity: 30, amounts: { grain: 3 } }, controllable: {}
  }]);
  s.ecs.controllable[owner].controllerId = owner; s.ecs.controllable[store].controllerId = owner;
  advance(s, HOUR * 5);
  expect(s.ecs.container[store].amounts.grain).toBe(3);
  expect(s.ecs.personable[a].hunger).toBeGreaterThan(1.4);
});
