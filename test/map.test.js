import { Hex, generateMap } from "game/map";

const noProgress = async () => {};

// NOTE: what the World component does for "Reset to seed": a fresh ECS, then
// generate a map into the same state
async function regenerate(state, seed) {
  state.ecs = { nextId: 1 };
  state.days = 0.375;
  await generateMap(state, seed, noProgress);
}

describe("generateMap", () => {
  it("leaves nothing from a previous map in the space index when the map is regenerated", async () => {
    const state = {};
    await regenerate(state, 1234);
    await regenerate(state, 98765);

    for (const hex in state.space) {
      for (const id of state.space[hex]) {
        expect(state.ecs.spatial[id]).toBeDefined();
        expect(Hex().fromPoint(state.ecs.spatial[id]).toString()).toEqual(hex);
      }
      // NOTE: trees are jittered, so a hex just off the map can hold a tree but no tile
      expect(state.space[hex].filter(id => state.ecs.mappable[id]).length).toBeLessThanOrEqual(1);
    }
  });
});
