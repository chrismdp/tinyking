import { getAllComponents } from "../src/features/entities_slice";

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
  it("allows fetchingand joining of multiple componentts", () => {
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
});
