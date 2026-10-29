import * as time from "game/time";
import { createSimulation, deltaTime, SPEED } from "game/simulation";

const villageState = (game_speed) => ({
  ecs: { nextId: 2, planner: {}, personable: { 1: { tiredness: 0, hunger: 0 } } },
  redraws: [],
  ui: {},
  days: 0.375,
  game_speed
});

describe("simulation step", () => {
  it("advances game time by the frame multiplier at the chosen speed", () => {
    const state = villageState("normal");
    createSimulation(state).step(2);
    expect(state.days).toBeCloseTo(0.375 + 2 * (1 / 60) * SPEED.normal / 86400, 12);
    expect(deltaTime(1, SPEED.fast)).toBeCloseTo(1 / 1440, 12);
  });

  it("does nothing while paused", () => {
    const state = villageState("paused");
    createSimulation(state).step(6);
    expect(state.days).toEqual(0.375);
  });

  it("makes people hungrier and more tired each game hour and reports the hour", () => {
    const state = villageState("fast");
    let hours = 0;
    const simulation = createSimulation(state, { onHour: () => hours++ });

    // NOTE: 66 game minutes at fast speed
    for (let i = 0; i < 11; i++) {
      simulation.step(6);
    }

    expect(hours).toEqual(1);
    expect(state.ecs.personable[1].hunger).toBeCloseTo(time.HOUR, 12);
    expect(state.ecs.personable[1].tiredness).toBeCloseTo(time.HOUR, 12);
  });
});
