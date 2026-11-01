import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { walk_to, chop_tree, sleep, find_place, trade_work, leave_edge } from "game/tasks";
import { placeShelter, workOnShelter } from "game/construction";
import { updateNeeds, advanceOffscreenNeeds } from "game/needs";
import { careSpeed } from "game/hunger";
import { HOUR } from "game/time";
import { Task } from "game/htn";
import { enqueueTask } from "game/manager";
import { createSimulation } from "game/simulation";

function world(player = true) {
  const f = rowOfTiles(3), { state: s, villager: id } = f;
  s.ui.playerId = player ? id : "elsewhere";
  s.ecs.personable = { [id]: { age: 24, hunger: 0, tiredness: 0 } };
  s.ecs.planner = { [id]: { id, world: { places: {}, no_place_for: {}, feeling: {}, holding: {}, days: s.days, ordered: player } } };
  s.ecs.manager = { [id]: { id, jobs: [], ordered: player } };
  s.ecs.sleepable = {};
  s.ecs.interior = {};
  s.ecs.building = {};
  return f;
}

it.each([true, false])("slows walking, chopping and construction together, including combined hunger (player=%s)", player => {
  for (const [hunger, tiredness, factor] of [[0, 0, 1], [0, 1.2, 1], [0, 1.21, .5], [0, 1.8, .5], [0, 1.81, .25], [1, 1.3, .4], [3, 2, .15]]) {
    const { state: s, villager: id, tiles } = world(player);
    Object.assign(s.ecs.personable[id], { hunger, tiredness });
    const start = { ...s.ecs.spatial[id] };
    walk_to(s, id, { places: {} }, .0001, true, tiles[2]);
    const distance = Math.hypot(s.ecs.spatial[id].x - start.x, s.ecs.spatial[id].y - start.y);
    const rested = world(player);
    walk_to(rested.state, rested.villager, { places: {} }, .0001, true, rested.tiles[2]);
    expect(distance / Math.hypot(rested.state.ecs.spatial[id].x - start.x, rested.state.ecs.spatial[id].y - start.y)).toBeCloseTo(factor, 10);
    const [tree] = newEntities(s, [{ spatial: { ...s.ecs.spatial[id] }, good: { type: "wood", amount: 2 } }]);
    const work = {};
    expect(chop_tree(s, id, work, HOUR / 10, true, tree)).toBe(Task.CONTINUE);
    expect(work.workRemaining).toBeCloseTo(HOUR / 2 - HOUR / 10 * factor, 10);
    // Both a player and an NPC helper contribute their own actual effort.
    const playerId = s.ui.playerId;
    s.ui.playerId = id;
    newEntities(s, [{ spatial: { ...start }, camp: {}, controllable: { controllerId: id } }]);
    const site = placeShelter(s, tiles[1]);
    s.ui.playerId = playerId;
    s.ecs.construction[site].delivered = 4;
    expect(workOnShelter(s, id, {}, HOUR / 10, true, site)).toBe(Task.CONTINUE);
    expect(s.ecs.construction[site].work).toBeCloseTo(.1 * factor, 10);
  }
});

it("changes ongoing effort immediately and uses the same factor for trade fuel", () => {
  const { state: s, villager: id } = world();
  const [tree, forge] = newEntities(s, [{ spatial: { ...s.ecs.spatial[id] }, good: { type: "wood", amount: 2 } },
    { spatial: { ...s.ecs.spatial[id] }, workplace: { trade: "smith", fuelHours: 4 } }]);
  const work = {};
  chop_tree(s, id, work, HOUR / 10, true, tree);
  s.ecs.personable[id].tiredness = 2;
  chop_tree(s, id, work, HOUR / 10, false, tree);
  expect(work.workRemaining).toBeCloseTo(HOUR * (.5 - .1 - .025), 10);
  trade_work(s, id, {}, HOUR / 10, true, forge);
  expect(s.ecs.workplace[forge].workHours).toBeCloseTo(.025, 10);
  expect(s.ecs.workplace[forge].fuelHours).toBeCloseTo(3.975, 10);
});

it.each(["chopping", "construction"])("spends only 60%% effort on %s after prolonged missed sleep", kind => {
  const { state: s, villager: id, tiles } = world();
  s.ecs.personable[id].tiredness = 2;
  if (kind == "chopping") {
    const [tree] = newEntities(s, [{ spatial: { ...s.ecs.spatial[id] }, good: { type: "wood", amount: 2 } }]);
    const w = {};
    chop_tree(s, id, w, HOUR / 10, true, tree);
    expect(w.workRemaining).toBeCloseTo(HOUR * .475, 10);
  } else {
    newEntities(s, [{ spatial: { ...s.ecs.spatial[id] }, camp: {}, controllable: { controllerId: id } }]);
    const site = placeShelter(s, tiles[1]);
    s.ecs.construction[site].delivered = 4;
    workOnShelter(s, id, {}, HOUR / 10, true, site);
    expect(s.ecs.construction[site].work).toBeCloseTo(.025, 10);
  }
});

it("slows the final walking steps off-map by the same factor", () => {
  const distances = [];
  for (const tiredness of [0, 2]) {
    const { state: s, villager: id, tiles } = world();
    s.map = { centre: { x: 0, y: 0 }, radius: 2 };
    Object.assign(s.ecs.spatial[id], s.ecs.spatial[tiles[2]]);
    const start = { ...s.ecs.spatial[id] };
    s.ecs.personable[id].tiredness = tiredness;
    expect(leave_edge(s, id, {}, .0001, false, tiles[2], {})).toBe(Task.CONTINUE);
    distances.push(Math.hypot(s.ecs.spatial[id].x - start.x, s.ecs.spatial[id].y - start.y));
  }
  expect(distances[1] / distances[0]).toBeCloseTo(.25, 10);
});

it.each(["camp", "bed", "shelter"])("Rest restores energy using an accessible %s", kind => {
  const {state:s,villager:id,tiles}=world();
  const [bed]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},...(kind=="camp"?{camp:{}}:kind=="shelter"?{shelter:{stage:"lean-to"}}:{building:{rooms:[]}}),controllable:{controllerId:id},sleepable:{capacity:1,level:kind=="camp"?0:1,occupiers:[]}}]);
  s.ecs.household={[id]:{houseId:bed}};s.ecs.personable[id].energy=0;
  enqueueTask(s,{key:"rest"},id);s.game_speed="fast";
  const sim=createSimulation(s);let slept=false;
  for(let i=0;i<24*60 && s.ecs.manager[id].jobs.length;i++){sim.step(1);slept ||= s.ecs.planner[id].task?.[0]=="sleep";}
  expect(slept).toBe(true);expect(s.ecs.planner[id].world.places.sleep).toBe(bed);
  expect(s.ecs.personable[id].energy).toBeGreaterThan(40);expect(careSpeed(s.ecs.personable[id])).toBe(1);
});

it("has no sleep place without a bed, camp or shelter and retains the penalty", () => {
  const { state: s, villager: id } = world();
  const w = s.ecs.planner[id].world;
  s.ecs.personable[id].tiredness = 2;
  find_place(s, id, w, 0, true, "sleep", "allows_sleep");
  expect(w.places.sleep).toBeFalsy();
  updateNeeds(s, HOUR);
  expect(careSpeed(s.ecs.personable[id])).toBe(.25);
});

it.each([.2, .6])("allows an ordinary first day and night with starting tiredness %s", tiredness => {
  const { state: s, villager: id } = world();
  const p = s.ecs.personable[id];
  p.tiredness = tiredness;
  // Arrival at 9am, then conversations, building and other waking time until 11pm.
  for (let i = 0; i < 14; i++) {
    updateNeeds(s, HOUR);
    p.hunger = 0;
    expect(careSpeed(p)).toBe(1);
  }
  const missedNight = { ...p, tiredness: p.tiredness + 11 * HOUR };
  expect(careSpeed(missedNight)).toBe(.5);
  const w = { places: {}, days: 23 / 24 };
  for (let i = 0; i < 8; i++) {
    updateNeeds(s, HOUR);
    p.hunger = 0;
    sleep(s, id, w, HOUR);
    expect(careSpeed(p)).toBe(1);
  }
});

it.each([true, false])("offscreen needs retain exhaustion without a bed and restore it with one (player=%s)", player => {
  for (const capacity of [0, 1]) {
    const { state: s, villager: id } = world(player);
    s.map = {};
    s.needsUpdatedAt = s.days;
    s.ecs.personable[id].tiredness = 2;
    s.ecs.household = { [id]: { houseId: "home" } };
    s.ecs.sleepable.home = { capacity, occupiers: [] };
    advanceOffscreenNeeds(s, s.days + HOUR);
    expect(s.ecs.personable[id].tiredness).toBeCloseTo((capacity ? .1 : 2) + HOUR, 10);
    expect(careSpeed(s.ecs.personable[id])).toBe(capacity ? 1 : .25);
  }
});
