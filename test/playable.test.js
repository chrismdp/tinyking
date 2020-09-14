import { topController, directlyControlledBy, anyControlledAlive } from "game/playable";

describe("directlyControlledBy", () => {
  it("returns all the controlled characters", () => {
    const ecs = { personable: { 1: {}, 2: { controller: 2 } } };
    expect(directlyControlledBy(ecs, 1)).toEqual([]);
    expect(directlyControlledBy(ecs, 2)).toEqual([{ controller: 2 }]);
  });
});

describe("topController", () => {
  it("returns the controller at the top of the pile", () => {
    const ecs = {
      personable: {
        1: { controller: 1 },
        2: { controller: 1 },
        3: { controller: 2 },
        4: { controller: 4 }
      }
    };
    expect(topController(ecs, 1)).toEqual(1);
    expect(topController(ecs, 2)).toEqual(1);
    expect(topController(ecs, 3)).toEqual(1);
    expect(topController(ecs, 4)).toEqual(4);
  });

  it("returns null if the entity is not playable", () => {
    const ecs = { personable: {} };
    expect(topController(ecs, 1)).toBeNull();
  });
});

describe("anyControlledAlive", () => {
  it("returns whether any controlled characters are alive", () => {
    expect(anyControlledAlive({
      personable: {
        1: { dead: false },
        2: { controller: 2, dead: true },
        3: { controller: 2, dead: false }
      }
    }, 2)).toEqual(true);

    expect(anyControlledAlive({
      personable: {
        1: { dead: false },
        2: { controller: 2, dead: true },
        3: { controller: 2, dead: true }
      }
    }, 2)).toEqual(false);
  });
});
