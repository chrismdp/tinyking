import { economy } from "./support/economy";
import { newEntities } from "game/entities";
import { enqueueTask } from "game/manager";
import { walk_to } from "game/tasks";
import { Task } from "game/htn";
import { HOUR } from "game/time";
// Extracted fixed geometry and the trapped position from the review running-state.json.gz.
import penState from "./support/food-pen-route.json";



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
