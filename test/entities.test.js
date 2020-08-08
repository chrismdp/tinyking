import { getAllComponents, getEntitiesByTile } from "../src/features/entities_slice";

describe("entity selectors", () => {
  it("allows getting all components", () => {
    const sut = getAllComponents("renderable");
    const state = {
      entities: {
        components: {
          renderable: { 1: { id: 1 }, 2: { id: 2 } }
        }
      }
    };
    expect(sut(state)).toEqual([ { renderable: { id: 1 } }, { renderable: { id: 2 } } ]);
  })
});

describe("Arrays of related components", () => {
  it("allows fetching and joining of multiple componentts", () => {
    const sut = getAllComponents("renderable", "spatial");
    const state = {
      entities: {
        components: {
          renderable: { 1: { r: "r1", id: 1 }, 2: { r: "r2", id: 2 } },
          spatial: { 1: { s: "s1", id: 1 }, 2: { s: "s2", id: 2 } }
        }
      }
    };
    expect(sut(state)).toEqual([
      {
        renderable: { r: "r1", id: 1 },
        spatial: { s: "s1", id: 1 },
      },
      {
        renderable: { r: "r2", id: 2 },
        spatial: { s: "s2", id: 2 },
      },
    ]);
  });

  it("does an inner join only", () => {
    const sut = getAllComponents("renderable", "spatial");
    const state = {
      entities: {
        components: {
          renderable: { 1: { r: "r1", id: 1 } },
          spatial: { 1: { s: "s1", id: 1 }, 2: { s: "s2", id: 2 } }
        }
      }
    };
    expect(sut(state)).toEqual([
      {
        renderable: { r: "r1", id: 1 },
        spatial: { s: "s1", id: 1 },
      }
    ]);
  });

  it("handles no components yet", () => {
    const sut = getAllComponents("renderable", "spatial");
    expect(sut({ entities: { components: {}}})).toEqual([]);
  });
});

describe("getting other entities on same tile", () => {
  const state = {
    entities: {
      components: {
        spatial: { 1: { x: 1, y: 2, s: "s1", id: 1 }, 2: { x: 1, y: 2, s: "s2", id: 2 } },
        workable: { 1: { w: "w1", id: 1 }, 2: { w: "w2", id: 2 } },
        habitable: { 1: { h: "h1", id: 1 }, 2: { h: "h2", id: 2 } },
        notincluded: { 1: { id: 1 } }
      }
    }
  };

  it("returns the entity and others on the same tile", () => {
    const sut = getEntitiesByTile("workable", "habitable");
    expect(sut(state)).toEqual({
      "1,2" : {
        1: {
          id: 1,
          workable: { id: 1, w: "w1" },
          habitable: { id: 1, h: "h1" }
        },
        2: {
          id: 2,
          workable: { id: 2, w: "w2" },
          habitable: { id: 2, h: "h2" }
        }
      }
    });
  });

  it("returns spatial correctly when it's also included", () => {
    const sut = getEntitiesByTile("workable", "spatial", "habitable");
    expect(sut(state)).toEqual({
      "1,2" : {
        1: {
          id: 1,
          workable: { id: 1, w: "w1" },
          spatial: { x: 1, y: 2, s: "s1", id: 1 },
          habitable: { id: 1, h: "h1" }
        },
        2: {
          id: 2,
          workable: { id: 2, w: "w2" },
          spatial: { x: 1, y: 2, s: "s2", id: 2 },
          habitable: { id: 2, h: "h2" }
        }
      }
    });
  });
});
