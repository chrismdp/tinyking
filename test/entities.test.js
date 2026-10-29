import { newEntities, deleteEntity } from "game/entities";

describe("deleteEntity", () => {
  it("removes every component and marks the entity for redraw, with no renderer in state", () => {
    const state = { ecs: { nextId: 1 }, space: {}, redraws: [] };
    const [ log ] = newEntities(state, [{
      spatial: { x: 10, y: 10, immovable: true },
      good: { type: "wood", amount: 1 }
    }]);

    deleteEntity(state, log);

    expect(state.ecs.spatial[log]).toBeUndefined();
    expect(state.ecs.good[log]).toBeUndefined();
    expect(Object.values(state.space).flat()).not.toContain(log);
    expect(state.redraws).toContain(log);
  });
});
