import { getAllComponents } from "../src/features/entities_slice";

describe("entity selectors", () => {
  it("Allows getting all components", () => {
    const sut = getAllComponents("renderables");
    const state = {
      entities: {
        components: {
          renderables: { 1: { id: 1 }, 2: { id: 2 } }
        }
      }
    };
    expect(sut(state)).toEqual([ { id: 1 }, { id: 2 } ]);
  })
});
