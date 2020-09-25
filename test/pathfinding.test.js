import { Grid, Hex, ALL_SIX } from "game/map";
import { path } from "game/pathfinding";

describe("pathfinding", () => {
  it("allows a path through hexes", () => {
    const tiles = Grid.spiral({radius: 1});
    var state = {
      ecs: {
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
          1: { neighbours: [3] },
          2: { neighbours: [3, 1, 7] },
          3: { neighbours: [2, 1, 4] },
          4: { neighbours: [3, 1, 5] },
          5: { neighbours: [4, 1, 6] },
          6: { neighbours: [5, 1, 7] },
          7: { neighbours: [6, 1, 2] },
        }
      }
    };
    expect(path(state.ecs, 1, 5)).toEqual([1, 3, 4, 5]);
  });
});
