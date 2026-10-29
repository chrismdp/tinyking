import { generateMap, Hex, Grid, ALL_SIDES } from "game/map";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";
import { arrivalRoute, startIntro, skipIntro, introActive, INTRO_TIMING, CAMP_LAYOUT } from "game/intro";

const makeWorld = async (seed = 13) => {
  const state = { ecs: { nextId: 1 }, days: 0.375, game_speed: "normal", redraws: [], ui: { show: {} } };
  const result = await generateMap(state, seed, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  return state;
};

it("enters off the board at the closest connected walkable edge to camp, across seeds", async () => {
  for (const seed of [1, 2, 13, 20, 53, 84, 1234, 98765]) {
    const state = await makeWorld(seed);
    const route = arrivalRoute(state);
    const at = point => (state.space[Hex().fromPoint(point)] || []).find(id => state.ecs.mappable[id]);
    expect(at(route.points[0])).toBeUndefined();
    expect(state.ecs.walkable[route.tileIds[0]].speed).toBeGreaterThan(0);
    const camp = state.ecs.spatial[route.campId];
    const distance = p => Math.hypot(p.x - camp.x, p.y - camp.y);
    // Every exposed edge of every tile reachable from camp is a candidate.
    const reached = new Set([route.tileIds.at(-1)]);
    const todo = [...reached];
    for (const id of todo) for (const n of Object.values(state.ecs.walkable[id].neighbours)) {
      if (!reached.has(n)) { reached.add(n); todo.push(n); }
    }
    for (const id of reached) {
      const tile = state.ecs.spatial[id];
      const hex = Hex().fromPoint(tile);
      for (const n of Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES)) {
        if (at(n.toPoint())) continue;
        const outside = { x: tile.x + (n.toPoint().x - tile.x) * 0.72, y: tile.y + (n.toPoint().y - tile.y) * 0.72 };
        expect(distance(route.points[0])).toBeLessThanOrEqual(distance(outside) + 1e-8);
      }
    }
    for (let i = 1; i < route.tileIds.length; i++) {
      expect(Object.values(state.ecs.walkable[route.tileIds[i - 1]].neighbours)).toContain(route.tileIds[i]);
    }
    expect(at(route.points.at(-1))).toBe(route.tileIds.at(-1));
    expect(at(camp)).toBe(route.tileIds.at(-1));
  }
}, 15000);

it("routes around unwalkable land rather than crossing it", () => {
  const state = { ecs: { nextId: 1 }, space: {}, redraws: [], ui: { playerId: "p" } };
  const hexes = Grid.hexagon({ radius: 3 });
  const ids = newEntities(state, hexes.map(h => ({ spatial: { ...h.toPoint(), immovable: true }, mappable: {}, walkable: { speed: 1, worn: {}, neighbours: {} } })));
  hexes.forEach((hex, i) => Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).forEach((n, side) => {
    const j = hexes.findIndex(h => h.toString() == n.toString());
    if (j >= 0) state.ecs.walkable[ids[i]].neighbours[side] = ids[j];
  }));
  const [campId] = newEntities(state, [{ spatial: { ...Hex(1, 0).toPoint(), immovable: true }, camp: {} }]);
  state.ecs.household = { p: { houseId: campId } };
  const blocked = ids[hexes.findIndex(h => h.toString() == Hex(2, 0).toString())];
  state.ecs.walkable[blocked].speed = 0;
  state.ecs.walkable[blocked].neighbours = {};
  for (const w of Object.values(state.ecs.walkable)) for (const side in w.neighbours) if (w.neighbours[side] == blocked) delete w.neighbours[side];
  expect(arrivalRoute(state).tileIds).not.toContain(blocked);
});

it("skips to sitting at camp with the bundle beside the bedroll, and restores control", async () => {
  const state = await makeWorld();
  const before = state.days;
  startIntro(state);
  expect(introActive(state)).toBe(true);
  expect(state.ui.show.speed_controls).toBe(false);
  skipIntro(state);
  const camp = state.ecs.spatial[state.intro.campId];
  expect(state.ecs.spatial[state.ui.playerId]).toMatchObject({ x: camp.x + CAMP_LAYOUT.seat.x, y: camp.y + CAMP_LAYOUT.seat.y });
  expect(state.ecs.camp[state.intro.campId].bundle).toEqual(CAMP_LAYOUT.bundle);
  expect(state.intro.pose).toBe("sitting");
  expect(introActive(state)).toBe(false);
  expect(state.ui.show.speed_controls).toBe(true);
  expect(state.days).toBe(before);
  const position = { ...state.ecs.spatial[state.ui.playerId] };
  skipIntro(state);
  expect(state.ecs.spatial[state.ui.playerId]).toEqual(position);
});

it("plays for ten real seconds with time, hunger, villagers and queues frozen, then hands back to the normal simulation", async () => {
  const state = await makeWorld();
  const simulation = createSimulation(state);
  const before = { days: state.days, people: JSON.stringify(state.ecs.personable), planners: JSON.stringify(state.ecs.planner), managers: JSON.stringify(state.ecs.manager) };
  startIntro(state);
  const start = { ...state.ecs.spatial[state.ui.playerId] };
  // Intro time is independent of frame rate and the selected game speed.
  state.game_speed = "fast";
  simulation.step(1, 4);
  expect(state.ecs.spatial[state.ui.playerId]).not.toEqual(start);
  expect(state.intro.phase).toBe("walking");
  simulation.step(1, INTRO_TIMING.walk - 4 + INTRO_TIMING.putDown);
  expect(state.ecs.camp[state.intro.campId].bundle).toEqual(CAMP_LAYOUT.bundle);
  expect(introActive(state)).toBe(true);
  simulation.step(1, INTRO_TIMING.duration - INTRO_TIMING.walk - INTRO_TIMING.putDown - 0.01);
  expect(introActive(state)).toBe(true);
  simulation.step(1, 0.02);
  expect(introActive(state)).toBe(false);
  expect(state.ui.show.speed_controls).toBe(true);
  expect(state.days).toBe(before.days);
  expect(JSON.stringify(state.ecs.personable)).toBe(before.people);
  expect(JSON.stringify(state.ecs.planner)).toBe(before.planners);
  expect(JSON.stringify(state.ecs.manager)).toBe(before.managers);
  simulation.step(1, 2);
  expect(state.intro.pose).toBe("standing");
  expect(state.days).toBeGreaterThan(before.days);
});

it("supports the URL bypass without changing starting needs or the task queue", async () => {
  const state = await makeWorld();
  const before = JSON.stringify([state.ecs.personable, state.ecs.manager, state.days]);
  startIntro(state, { skip: true });
  expect(introActive(state)).toBe(false);
  expect(state.intro.pose).toBe("sitting");
  expect(JSON.stringify([state.ecs.personable, state.ecs.manager, state.days])).toBe(before);
});

it("holds the initial edge frame briefly before the walk begins", async () => {
  const state = await makeWorld();
  const simulation = createSimulation(state);
  startIntro(state);
  const outside = { ...state.ecs.spatial[state.ui.playerId] };
  simulation.step(1, 0.4);
  expect(state.ecs.spatial[state.ui.playerId]).toEqual(outside);
  simulation.step(1, 0.5);
  expect(state.ecs.spatial[state.ui.playerId]).not.toEqual(outside);
});
