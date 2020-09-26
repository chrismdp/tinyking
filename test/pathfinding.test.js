import { Grid, Hex, ALL_SIX } from "game/map";
import * as sut from "game/pathfinding";

describe("pathfinding", () => {
  it("allows a path through hexes", () => {
    const tiles = Grid.spiral({radius: 1});
    var ecs = {
      spatial: {
        1: tiles[0],
        2: tiles[1],
        3: tiles[2],
        4: tiles[3],
        5: tiles[4],
        6: tiles[5],
        7: tiles[6]
      },
      walkable: {
        1: { neighbours: { 5: 3 } },
        2: { neighbours: { 0: 3, 1: 1, 2: 7 } },
        3: { neighbours: { 3: 2, 2: 1, 1: 4 } },
        4: { neighbours: { 4: 3, 3: 1, 2: 5 } },
        5: { neighbours: { 5: 4, 4: 1, 3: 6 } },
        6: { neighbours: { 0: 5, 5: 1, 4: 7 } },
        7: { neighbours: { 1: 6, 0: 1, 5: 2 } },
      }
    };
    expect(sut.path(ecs, 1, 5)).toEqual([
      { id: 1, exit: 5 },
      { id: 3, exit: 1, entrance: 2 },
      { id: 4, exit: 2, entrance: 4 },
      { id: 5, entrance: 5 }
    ]);
  });

  it("takes weighting into account", () => {
    const tiles = Grid.spiral({radius: 1});
    var ecs = {
      spatial: {
        1: tiles[0],
        2: tiles[1],
        3: tiles[2],
        4: tiles[3]
      },
      walkable: {
        1: { neighbours: { 4: 2, 5: 3, 0: 4 } },
        2: { neighbours: { 0: 3, 1: 1 } },
        3: { speed: 0.5, neighbours: { 3: 2, 2: 1, 1: 4 } },
        4: { neighbours: { 4: 3, 3: 1 } },
      }
    };
    expect(sut.path(ecs, 2, 4)).toEqual([
      { id: 2, exit: 1 },
      { id: 1, exit: 0, entrance: 4 },
      { id: 4, entrance: 3 },
    ]);
  });
});

describe("addBidirectionalLink", () => {
  it("adds a link between two walkables", () => {
    var state = {
      ecs: {
        walkable: {
          1: { neighbours: {} },
          2: { neighbours: {} }
        }
      }
    };

    sut.addBidirectionalLink(state.ecs, 1, 3, 2);
    expect(state.ecs.walkable["1"].neighbours).toEqual({3: 2});
    expect(state.ecs.walkable["2"].neighbours).toEqual({0: 1});
  });
});

describe("removeBidirectionalLink", () => {
  it("removes a link between two sides", () => {
    var ecs = {
      walkable: {
        1: { neighbours: { 1: 2 } },
        2: { neighbours: { 4: 1 } },
      }
    };

    sut.removeBidirectionalLink(ecs, 1, 1);
    expect(ecs.walkable["1"].neighbours).toEqual({});
    expect(ecs.walkable["2"].neighbours).toEqual({});
  });
});
