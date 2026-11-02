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
