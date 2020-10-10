import * as sut from "game/htn";

describe("HTN planning", () => {
  it("allows primitive tasks", () => {
    const rep = {
      id: 1,
      places: {},
      no_place_for: {},
      feeling: {},
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
      places: {},
      no_place_for: {},
      feeling: {},
      loc: {
        1: { x: 2, y: 3 },
        2: { x: 40, y: 60 },
      },
    };

    const solution = sut.solve(rep, [ ["move_to_place", "type", "filter", "param" ] ]);
    expect(solution).toEqual([
      ["find_place", "type", "filter", "param"],
      ["walk_to", "type"]
    ]);
  });

  it("allows multiple compounds", () => {
    const rep = {
      id: 1,
      places: {},
      no_place_for: {},
      feeling: {},
      loc: {
        1: { x: 2, y: 3 },
        2: { x: 40, y: 60 },
      },
    };

    const solution = sut.solve(rep, [
      ["move_to_place", "type", "filter", "param" ],
      ["move_to_place", "type", "filter", "param" ]
    ]);

    // TODO: Not sure this is right. Should the 'rep' not be set for the second
    // one by expected effects?
    expect(solution).toEqual([
      ["find_place", "type", "filter", "param"],
      ["walk_to", "type" ],
      ["find_place", "type", "filter", "param"],
      ["walk_to", "type" ]
    ]);
  });
});
