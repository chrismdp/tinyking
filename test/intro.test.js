/* global it, expect */
import { generateFamilies, Hex, Grid, ALL_SIDES } from "game/map";
import { newEntities } from "game/entities";
import { arrivalRoute, startIntro, skipIntro, updateIntro, introFrameSeconds, INTRO_TIMING } from "game/intro";
import { serialiseGame, restoreGame } from "game/save_game";

const routeFixture = () => {
  const state = { ecs: { nextId: 1, building: {} }, days: 0.375, space: {}, redraws: [], ui: { show: {} },
    map: { playerStartTile: { x: 1, y: 0 }, centre: { x: 0, y: 0 }, radius: 3 },
    villages: { v: { centre: { x: -2, y: -1 } }, far: { centre: { x: 8, y: 0 } } } };
  const hexes = Grid.hexagon({ radius: 3 });
  const ids = newEntities(state, hexes.map(h => ({ spatial: { ...h.toPoint(), immovable: true }, mappable: {}, walkable: { speed: 1, worn: {}, neighbours: {} } })));
  hexes.forEach((hex, i) => Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).forEach((n, side) => {
    const j = hexes.findIndex(h => h.toString() == n.toString());
    if (j >= 0) state.ecs.walkable[ids[i]].neighbours[side] = ids[j];
  }));
  newEntities(state, [{ spatial: Hex(-2, -1).toPoint(), building: { entrance: 0, rooms: [] },
    controllable: {}, village: { villageId: "v" } }]);
  generateFamilies({ state, seed: 13, playerStartTile: Hex(state.map.playerStartTile) });
  state.ui.playerId = Object.keys(state.ecs.playable)[0];
  state.ecs.household ||= {};
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

it("excludes character setup before arrival from the first animation frame", () => {
  const state = routeFixture(), before = performance.now();
  startIntro(state);
  const after = performance.now();
  const seconds = introFrameSeconds(state, before - 5000, after);
  expect(seconds).toBeGreaterThanOrEqual(0);
  expect(seconds).toBeLessThanOrEqual((after - before) / 1000);
  updateIntro(state, seconds);
  expect(state.intro.active).toBe(true);
  expect(introFrameSeconds(state, after, after + 200)).toBeCloseTo(.2, 10);
});

it("resumes a saved arrival with the new page's clock and no saved wall time", () => {
  const state = routeFixture();
  startIntro(state);
  updateIntro(state, .5);
  const loaded = restoreGame(serialiseGame(state));
  expect(loaded.intro).toEqual(state.intro);
  expect(introFrameSeconds(loaded, 1000, 1100)).toBeCloseTo(.1, 10);
});

it("leaves the real frame interval unchanged after arrival finishes", () => {
  const state = routeFixture();
  startIntro(state);
  skipIntro(state);
  const now = performance.now();
  expect(introFrameSeconds(state, now - 5000, now)).toBe(5);
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

it("skipping at any phase and the URL bypass produce the same finished camp as watching", async () => {
  const original = routeFixture();
  const watched = structuredClone(original);
  startIntro(watched);
  for (let i = 0; i < Math.ceil(INTRO_TIMING.duration * 60) + 1; i++) updateIntro(watched, 1 / 60);
  for (const elapsed of [0, 1.2, 3, 3.6, 4.3, 4.8]) {
    const state = structuredClone(original);
    startIntro(state);
    updateIntro(state, elapsed);
    skipIntro(state);
    expect(state.ecs).toEqual(watched.ecs);
    expect(state.days).toBe(original.days);
    skipIntro(state);
    expect(state.ecs).toEqual(watched.ecs);
  }
  const bypassed = structuredClone(original);
  startIntro(bypassed, { skip: true });
  expect(bypassed.ecs).toEqual(watched.ecs);
});

it("keeps the entry outside the map and the three walkable tiles consecutive", () => {
  const state = routeFixture(), route = arrivalRoute(state);
  const at = point => (state.space[Hex().fromPoint(point)] || []).find(id => state.ecs.mappable[id]);
  expect(at(route.points[0])).toBeUndefined();
  expect(route.tileIds).toHaveLength(3);
  const hexes = route.tileIds.map(id => Hex().fromPoint(state.ecs.spatial[id]));
  expect(hexes.map(h => Hex(state.map.centre).distance(h))).toEqual([3, 2, 1]);
  expect(hexes[0].distance(hexes[2])).toBe(2);
  for (let i = 0; i < route.tileIds.length; i++) {
    expect(state.ecs.walkable[route.tileIds[i]].speed).toBeGreaterThan(0);
    if (i) expect(Object.values(state.ecs.walkable[route.tileIds[i - 1]].neighbours)).toContain(route.tileIds[i]);
  }
  expect(at(route.points.at(-1))).toBe(route.tileIds.at(-1));
  expect(Hex().fromPoint(route.campPoint).toString()).toBe(Hex(state.map.playerStartTile).toString());
  expect(arrivalRoute(state)).toEqual(route);
});
