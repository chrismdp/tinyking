import { createHeightField } from "game/height";
import { generateTerrain, generateSettlements, generateFamilies, Hex, Grid, generateTrees, MIN_START_TREES } from "game/map";
import { createLandField, worldPoint } from "game/world_terrain";
import { BIOMES } from "game/overworld";
import { newEntities } from "game/entities";
import { repairHouseholds } from "game/possessions";
import { birth } from "game/social";
import { flatVillage } from "./support/village";

it.each([20, 1234, 98765])("samples physical terrain and elevation before settlement clearing (seed %s)", async seed => {
  const home = { x: 5, y: 5 };
  const world = { landSeed: seed + ":0", home: { ...home }, hexes: [{ x: 4, y: 5 }, home] };
  const field = createLandField(world.landSeed);
  const grid = [[0, 22], [22, 0], [22, 22], [44, 22], [22, 44]].map(([x, y]) => Hex(x, y));
  const landscape = await generateTerrain(grid, world, async () => {});
  expect(Object.keys(landscape)).toHaveLength(grid.length);
  for (const tile of Object.values(landscape)) {
    expect(tile.terrain).toBe(field.terrainAt(worldPoint(home, tile)));
    expect(tile.elevation).toBe(field.elevationAt(worldPoint(home, tile)));
  }
});

it.each([20, 1234, 98765])("sites named hamlets and creates families directly (seed %s)", async seed => {
  const grid = Grid.hexagon({ center: Hex(11, 11), radius: 11 });
  const start = Hex(11, 2);
  const landscape = Object.fromEntries(grid.map(h => [h, { ...h.toPoint(), terrain: "grassland", elevation: 20, economic_value: 10 }]));
  const natural = createHeightField({ seed: 0, terrainAt: () => "grassland", elevationAt: () => 20 });
  const { settlements, villages } = await generateSettlements(seed, grid, landscape, start, async () => {}, new Set(grid.map(String)), natural);
  expect(Object.values(villages).length).toBeGreaterThanOrEqual(3);
  expect(new Set(Object.values(villages).map(v => v.name)).size).toBe(Object.keys(villages).length);
  const state = { ecs: { nextId: 1 }, days: 0.375, villages };
  for (const house of Object.values(settlements)) {
    const [id] = newEntities(state, [{ spatial: Hex(house).toPoint(), building: { entrance: house.frontDoorSide }, controllable: {}, village: { villageId: house.villageId } }]);
    villages[house.villageId].houses.push(id);
  }
  generateFamilies({ state, seed, playerStartTile: start });
  const houses = Object.values(villages).flatMap(v => v.houses);
  expect(new Set(houses).size).toBe(houses.length);
  expect(houses.length).toBe(Object.keys(state.ecs.building).length);
  const player = Object.keys(state.ecs.playable)[0];
  expect(state.ecs.village[player].villageId).toBeNull();
  expect(state.ecs.household[player]).toBeUndefined();
  for (const village of Object.values(villages)) {
    expect(village.name.length).toBeGreaterThan(2);
    expect(village.houses.length).toBeGreaterThanOrEqual(3);
    expect(village.houses.length).toBeLessThanOrEqual(8);
    for (const id of village.houses) {
      const hex = Hex().fromPoint(state.ecs.spatial[id]);
      expect(state.ecs.village[id].villageId).toBe(village.id);
      expect(start.distance(hex)).toBeGreaterThanOrEqual(3);
      expect(Hex(village.centre).distance(hex)).toBeLessThanOrEqual(3);
      expect(village.houses.some(other => other != id && hex.distance(Hex().fromPoint(state.ecs.spatial[other])) <= 3)).toBe(true);
    }
  }
  for (const id in state.ecs.personable) if (id != player) {
    const home = state.ecs.household[id].houseId;
    expect(state.ecs.village[id].villageId).toBe(state.ecs.village[home].villageId);
  }
});

it("provides a bed for every member of the larger households", () => {
  const { s: state, village } = flatVillage(3, { seed: 1234, founding: false });
  const parents = Object.keys(state.ecs.personable).filter(id => state.ecs.household[id]?.houseId == village.houses[1] && state.ecs.kinship[id].spouse);
  for (let i = 0; i < 7; i++) birth(state, parents[0], parents[1], i);
  repairHouseholds(state);
  for (const id in state.ecs.building) {
    const occupants = Object.keys(state.ecs.personable).filter(person => !state.ecs.personable[person].dead && (!state.residents || state.residents[person]) && state.ecs.household[person]?.houseId == id).length;
    const beds = state.ecs.building[id].rooms.reduce((n, room) => n + (state.ecs.sleepable[room]?.capacity || 0), 0);
    expect(beds).toBeGreaterThanOrEqual(occupants);
  }
});

describe("trees", () => {
  // NOTE: a map-sized hexagon that is all grassland, with no houses
  const landscape = {};
  const centre = Hex(11, 11);
  Grid.hexagon({ center: centre, radius: 11 }).forEach(hex => {
    landscape[hex] = { terrain: "grassland" };
  });
  const WIDTH = 2100;
  const HEIGHT = 2390;
  const treesIn = (seed, biome, start) => generateTrees(seed, landscape, {}, WIDTH, HEIGHT, { biomeAt: () => biome, start });
  const small = Grid.hexagon({ center: Hex(6, 6), radius: 6 });
  const smallLand = Object.fromEntries(small.map(h => [h.toString(), { terrain: "grassland" }]));

  it("keeps grassland's woods exactly as they were", () => {
    // NOTE: counts and checksums from before biomes set the density
    const before = { 7: [401, 2101659], 1234: [309, 1250293] };
    for (const seed in before) {
      const trees = treesIn(+seed, "grassland");
      expect([trees.length, trees.reduce((sum, t) => sum + t.x * 3 + t.y, 0)]).toEqual(before[seed]);
    }
  });

  it("grows each biome's trees as thickly as the biome says, the same seed over the same land", () => {
    const count = biome => generateTrees(7, smallLand, {}, small.pointWidth(), small.pointHeight(),
      { biomeAt: () => biome }).length;
    const counts = {};
    Object.keys(BIOMES).forEach(biome => { counts[biome] = count(biome); });

    expect(counts.jungle).toBeGreaterThan(counts.grassland);
    expect(counts.grassland).toBeGreaterThan(counts.desert);

    // NOTE: very dense, dense, patches, scattered, sparse, almost none
    expect(counts.jungle).toBeGreaterThan(counts.taiga);
    expect(counts.taiga).toBeGreaterThan(counts.grassland);
    expect(counts.grassland).toBeGreaterThan(counts.marsh);
    ["savanna", "steppe", "snowfield"].forEach(sparse => {
      expect(counts.marsh).toBeGreaterThan(counts[sparse]);
      expect(counts[sparse]).toBeGreaterThan(counts.tundra);
      expect(counts[sparse]).toBeGreaterThan(counts.desert);
    });
    expect(counts.desert).toBeGreaterThan(0);
  });

  it("always grows a few trees within reach of the start, in every biome", () => {
    // NOTE: a small grassland patch, sea three hexes out, then unreachable
    // grassland beyond: only the inner patch counts towards starting wood.
    const start = Hex(4, 4);
    const island = {};
    const grid = Grid.hexagon({ center: start, radius: 4 });
    grid.forEach(hex => {
      island[hex] = { terrain: start.distance(hex) == 3 ? "deep water" : "grassland" };
    });
    const inReach = new Set([...Grid.hexagon({ center: start, radius: 2 })].map(hex => hex.toString()));
    Object.keys(BIOMES).forEach(biome => {
      const trees = generateTrees(1234, island, {}, grid.pointWidth(), grid.pointHeight(), { biomeAt: () => biome, start });
      const near = trees.filter(t => inReach.has(Hex().fromPoint(t).toString()));
      expect([biome, near.length >= MIN_START_TREES]).toEqual([biome, true]);
    });
  });

});
