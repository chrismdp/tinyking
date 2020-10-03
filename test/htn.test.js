import * as sut from "game/htn";

describe("HTN planning", () => {
  it("allows primitive tasks", () => {
    const rep = {
      id: 1,
      loc: {
        1: { x: 2, y: 3 },
        2: { x: 2, y: 3 },
      },
    };

    const solution = sut.solve(rep, [ ["chop_tree", 2] ]);
    expect(solution).toEqual([ [ "chop_tree", 2] ]);
  });

  it("allows compound tasks", () => {
    const rep = {
      id: 1,
      loc: {
        1: { x: 2, y: 3 },
        2: { x: 40, y: 60 },
      },
    };

    const solution = sut.solve(rep, [ ["cut_tree_down", 2 ] ]);
    expect(solution).toEqual([
      ["walk_to", 2],
      ["chop_tree", 2]
    ]);

    expect(sut.solve(rep, [ ["person" ] ])).toEqual([ [ "idle" ] ]);
  });
});