import { generateMap, Hex, Grid, ALL_SIDES } from "game/map";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";
import { arrivalRoute, startIntro, skipIntro, updateIntro, introActive, INTRO_TIMING, CAMP_LAYOUT } from "game/intro";

const makeWorld = async (seed = 13) => {
  const state = { ecs: { nextId: 1 }, days: 0.375, game_speed: "normal", redraws: [], ui: { show: {} } };
  const result = await generateMap(state, seed, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  return state;
};

it("starts without a camp and walks two adjacent hexes inward from the boundary, across seeds", async () => {
  for (const seed of [1, 2, 13, 20, 53, 84, 1234, 98765]) {
    const state = await makeWorld(seed);
    expect(Object.keys(state.ecs.camp || {})).toHaveLength(0);
    expect(state.ecs.household[state.ui.playerId]).toBeUndefined();
    const route = arrivalRoute(state);
    const at = point => (state.space[Hex().fromPoint(point)] || []).find(id => state.ecs.mappable[id]);
    expect(at(route.points[0])).toBeUndefined();
    expect(route.tileIds).toHaveLength(3);
    const centre = Hex(state.map.centre);
    const hexes = route.tileIds.map(id => Hex().fromPoint(state.ecs.spatial[id]));
    expect(hexes.map(hex => centre.distance(hex))).toEqual([state.map.radius, state.map.radius - 1, state.map.radius - 2]);
    expect(hexes[0].distance(hexes[2])).toBe(2);
    for (let i = 0; i < route.tileIds.length; i++) {
      expect(state.ecs.walkable[route.tileIds[i]].speed).toBeGreaterThan(0);
      if (i) expect(Object.values(state.ecs.walkable[route.tileIds[i - 1]].neighbours)).toContain(route.tileIds[i]);
    }
    expect(at(route.points.at(-1))).toBe(route.tileIds.at(-1));
    expect(Hex().fromPoint(route.campPoint).toString()).toBe(Hex(state.map.playerStartTile).toString());
    expect(arrivalRoute(state)).toEqual(route);
  }
}, 15000);

const routeFixture = () => {
  const state = { ecs: { nextId: 1 }, space: {}, redraws: [], ui: { playerId: "p" },
    map: { playerStartTile: { x: 1, y: 0 }, centre: { x: 0, y: 0 }, radius: 3 },
    villages: { v: { centre: { x: -2, y: -1 } }, far: { centre: { x: 8, y: 0 } } } };
  const hexes = Grid.hexagon({ radius: 3 });
  const ids = newEntities(state, hexes.map(h => ({ spatial: { ...h.toPoint(), immovable: true }, mappable: {}, walkable: { speed: 1, worn: {}, neighbours: {} } })));
  hexes.forEach((hex, i) => Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).forEach((n, side) => {
    const j = hexes.findIndex(h => h.toString() == n.toString());
    if (j >= 0) state.ecs.walkable[ids[i]].neighbours[side] = ids[j];
  }));
  return state;
};

it("chooses an entry facing the nearest village", () => {
  const state = routeFixture();
  const route = arrivalRoute(state);
  const start = route.points[0];
  const end = route.campPoint;
  const village = Hex(state.villages.v.centre).toPoint();
  const dot = (end.x - start.x) * (village.x - end.x) + (end.y - start.y) * (village.y - end.y);
  expect(dot / Math.hypot(end.x - start.x, end.y - start.y) / Math.hypot(village.x - end.x, village.y - end.y)).toBeGreaterThan(0.95);
});

it("chooses another two-hex approach when the preferred approach is unwalkable", () => {
  const state = routeFixture();
  const blocked = arrivalRoute(state).tileIds[1];
  state.ecs.walkable[blocked].speed = 0;
  state.ecs.walkable[blocked].neighbours = {};
  for (const w of Object.values(state.ecs.walkable)) for (const side in w.neighbours) if (w.neighbours[side] == blocked) delete w.neighbours[side];
  expect(arrivalRoute(state).tileIds).not.toContain(blocked);
  expect(arrivalRoute(state).tileIds).toHaveLength(3);
});

it("stops at the future camp, lowers the bundle, then sets up the fire and bedroll in sequence", async () => {
  const state = await makeWorld();
  startIntro(state);
  updateIntro(state, INTRO_TIMING.walk);
  const stopped = { ...state.ecs.spatial[state.ui.playerId] };
  expect(Hex().fromPoint(stopped).toString()).toBe(Hex(state.map.playerStartTile).toString());
  expect(state.intro.pose).toBe("putting-down");
  updateIntro(state, INTRO_TIMING.putDown);
  expect(state.intro.putDown).toBe(1);
  expect(state.intro.pose).toBe("standing");
  expect(state.intro.fire).toBe(0);
  expect(state.intro.bedroll).toBe(0);
  updateIntro(state, INTRO_TIMING.fire / 2);
  expect(state.intro.fire).toBeGreaterThan(0);
  expect(state.intro.fire).toBeLessThan(1);
  expect(state.intro.bedroll).toBe(0);
  updateIntro(state, INTRO_TIMING.fire / 2 + INTRO_TIMING.bedroll / 2);
  expect(state.intro.fire).toBe(1);
  expect(state.intro.bedroll).toBeGreaterThan(0);
  expect(state.intro.bedroll).toBeLessThan(1);
  expect(state.ecs.spatial[state.ui.playerId]).toEqual(stopped);
  expect(Object.keys(state.ecs.camp || {})).toHaveLength(0);
  updateIntro(state, INTRO_TIMING.duration);
  const id = state.intro.campId;
  expect(state.ecs.household[state.ui.playerId].houseId).toBe(id);
  expect(state.ecs.spatial[id]).toMatchObject(state.intro.campPoint);
  expect(state.ecs.sleepable[id]).toMatchObject({ capacity: 1, level: 0, occupiers: [] });
  expect(state.ecs.controllable[id].controllerId).toBe(state.ui.playerId);
  expect(state.ecs.container[id]).toBeUndefined();
  expect(state.ecs.camp[id].bundle).toEqual(CAMP_LAYOUT.bundle);
  expect(state.space[Hex(state.map.playerStartTile)]).toContain(id);
  expect(state.intro.pose).toBe("standing");
});

it("plays in four to six real seconds with time, hunger, villagers and queues frozen, then restores simulation", async () => {
  const state = await makeWorld();
  const simulation = createSimulation(state);
  const before = { days: state.days, people: JSON.stringify(state.ecs.personable), planners: JSON.stringify(state.ecs.planner), managers: JSON.stringify(state.ecs.manager) };
  startIntro(state);
  const start = { ...state.ecs.spatial[state.ui.playerId] };
  state.game_speed = "fast";
  simulation.step(1, 1.4);
  expect(state.ecs.spatial[state.ui.playerId]).not.toEqual(start);
  expect(state.intro.phase).toBe("walking");
  simulation.step(1, INTRO_TIMING.duration - 1.4 - 0.01);
  expect(introActive(state)).toBe(true);
  expect(Object.keys(state.ecs.camp || {})).toHaveLength(0);
  simulation.step(1, 0.02);
  expect(introActive(state)).toBe(false);
  expect(state.intro.pose).toBe("standing");
  expect(INTRO_TIMING.duration).toBeGreaterThanOrEqual(4);
  expect(INTRO_TIMING.duration).toBeLessThanOrEqual(6);
  expect(state.ui.show.speed_controls).toBe(true);
  expect(state.days).toBe(before.days);
  expect(JSON.stringify(state.ecs.personable)).toBe(before.people);
  expect(JSON.stringify(state.ecs.planner)).toBe(before.planners);
  expect(JSON.stringify(state.ecs.manager)).toBe(before.managers);
  simulation.step(1, 2);
  expect(state.days).toBeGreaterThan(before.days);
});

it("skipping at any phase and the URL bypass produce the same finished camp as watching", async () => {
  const original = await makeWorld();
  const watched = structuredClone(original);
  startIntro(watched);
  for (let i = 0; i < Math.ceil(INTRO_TIMING.duration * 60) + 1; i++) updateIntro(watched, 1 / 60);
  for (const elapsed of [0, 1.2, 3, 3.6, 4.3, 4.8]) {
    const state = structuredClone(original);
    startIntro(state);
    updateIntro(state, elapsed);
    skipIntro(state);
    expect(state.ecs).toEqual(watched.ecs);
    expect(state.intro).toEqual(watched.intro);
    expect(state.ui).toEqual(watched.ui);
    expect(state.days).toBe(original.days);
    skipIntro(state);
    expect(state.ecs).toEqual(watched.ecs);
  }
  const bypassed = structuredClone(original);
  startIntro(bypassed, { skip: true });
  expect(bypassed.ecs).toEqual(watched.ecs);
  expect(bypassed.intro).toEqual(watched.intro);
});

it("holds the initial edge frame briefly before the walk begins", async () => {
  const state = await makeWorld();
  const simulation = createSimulation(state);
  startIntro(state);
  const outside = { ...state.ecs.spatial[state.ui.playerId] };
  simulation.step(1, INTRO_TIMING.enter / 2);
  expect(state.ecs.spatial[state.ui.playerId]).toEqual(outside);
  simulation.step(1, INTRO_TIMING.enter);
  expect(state.ecs.spatial[state.ui.playerId]).not.toEqual(outside);
});
