import { Hex, generateTrees, Grid, MIN_START_TREES } from "game/map";
import { topController } from "game/playable";
import { path } from "game/pathfinding";
import { startIntro } from "game/intro";
import { generateForage } from "game/ecology";
import { flatVillage } from "./support/village";

it("makes an independent arriving person a bedroll camp without household stores", () => {
  const { s: state, start } = flatVillage(3);
  state.map = { centre: { x: 0, y: 0 }, radius: 9, playerStartTile: start };
  state.villages.fixture.centre = { x: 0, y: 0 };
  const playerId = state.ui.playerId;
  expect(Object.keys(state.ecs.camp || {})).toHaveLength(0);
  expect(state.ecs.household[playerId]).toBeUndefined();
  startIntro(state, { skip: true });
  expect(Object.keys(state.ecs.personable).filter(id => topController(state.ecs, id) == playerId)).toEqual([playerId]);
  expect(Object.keys(state.ecs.building).every(id => topController(state.ecs, id) != playerId)).toBe(true);
  expect(state.ecs.kinship[playerId]).toMatchObject({ parents: [], children: [], spouse: null });
  expect(state.ecs.village[playerId].villageId).toBeNull();
  const camp = Object.keys(state.ecs.camp)[0];
  expect(state.ecs.sleepable[camp]).toMatchObject({ capacity: 1 });
  expect(state.ecs.container[camp]).toBeUndefined();
});

it.each(["jungle", "desert", "tundra"])("places reachable starting forage in a sparse %s patch", biome => {
  const { s, tileAt } = flatVillage(0);
  const island = Hex(0, 0);
  for (const tile of Object.values(s.ecs.mappable)) tile.biome = biome;
  // No settlement or history is needed to test the actual food guarantee.
  generateForage(s, 1234, island);
  const from = tileAt[island];
  expect(Object.keys(s.ecs.forageable).some(id => island.distance(Hex().fromPoint(s.ecs.spatial[id])) <= 4 &&
    path(s, from, tileAt[Hex().fromPoint(s.ecs.spatial[id])])?.length > 0)).toBe(true);
});

it("counts starting wood after leaving the camp clearing empty", () => {
  const start = Hex(5, 5);
  const grid = Grid.hexagon({ center: start, radius: 4 });
  const landscape = Object.fromEntries(grid.map(h => [h.toString(), { terrain: "grassland" }]));
  for (const biome of ["jungle", "desert", "tundra"]) {
    const trees = generateTrees(1234, landscape, {}, grid.pointWidth(), grid.pointHeight(), { biomeAt: () => biome, start });
    expect(trees.every(t => start.distance(Hex().fromPoint(t)) > 1)).toBe(true);
    expect(trees.filter(t => start.distance(Hex().fromPoint(t)) <= 4).length).toBeGreaterThanOrEqual(MIN_START_TREES);
  }
});

it("prepares repeatable two-hex entrances with reachable doors, wood and food on a small map", () => {
  const { prepareEntrances, edgeSide, exitPoint } = require("game/travel_geometry");
  const { WorldGrid, WorldHex } = require("game/hex");
  const { newEntities } = require("game/entities");
  const centre = Hex(9, 9);
  const { s, start, tileAt } = flatVillage(3, { centre });
  const grid = Grid.hexagon({ center: centre, radius: 9 });
  s.map = { centre: { ...centre }, radius: 9, playerStartTile: start };
  s.villages.fixture.centre = { ...centre };
  const world = { home: { x: 0, y: 0 }, hexes: WorldGrid.hexagon({ radius: 1 }).map(h => ({ ...h, ocean: false })) };
  world.home = { ...WorldHex(0, 0) };
  const landscape = Object.fromEntries(grid.map(h => [h, { ...h.toPoint(), terrain: "grassland" }]));
  const settlements = Object.fromEntries(Object.keys(s.ecs.building).map(id => {
    const h = Hex().fromPoint(s.ecs.spatial[id]);
    return [h, { ...h }];
  }));
  const entrances = prepareEntrances(grid, landscape, settlements, world, s.map.centre, s.map.radius);
  s.map.entrances = entrances;
  expect(entrances).toEqual(prepareEntrances(grid, structuredClone(landscape), settlements, world, s.map.centre, s.map.radius));
  expect(Object.keys(entrances)).toHaveLength(6);
  for (const [side, entry] of Object.entries(entrances)) {
    entry.tileIds = entry.hexes.map(h => tileAt[Hex(h)]);
    expect(exitPoint(s, entry.tileIds[0])).toEqual(entry.start);
    expect(edgeSide(s, entry.tileIds[0])).toBe(+side);
    expect(entry.hexes.map(h => centre.distance(Hex(h)))).toEqual([9, 8, 7]);
    expect(Hex(entry.hexes[0]).distance(Hex(entry.hexes[2]))).toBe(2);
    for (let i = 0; i < 3; i++) {
      expect(s.ecs.walkable[entry.tileIds[i]].speed).toBeGreaterThan(0);
      if (i) expect(Object.values(s.ecs.walkable[entry.tileIds[i - 1]].neighbours)).toContain(entry.tileIds[i]);
    }
    const goal = Hex(entry.hexes[2]), from = entry.tileIds[2];
    expect(s.ecs.mappable[from].terrain).toBe("grassland");
    expect(Object.keys(s.ecs.building).some(id => path(s, from, tileAt[Hex().fromPoint(s.ecs.spatial[id])])?.length > 0)).toBe(true);
    const trees = generateTrees(13, landscape, settlements, grid.pointWidth(), grid.pointHeight(), { biomeAt: () => "desert", start: goal });
    const wood = newEntities(s, trees.map(p => ({ spatial: { ...p, immovable: true }, tree: {}, good: { type: "wood", amount: 1 } })));
    generateForage(s, 13, goal, { onlyStart: true });
    const reachable = ids => ids.filter(id => goal.distance(Hex().fromPoint(s.ecs.spatial[id])) <= 4 &&
      path(s, from, tileAt[Hex().fromPoint(s.ecs.spatial[id])])?.length > 0);
    expect(reachable(wood).length).toBeGreaterThanOrEqual(MIN_START_TREES);
    expect(reachable(Object.keys(s.ecs.forageable)).length).toBeGreaterThanOrEqual(3);
  }
});
