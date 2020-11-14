import * as sut from "game/container";

describe("containerItemCount", () => {
  it("counts the items", () => {
    const c = {
      amounts: {
        foo: 1,
        bar: 2
      }
    };
    expect(sut.containerItemCount(c)).toEqual(3);
  });
});

describe("containerHasSpace", () => {
  it("checks if the item count is less than the capacity", () => {
    const c = {
      capacity: 3,
      amounts: {
        foo: 1,
        bar: 2
      }
    };
    expect(sut.containerHasSpace(c)).toBeFalsy();

    c.capacity = 4;
    expect(sut.containerHasSpace(c)).toBeTruthy();
  });
});

