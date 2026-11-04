import * as htn from "game/htn";
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
  it("accumulates frames and advances only complete game minutes", () => {
    const state = villageState("normal");
    createSimulation(state).step(2);
    expect(state.days).toBe(0.375);
    const sim = createSimulation(state);
    sim.step(8);
    expect(state.days).toBeCloseTo(0.375 + 1 / 1440, 12);
    expect(deltaTime(10, SPEED.normal)).toBeCloseTo(1 / 1440, 12);
  });

  it("does nothing while paused", () => {
    const state = villageState("paused");
    createSimulation(state).step(10*(6), 0);
    expect(state.days).toEqual(0.375);
  });

  it("makes people hungrier and more tired each game hour and reports the hour", () => {
    const state = villageState("normal");
    let hours = 0;
    const simulation = createSimulation(state, { onHour: () => hours++ });

    // NOTE: 66 game minutes through explicit simulation steps
    for (let i = 0; i < 11; i++) {
      simulation.step(10*(6), 0);
    }

    expect(hours).toEqual(1);
    expect(state.ecs.personable[1].hunger).toBeCloseTo(time.HOUR, 12);
    expect(state.ecs.personable[1].tiredness).toBeCloseTo(time.HOUR, 12);
  });
});

describe("a player villager the planner cannot plan for", () => {
  // NOTE: at night, with no jobs and every place-finding attempt on cooldown,
  // the person task has no method that succeeds.
  const stuckState = () => ({
    ecs: {
      nextId: 2,
      planner: { 1: { id: "1", world: {
        days: 0.1,
        no_place_for: { container_with_space: 99, stockpile_open_slot: 99, meet: 99 },
        places: {},
        feeling: {},
        holding: {}
      } } },
      personable: { 1: { tiredness: 0, hunger: 0 } },
      manager: { 1: { jobs: [] } },
      controllable: { 1: { controllerId: "1" } }
    },
    redraws: [],
    ui: { playerId: "1" },
    days: 0.1,
    game_speed: "normal"
  });

  it("warns and idles instead of crashing the game", () => {
    const state = stuckState();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    // Idle plans now always succeed; exercise the actual solver-failure fallback.
    const solve = jest.spyOn(htn, "solve").mockReturnValue([]);

    expect(() => createSimulation(state).step(10*(1), 0)).not.toThrow();

    expect(warn).toHaveBeenCalled();
    expect(state.ecs.planner[1].task).toEqual(["wait_for", time.HOUR * 0.5]);
    warn.mockRestore();
    solve.mockRestore();
  });
});

it("refreshes world weather and snow on the hour, including every hour in a long step", () => {
  const state = villageState("normal");
  state.world = { home: { x: 0, y: 0 }, hexes: [{ x: 0, y: 0, temperature: "cold", moisture: "wet", biome: "snowfield" }] };
  state.map = { seed: 13 };
  state.ecs.mappable = { 2: { terrain: "mountain", temperature: "cold" } };
  const simulation = createSimulation(state);
  expect(state.weather["0,0"].type).toBeDefined();
  expect(state.snow[2]).toBe(0);
  const before = state.weather;
  simulation.step(10*(1), 0);
  expect(state.weather).toBe(before);
  let hours = 0;
  const longStep = createSimulation(state, { onHour: () => hours++ });
  longStep.step(10*(180), 0);
  expect(hours).toBe(3);
  expect(state.weather).not.toBe(before);
  expect(state.ecs.personable[1].hunger).toBeCloseTo(3 * time.HOUR);
});

it("drifts relationships once per crossed hour, and leaves them alone while paused", () => {
  const state = villageState("paused");
  state.ecs.relationships = { 1: { known: { 2: { ring: "social", goodwill: 10.5 } } } };
  state.ecs.personality = {
    1: { traits: [], likes: [], dislikes: [] },
    2: { traits: [], likes: [], dislikes: [] }
  };
  state.opinionThresholds = { hate: -1, love: 1 };
  const simulation = createSimulation(state);
  simulation.step(10*(180), 0);
  expect(state.ecs.relationships[1].known[2].goodwill).toBe(10.5);
  state.game_speed = "normal";
  simulation.step(10*(180*7/3), 0);
  expect(state.ecs.relationships[1].known[2].goodwill).toBeCloseTo(10.2);
  expect(state.ecs.relationships[1].known[2].ring).toBe("social");
  // The same seasonal drift now spans seven hours followed by twenty-eight.
  simulation.step(10*(720*7/3), 0);
  expect(state.ecs.relationships[1].known[2].goodwill).toBeCloseTo(9);
  expect(state.ecs.relationships[1].known[2].ring).toBe("public");
});
