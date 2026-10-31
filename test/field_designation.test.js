import { peopleWorld } from "./support/people";
import { enqueueTask, cancelTask } from "game/manager";
import { newEntities } from "game/entities";
import { Hex } from "game/hex";
import { Task } from "game/htn";
import { HOUR } from "game/time";
import { walk_to, create_field } from "game/tasks";
import { canPlaceField, fieldAtTile, reserveRoad } from "game/land_use";

it("leaves an unfinished plot for a real meal without transit wear, and cancellation leaves no field reservation", () => {
  const { state, player, tiles, step } = peopleWorld();
  const task = enqueueTask(state, { key: "create_field" }, tiles[0]);
  step(0.05);
  const progress = task.progress;
  expect(progress).toBeGreaterThan(0);
  expect(progress).toBeLessThan(1);
  state.ecs.personable[player].hunger = 1.2;
  newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[1]], immovable: true }, forageable: { kind: "roots", biome: "grassland", amount: 2, growth: 0 } }]);
  step(0.5);
  expect(Hex().fromPoint(state.ecs.spatial[player]).equals(Hex().fromPoint(state.ecs.spatial[tiles[0]]))).toBe(false);
  expect(task.progress).toBe(progress);
  expect(state.ecs.walkable[tiles[0]].worn).toEqual({});
  expect(state.ecs.walkable[tiles[0]].trackReserved).toBeFalsy();
  expect(canPlaceField(state, tiles[0])).toBe(true);
  expect(fieldAtTile(state, tiles[0])).toBe(false);
  cancelTask(state, task.id);
  step(4);
  expect(state.ecs.manager[player].jobs).toEqual([]);
  expect(fieldAtTile(state, tiles[0])).toBe(false);
  expect(state.ecs.mappable[tiles[0]].cropPlot).toBeFalsy();
  expect(reserveRoad(state, [tiles[0], tiles[1]])).toBe(true);
  expect(create_field(state, player, { places: {} }, HOUR, true, tiles[0])).toBe(Task.ABORT);
  expect(state.ecs.mappable[tiles[0]].route).toHaveLength(1);
});

it("preserves another walker's real wear and rejects the unfinished designation on revalidation", () => {
  const { state, player, person, tiles, step } = peopleWorld();
  const task = enqueueTask(state, { key: "create_field" }, tiles[0]);
  step(0.05);
  const progress = task.progress;
  Object.assign(state.ecs.spatial[person], state.ecs.spatial[tiles[0]]);
  const world = { places: {} };
  let result = walk_to(state, person, world, HOUR / 10, true, tiles[1]);
  for (let i = 0; i < 100 && result == Task.CONTINUE; i++) result = walk_to(state, person, world, HOUR / 10, false, tiles[1]);
  expect(result).toBe(Task.FINISH);
  const worn = { ...state.ecs.walkable[tiles[0]].worn };
  expect(Object.values(worn).some(value => value > 0)).toBe(true);
  expect(state.ecs.walkable[tiles[0]].trackReserved).toBe(true);
  expect(canPlaceField(state, tiles[0])).toBe(false);
  step(0.1);
  expect(task.progress).toBe(progress);
  expect(task.waiting).toBeTruthy();
  expect(fieldAtTile(state, tiles[0])).toBe(false);
  const faded = { ...state.ecs.walkable[tiles[0]].worn };
  expect(Object.keys(faded)).toEqual(Object.keys(worn));
  expect(Object.values(faded).every(value => value > 0)).toBe(true);
  cancelTask(state, task.id);
  expect(create_field(state, player, { places: {} }, HOUR, true, tiles[0])).toBe(Task.ABORT);
  expect(state.ecs.walkable[tiles[0]].worn).toEqual(faded);
  expect(state.ecs.walkable[tiles[0]].trackReserved).toBe(true);
});

it.each(["unstarted", "cancelled"])("records real departure wear when a designation is %s", status => {
  const { state, player, tiles, step } = peopleWorld();
  const task = enqueueTask(state, { key: "create_field" }, tiles[0]);
  if (status == "cancelled") {
    step(0.05);
    expect(task.progress).toBeGreaterThan(0);
    cancelTask(state, task.id);
  }
  const world = state.ecs.planner[player].world;
  let result = walk_to(state, player, world, HOUR / 10, true, tiles[1]);
  for (let i = 0; i < 100 && result == Task.CONTINUE; i++) result = walk_to(state, player, world, HOUR / 10, false, tiles[1]);
  expect(result).toBe(Task.FINISH);
  expect(Object.values(state.ecs.walkable[tiles[0]].worn).some(value => value > 0)).toBe(true);
  expect(state.ecs.walkable[tiles[0]].trackReserved).toBe(true);
  expect(fieldAtTile(state, tiles[0])).toBe(false);
});
