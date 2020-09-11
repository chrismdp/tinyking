import { controlled, anyControlledAlive } from "game/playable";

describe("controlled", () => {
  it("returns all the controlled characters", () => {
    const ecs = { personable: { 1: {}, 2: { controller: 2 } } };
    expect(controlled(ecs, 1)).toEqual([]);
    expect(controlled(ecs, 2)).toEqual([{ controller: 2 }]);
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
