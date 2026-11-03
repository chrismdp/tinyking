import { topController } from "game/playable";

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
