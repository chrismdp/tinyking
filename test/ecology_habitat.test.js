import { rowOfTiles } from "./support/world";
import { newEntities, deleteEntity, removeFromSpace } from "game/entities";
import { initializeEcology, updateEcology, BIOME_ECOLOGY } from "game/ecology";
import { Hex } from "game/hex";
import { HOUR } from "game/time";

it("seeds from the current habitat after a tree moves and that habitat changes", () => {
  const { state, tiles } = rowOfTiles(3);
  const [tree, spare] = newEntities(state, [0, 2].map(i => ({
    spatial: { ...state.ecs.spatial[tiles[i]], immovable: true },
    good: { type: "wood", amount: 3 },
    tree: { biome: "jungle", stage: "mature", growth: 6, fullLogs: 3, seeding: 0 }
  })));
  initializeEcology(state, 13);
  deleteEntity(state, spare); // Real felling leaves room below natural density.
  const source = state.ecology.tiles[Hex().fromPoint(state.ecs.spatial[tree])];
  const destination = state.ecology.tiles[Hex().fromPoint(state.ecs.spatial[tiles[1]])];
  source.biomeMix = { jungle: 1 };
  destination.biomeMix = { desert: 1 };
  state.days = 0;
  updateEcology(state);
  expect(state.ecs.tree[tree].seeding).toBe(BIOME_ECOLOGY.jungle.seeding * HOUR);

  removeFromSpace(state, tree);
  Object.assign(state.ecs.spatial[tree], state.ecs.spatial[tiles[1]], { id: tree });
  state.space[Hex().fromPoint(state.ecs.spatial[tree])].push(tree);
  state.days += HOUR;
  updateEcology(state);
  const afterMove = (BIOME_ECOLOGY.jungle.seeding + BIOME_ECOLOGY.desert.seeding) * HOUR;
  expect(state.ecs.tree[tree].seeding).toBeCloseTo(afterMove, 15);

  destination.biomeMix = { savanna: 1 };
  state.days += HOUR;
  updateEcology(state);
  expect(state.ecs.tree[tree].seeding).toBeCloseTo(afterMove + BIOME_ECOLOGY.savanna.seeding * HOUR, 15);
});
