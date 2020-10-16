import { topController, directlyControlledBy, anyControlledAlive } from "game/playable";

describe("directlyControlledBy", () => {
  it("returns all the controlled characters", () => {
    const ecs = {
      controllable: {
        1: { id: 1 },
        2: { id: 2, controllerId: 2 },
        3: { id: 3, controllerId: 2 }
      }
    };
    expect(directlyControlledBy(ecs, 1)).toEqual([]);
    expect(directlyControlledBy(ecs, 2)).toEqual([{ id: 3, controllerId: 2 }]);
  });
});

describe("topController", () => {
  it("returns the controller at the top of the pile", () => {
    const ecs = {
      controllable: {
        1: { controllerId: 1 },
        2: { controllerId: 1 },
        3: { controllerId: 2 },
        4: { controllerId: 4 }
      }
    };
    expect(topController(ecs, 1)).toEqual(1);
    expect(topController(ecs, 2)).toEqual(1);
    expect(topController(ecs, 3)).toEqual(1);
    expect(topController(ecs, 4)).toEqual(4);
  });
});

describe("anyControlledAlive", () => {
  it("returns whether any controlled characters are alive", () => {
    expect(anyControlledAlive({
      personable: {
        1: { dead: false },
        2: { dead: true },
        3: { dead: false }
      },
      controllable: {
        1: { id: 1 },
        2: { id: 2, controllerId: 2 },
        3: { id: 3, controllerId: 2 }
      }
    }, 2)).toEqual(true);

    expect(anyControlledAlive({
      personable: {
        1: { dead: false },
        2: { dead: true },
        3: { dead: true }
      },
      controllable: {
        1: { id: 1 },
        2: { id: 2, controllerId: 2 },
        3: { id: 3, controllerId: 2 }
      }
    }, 2)).toEqual(false);
  });
});
