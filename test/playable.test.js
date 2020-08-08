import { filterTilesByKnown } from "../src/features/entities/playable_slice";

describe("filterTilesByKnown", () => {
  it("returns an empty object if given one", () => {
    expect(filterTilesByKnown({}, [])).toEqual({});
  });
  it("filters down an object to only the known ones", () => {
    const tiles = {
      "1,2" : {},
      "2,3" : {}
    };

    const known = [ {x: 1, y: 2}, {x: 4,  y: 4} ];

    expect(filterTilesByKnown(tiles, known)).toEqual({
      "1,2": {}
    });
  });
});
