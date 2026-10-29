import { Hex } from "game/map";
import { Task } from "game/htn";
import * as math from "game/math";
import { walk_to, pick_up_from_stockpile } from "game/tasks";
import { newEntities } from "game/entities";
import { rowOfTiles } from "./support/world";

const distance = (a, b) => Math.sqrt(math.squaredDistance(a, b));

describe("walk_to", () => {
  it("moves the walker's spatial towards the target with no renderer in state", () => {
    const { state, tiles, villager } = rowOfTiles(3);
    const target = state.ecs.spatial[tiles[2]];
    const start = { ...state.ecs.spatial[villager] };

    const result = walk_to(state, villager, { places: {} }, 0.0001, true, tiles[2]);

    expect(result).toEqual(Task.CONTINUE);
    expect(state.pixi).toBeUndefined();
    expect(distance(state.ecs.spatial[villager], start)).toBeGreaterThan(0);
    expect(distance(state.ecs.spatial[villager], target)).toBeLessThan(distance(start, target));
  });

  it("arrives on the target tile", () => {
    const { state, tiles, villager } = rowOfTiles(3);
    const world = { places: {} };

    let result = walk_to(state, villager, world, 0.001, true, tiles[2]);
    for (let frame = 0; frame < 1000 && result == Task.CONTINUE; frame++) {
      result = walk_to(state, villager, world, 0.001, false, tiles[2]);
    }

    expect(result).toEqual(Task.FINISH);
    expect(Hex().fromPoint(state.ecs.spatial[villager]).toString())
      .toEqual(Hex().fromPoint(state.ecs.spatial[tiles[2]]).toString());
  });
});

describe("pick_up_from_stockpile", () => {
  it("hands the player's villager the item without logging anything", () => {
    const { state, villager } = rowOfTiles(1);
    state.ui.playerId = villager;
    const at = { ...state.ecs.spatial[villager] };
    const [ stockpile ] = newEntities(state, [{
      spatial: { ...at, immovable: true },
      stockpile: {},
      holder: { capacity: 19, held: [] },
      controllable: { controllerId: villager }
    }]);
    const [ log ] = newEntities(state, [{
      spatial: { ...at },
      good: { type: "wood", amount: 1 },
      haulable: { heldBy: stockpile }
    }]);
    state.ecs.holder[stockpile].held.push(log);
    state.space[Hex().fromPoint(at)].push(log);
    const world = { places: { "stockpile_with wood": { ...at, id: log, stockpileId: stockpile } } };
    const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});

    pick_up_from_stockpile(state, villager, world, 0, true, "stockpile_with wood", "wood");

    expect(state.ecs.holder[villager].held).toEqual([log]);
    expect(state.ecs.haulable[log].heldBy).toEqual(villager);
    expect(consoleLog).not.toHaveBeenCalled();
    consoleLog.mockRestore();
  });
});

it("walks at exactly the same speed through snow as over bare ground", () => {
  const dry = rowOfTiles(3);
  const snowy = rowOfTiles(3);
  snowy.state.snow = Object.fromEntries(snowy.tiles.map(id => [id, 1]));
  snowy.state.weather = { "0,0": { type: "snow" } };
  for (const fixture of [dry, snowy]) {
    walk_to(fixture.state, fixture.villager, { places: {} }, 0.0001, true, fixture.tiles[2]);
  }
  expect(snowy.state.ecs.spatial[snowy.villager]).toEqual(dry.state.ecs.spatial[dry.villager]);
  expect(snowy.state.ecs.walkable).toEqual(dry.state.ecs.walkable);
});

it("replans a hauling pickup if construction has already consumed the cached log", () => {
  const { state, villager } = rowOfTiles(1);
  const [log] = newEntities(state, [{ spatial: { ...state.ecs.spatial[villager] }, good: { type: "wood", amount: 1 }, haulable: {} }]);
  const world = { places: { timber: log } };
  require("game/entities").deleteEntity(state, log);
  expect(require("game/tasks").pick_up_entity_with_good(state, villager, world, 0, true, "timber")).toBe(Task.ABORT);
  expect(world.places.timber).toBeFalsy();
  expect(state.ecs.holder[villager].held).toEqual([]);
});

it.each(["drop_entity_into_container", "drop_entity_into_stockpile_slot"])("replans %s when the planned timber is no longer held", task => {
  const { state, villager } = rowOfTiles(1);
  const [store] = newEntities(state, [{ spatial: { ...state.ecs.spatial[villager], immovable: true },
    holder: { held: [], capacity: 19 }, stockpile: {}, container: { amounts: {}, capacity: 8 } }]);
  const destination = task == "drop_entity_into_container" ? store : { id: store, x: 40, y: 0 };
  const world = { places: { destination }, holding: { wood: true } };
  expect(require("game/tasks")[task](state, villager, world, 0, true, "destination", "wood")).toBe(Task.ABORT);
  expect(state.ecs.container[store].amounts).toEqual({});
  expect(world.holding.wood).toBe(false);
});

it.each(["pick_up_entity_with_good", "pick_up_from_stockpile", "pick_up_from_container"])("replans %s when a full backpack prevents pickup", task => {
  const { state, villager } = rowOfTiles(1);
  const [store, log] = newEntities(state, [{ spatial: { ...state.ecs.spatial[villager], immovable: true },
    holder: { held: [], capacity: 19 }, stockpile: {}, container: { amounts: { wood: 1 }, capacity: 8 } },
  { spatial: { ...state.ecs.spatial[villager] }, good: { type: "wood", amount: 1 }, haulable: {} }]);
  state.ecs.holder[villager].capacity = 0;
  const stockpiled = task == "pick_up_from_stockpile";
  if (stockpiled) require("game/holder").give(state.ecs, log, store);
  const source = task == "pick_up_from_container" ? store : stockpiled ? { id: log, stockpileId: store, ...state.ecs.spatial[log] } : log;
  const world = { places: { source }, holding: {} };
  expect(require("game/tasks")[task](state, villager, world, 0, true, "source", "wood")).toBe(Task.ABORT);
  expect(state.ecs.holder[villager].held).toEqual([]);
  expect(state.ecs.container[store].amounts.wood).toBe(1);
  if (stockpiled) expect(state.ecs.holder[store].held).toEqual([log]);
});

it("replans a stockpile delivery if its final slot filled during the walk", () => {
  const { state, villager } = rowOfTiles(1);
  const [store, log] = newEntities(state, [{ spatial: { ...state.ecs.spatial[villager], immovable: true },
    holder: { held: [], capacity: 0 }, stockpile: {} },
  { spatial: { ...state.ecs.spatial[villager] }, good: { type: "wood", amount: 1 }, haulable: {} }]);
  require("game/holder").give(state.ecs, log, villager);
  const world = { places: { destination: { id: store, x: 40, y: 0 } } };
  expect(require("game/tasks").drop_entity_into_stockpile_slot(state, villager, world, 0, true, "destination", "wood")).toBe(Task.ABORT);
  expect(state.ecs.holder[villager].held).toEqual([log]);
});
