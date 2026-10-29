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
