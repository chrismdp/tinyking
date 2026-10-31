import { economy } from "./support/economy";
import { newEntities } from "game/entities";
import { enqueueTask } from "game/manager";
import { walk_to } from "game/tasks";
import { Task } from "game/htn";
import { HOUR } from "game/time";
// Extracted fixed geometry and the trapped position from the review running-state.json.gz.
import penState from "./support/food-pen-route.json";

it("invalidates an unreachable cached food choice and eats reachable berries", () => {
  const f = economy(6), { s, p, camp, tiles, world } = f;
  s.ecs.container[camp].amounts = {};
  for (const t of tiles) for (const [side,n] of Object.entries(s.ecs.walkable[t].neighbours)) {
    if ((tiles.indexOf(t) < 3) != (tiles.indexOf(n) < 3)) delete s.ecs.walkable[t].neighbours[side];
  }
  const [store, plant] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[tiles[5]] }, container: { capacity: 100, amounts: { grain: 50 } }, controllable: { controllerId: p } },
    { spatial: { ...s.ecs.spatial[tiles[1]] }, forageable: { kind: "berries", biome: "grassland", amount: 1, growth: 0 } }
  ]);
  world.places["container_with grain"] = store;
  s.ecs.personable[p].hunger = 2;
  enqueueTask(s, { key: "find_food" }, p);
  f.step(180);
  expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
  expect(s.ecs.forageable[plant].amount).toBe(0);
  expect(world.places["container_with grain"]).not.toBe(store);
  expect(s.ecs.container[store].amounts.grain).toBe(50);
});

it("walks the real seed-13 trapped villager home through a route that respects the pen", () => {
  const s = JSON.parse(JSON.stringify(penState)), actor = "social-5921", target = "4005";
  const world = { places: {}, no_place_for: {}, holding: {}, feeling: {} };
  let result;
  for (let i = 0; i < 600 && result != Task.FINISH; i++) result = walk_to(s, actor, world, HOUR / 60, i == 0 || result == Task.ABORT, target);
  expect(result).toBe(Task.FINISH);
  expect(Math.hypot(s.ecs.spatial[actor].x - s.ecs.spatial[target].x, s.ecs.spatial[actor].y - s.ecs.spatial[target].y)).toBeLessThan(10);
});

it("a fed live smith collects real household fuel, hauls it and works", () => {
  const f = economy(), { s, tiles, p } = f;
  const [npc, home, store, work, tree] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[tiles[8]] }, personable: { age: 30, hunger: 0, tiredness: 0 }, controllable: {}, household: {}, holder: { capacity: 2, held: [] }, manager: { jobs: [] }, planner: { world: { places: {}, no_place_for: {}, holding: {}, feeling: {}, days: s.days } } },
    { spatial: { ...s.ecs.spatial[tiles[8]] }, building: { rooms: [] }, controllable: {}, sleepable: { capacity: 6, occupiers: [] }, household: { fields: [], backyards: [] } },
    { spatial: { ...s.ecs.spatial[tiles[8]] }, container: { capacity: 200, amounts: { grain: 100 } }, controllable: {}, interior: {} },
    { spatial: { ...s.ecs.spatial[tiles[9]] }, workplace: { trade: "smith", fuelHours: 0 }, controllable: {} },
    { spatial: { ...s.ecs.spatial[tiles[10]] }, good: { type: "wood", amount: 3 } }
  ]);
  s.ecs.controllable[npc].controllerId = npc; s.ecs.controllable[home].controllerId = npc;
  for (const id of [store, work]) s.ecs.controllable[id].controllerId = home;
  s.ecs.interior[store].buildingId = home; s.ecs.household[npc].houseId = home;
  Object.assign(s.ecs.household[home], { storeId: store, workplaceId: work, trade: "smith" });
  s.ecs.workplace[work].houseId = home; s.ecs.building[home].rooms = [store];
  s.ecs.profession = { [npc]: { houseId: home, workplaceId: work, trade: "smith" } };
  s.ecs.planner[npc].id = npc; s.ecs.planner[npc].world.profession = s.ecs.profession[npc];
  f.step(12 * 60);
  expect(s.ecs.good[tree]).toBeUndefined();
  expect(s.ecs.workplace[work].workHours).toBeGreaterThan(0);
  expect((s.ecs.container[store].amounts.wood || 0) + Object.values(s.ecs.good).filter(g => g.type == "wood").reduce((n,g) => n + g.amount, 0)).toBeLessThan(3);
  expect(s.ecs.manager[p].jobs).toEqual([]);
});
