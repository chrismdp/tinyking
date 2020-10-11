import * as sut from "game/holder";

describe("holder", () => {
  it("allows picking up from ground", () => {
    const ecs = {
      haulable: { 1: {} },
      holder: { 2: { held: [] } },
    };
    expect(sut.give(ecs, 1, 2)).toBeTruthy();
    expect(ecs.haulable["1"].heldBy).toEqual(2);
    expect(ecs.holder["2"].held).toEqual([1]);
  });

  it("allows giving between two holders", () => {
    const ecs = {
      haulable: { 1: { heldBy: 3 } },
      holder: {
        2: { held: [] },
        3: { held: [1] }
      },
    };

    expect(sut.give(ecs, 1, 2)).toBeTruthy();
    expect(ecs.haulable["1"].heldBy).toEqual(2);
    expect(ecs.holder["2"].held).toEqual([1]);
    expect(ecs.holder["3"].held).toEqual([]);
  });

  it("allows dropping to ground", () => {
    const ecs = {
      haulable: { 1: {} },
      holder: { 2: { held: [] } },
    };
    expect(sut.give(ecs, 1, null)).toBeTruthy();
    expect(ecs.haulable["1"].heldBy).toBeNull();
    expect(ecs.holder["2"].held).toEqual([]);
  });

  it("cannot exceed held capacity", () => {
    const ecs = {
      haulable: { 1: { heldBy: null } },
      holder: { 2: { held: [], capacity: 0 } },
    };
    expect(sut.give(ecs, 1, 2)).toBeFalsy();
    expect(ecs.haulable["1"].heldBy).toBeNull();
    expect(ecs.holder["2"].held).toEqual([]);
  });
});
