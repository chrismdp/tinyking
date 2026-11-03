import { createHeightField } from "game/height";
import { resetMapState, generateTerrain, generateSettlements, generateFamilies, Hex, Grid, generateTrees, MIN_START_TREES, walkable } from "game/map";
import { createLandField, worldPoint, MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { BIOMES } from "game/overworld";
import { climateAt, localHabitat, setTileElevation, temperatureName, biomeMixture } from "game/biome_field";
import { updateWeather } from "game/weather";
import { newEntities } from "game/entities";
import { repairHouseholds } from "game/possessions";
import { birth } from "game/social";
import { flatVillage } from "./support/village";

it("declares a complete positive local hexagon with a 132-tile rim", () => {
  expect(MAP_RADIUS).toBe(22);
  const grid = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
  expect(grid).toHaveLength(1519);
  expect(new Set(grid.map(String)).size).toBe(1519);
  expect(grid.filter(h => MAP_CENTRE.distance(h) == MAP_RADIUS)).toHaveLength(132);
  for (const h of grid) {
    expect(MAP_CENTRE.distance(h)).toBeLessThanOrEqual(MAP_RADIUS);
    const { x, y } = h.toPoint();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  }
});

it("sets walking speed from terrain alone", () => {
  expect(walkable).toEqual({ grassland: 1, stone: .5, mountain: 0, "shallow water": 0, "deep water": 0 });
});

it("refreshes physical habitat on two real tiles after grading their altitude", () => {
  const home = { x: 0, y: 0 };
  const world = { home, centre: home, radius: 5, climate: { seed: 13,
    moisture: { wind: { x: 1, y: 0 }, u0: 0, v0: 0, width: 2, height: 2, step: 50000, values: [.3, .5, .7, .9] } } };
  const state = { world, ecs: { nextId: 1 }, ecology: { tiles: {} } };
  const ids = newEntities(state, [Hex(22, 22), Hex(22, 23)].map(h => ({ spatial: h.toPoint(), mappable: { elevation: -1 } })));
  const warmth = [];
  for (const [i, id] of ids.entries()) {
    const p = state.ecs.spatial[id], altitude = i ? 1400 : 20;
    state.ecology.tiles[Hex().fromPoint(p)] = { id };
    setTileElevation(state, id, altitude);
    const tile = state.ecs.mappable[id], climate = climateAt(world, worldPoint(home, p));
    expect(tile).toEqual({ id, ...localHabitat(world, p, altitude) });
    expect(tile.climateWarmth).toBeCloseTo(climate.climateWarmth, 12);
    expect(tile.moistureValue).toBeCloseTo(climate.moistureValue, 12);
    expect(tile.biomeMix).toEqual(biomeMixture(tile.warmth, tile.moistureValue));
    expect(tile.temperature).toBe(temperatureName(tile.warmth));
    expect(state.ecology.tiles[Hex().fromPoint(p)].biomeMix).toEqual(tile.biomeMix);
    warmth.push(tile.warmth);
  }
  expect(Math.max(...warmth) - Math.min(...warmth)).toBeGreaterThan(.05);
  expect(state.ecs.mappable[ids[1]].temperature).toBe("cold");
  expect(state.ecs.mappable[ids[1]].warmth).toBeLessThan(state.ecs.mappable[ids[1]].climateWarmth);
  expect(state.ecs.mappable[ids[0]].moistureValue).toBe(.3);
  expect(state.ecs.mappable[ids[1]].moistureValue).toBeGreaterThan(state.ecs.mappable[ids[0]].moistureValue);
});

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
  const initialLandscape = structuredClone(landscape);
  const { settlements, villages } = await generateSettlements(seed, grid, landscape, start, async () => {}, new Set(grid.map(String)), natural);
  if (seed == 1234) {
    const replay = await generateSettlements(seed, grid, initialLandscape, start, async () => {}, new Set(grid.map(String)), natural);
    expect(replay.settlements).toEqual(settlements);
    expect(replay.villages).toEqual(villages);
    expect(initialLandscape).toEqual(landscape);
  }
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
  for (const id of parents) state.ecs.personable[id].age = 30;
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

it("clears a previous spatial index before IDs are reused", () => {
  const state = { ecs: { nextId: 1 }, days: .375 };
  const addTile = hex => newEntities(state, [{ spatial: { ...hex.toPoint(), immovable: true }, mappable: { terrain: "grassland" } }])[0];
  const old = addTile(Hex(0, 0));
  expect(state.space[Hex(0, 0)]).toEqual([old]);
  state.ecs = { nextId: 1 };
  resetMapState(state);
  const fresh = addTile(Hex(2, 0));
  expect(fresh).toBe(old);
  expect(state.space[Hex(0, 0)]).toBeUndefined();
  for (const hex in state.space) {
    for (const id of state.space[hex]) {
      expect(state.ecs.spatial[id]).toBeDefined();
      expect(Hex().fromPoint(state.ecs.spatial[id]).toString()).toEqual(hex);
    }
    expect(state.space[hex].filter(id => state.ecs.mappable[id]).length).toBeLessThanOrEqual(1);
  }
});

it("resets dirty snow and weather to the same fresh conditions on a small map", () => {
  const make = dirty => {
    const state = { ecs: { nextId: 1 }, days: .375, snow: dirty ? { stale: 1 } : {},
      snowRevision: dirty ? 99 : 0, weather: dirty ? { stale: { type: "snow" } } : {} };
    resetMapState(state);
    const home = { x: 0, y: 0, temperature: "cold", moisture: "wet", biome: "snowfield" };
    state.world = { home, hexes: [home] };
    newEntities(state, [0, 1000].map(elevation => ({ spatial: { ...Hex(elevation / 1000, 0).toPoint(), immovable: true },
      mappable: { terrain: "grassland", elevation, temperature: "cold", warmth: 0 } })));
    updateWeather(state, 0, 13);
    return state;
  };
  const state = make(true), clean = make(false);
  expect(Object.keys(state.weather)).toHaveLength(1);
  expect(state.weather.stale).toBeUndefined();
  expect(Object.keys(state.snow)).toHaveLength(2);
  expect(state.snow.stale).toBeUndefined();
  expect(state.weather).toEqual(clean.weather);
  expect(state.snow).toEqual(clean.snow);
  expect(state.snowRevision).toBe(clean.snowRevision);
  expect(state.environmentUpdatedAt).toBe(state.days);
  expect(Object.values(state.snow).some(depth => depth > 0)).toBe(true);
});
