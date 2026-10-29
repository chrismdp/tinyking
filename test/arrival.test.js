import { generateMap, Hex } from "game/map";
import { MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { topController } from "game/playable";
import { path } from "game/pathfinding";

it("arrives alone at an edge camp, with a bedroll, reachable village, wood and food across seeds", async () => {
  for (const seed of [1, 2, 13, 20, 53, 84, 1234, 98765]) {
    const state = { ecs: { nextId: 1 }, days: 0.375 };
    const { map, playerId } = await generateMap(state, seed, async () => {});
    const start = Hex(map.playerStartTile);
    expect(MAP_CENTRE.distance(start)).toBeGreaterThanOrEqual(MAP_RADIUS - 4);
    expect(Object.keys(state.ecs.personable).filter(id => topController(state.ecs, id) == playerId)).toEqual([playerId]);
    expect(Object.keys(state.ecs.building).every(id => topController(state.ecs, id) != playerId)).toBe(true);
    expect(state.ecs.kinship[playerId]).toMatchObject({ parents: [], children: [], spouse: null });
    expect(state.ecs.village[playerId].villageId).toBeNull();
    const camp = Object.keys(state.ecs.camp)[0];
    expect(state.ecs.sleepable[camp]).toMatchObject({ capacity: 1 });
    expect(state.ecs.container[camp]).toBeUndefined();
    const tileAt = point => state.space[Hex().fromPoint(point)].find(id => state.ecs.mappable[id]);
    const from = tileAt(state.ecs.spatial[playerId]);
    const nearby = Object.keys(state.ecs.building).filter(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) <= 8);
    expect(nearby.some(id => path(state, from, tileAt(state.ecs.spatial[id]))?.length > 0)).toBe(true);
    for (const ids of [Object.keys(state.ecs.tree), Object.keys(state.ecs.forageable)]) {
      expect(ids.some(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) <= 4 &&
        path(state, from, tileAt(state.ecs.spatial[id]))?.length > 0)).toBe(true);
    }
  }
}, 15000);

it("counts starting wood after leaving the camp clearing empty", () => {
  const { generateTrees, Grid, MIN_START_TREES } = require("game/map");
  const start = Hex(5, 5);
  const grid = Grid.hexagon({ center: start, radius: 4 });
  const landscape = Object.fromEntries(grid.map(h => [h.toString(), { terrain: "grassland" }]));
  for (const biome of ["jungle", "desert", "tundra"]) {
    const trees = generateTrees(1234, landscape, {}, grid.pointWidth(), grid.pointHeight(), { biomeAt: () => biome, start });
    expect(trees.every(t => start.distance(Hex().fromPoint(t)) > 1)).toBe(true);
    expect(trees.filter(t => start.distance(Hex().fromPoint(t)) <= 4).length).toBeGreaterThanOrEqual(MIN_START_TREES);
  }
});
