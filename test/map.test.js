import { createLandField, worldPoint } from "game/world_terrain";
import { Hex, Grid, generateMap, generateTrees, MIN_START_TREES } from "game/map";
import { createHeightField, HIGH_GROUND } from "game/height";
import { generateWorld, homeOf, colder, BIOMES } from "game/overworld";

const noProgress = async () => {};

// NOTE: what the World component does for "Reset to seed": a fresh ECS, then
// generate a map into the same state
async function regenerate(state, seed) {
  state.ecs = { nextId: 1 };
  state.days = 0.375;
  const { map } = await generateMap(state, seed, noProgress);
  state.map = map;
}

// NOTE: a few full maps cover playability; biome density is tested on small fixtures.
const SEEDS = [20, 1234, 98765];

// NOTE: a map takes most of a second to make, so each seed's map is made
// once and shared by the tests that only read it
const maps = {};
const mapFor = async seed => {
  if (!maps[seed]) {
    maps[seed] = {};
    await regenerate(maps[seed], seed);
  }
  return maps[seed];
};

const tileHexes = state => Object.keys(state.ecs.mappable)
  .map(id => ({ id, hex: Hex().fromPoint(state.ecs.spatial[id]) }));

describe("generateMap", () => {
  it("leaves nothing from a previous map in the space index when the map is regenerated", async () => {
    const state = {};
    await regenerate(state, 1234);
    maps[1234] = structuredClone(state);
    await regenerate(state, 98765);
    maps[98765] = state;

    for (const hex in state.space) {
      for (const id of state.space[hex]) {
        expect(state.ecs.spatial[id]).toBeDefined();
        expect(Hex().fromPoint(state.ecs.spatial[id]).toString()).toEqual(hex);
      }
      // NOTE: trees are jittered, so a hex just off the map can hold a tree but no tile
      expect(state.space[hex].filter(id => state.ecs.mappable[id]).length).toBeLessThanOrEqual(1);
    }
  });

  it("makes the map one big hexagon of small hexes, radius 11 round its centre", async () => {
    const state = await mapFor(1234);
    const centre = Hex(state.map.centre.x, state.map.centre.y);
    const tiles = tileHexes(state);

    expect(state.map.radius).toEqual(11);
    // NOTE: 1 + 3 * 11 * 12 hexes make a full hexagon of radius 11
    expect(tiles.length).toEqual(397);
    expect(new Set(tiles.map(t => t.hex.toString())).size).toEqual(397);
    tiles.forEach(t => expect(centre.distance(t.hex)).toBeLessThanOrEqual(11));
    Grid.hexagon({ center: centre, radius: 11 }).forEach(hex =>
      expect(tiles.some(t => t.hex.x == hex.x && t.hex.y == hex.y)).toBe(true));
  });

  it("has sea on some edges and land running off others, following the shared field", async () => {
    let sea = 0;
    let land = 0;
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      const centre = Hex(state.map.centre);
      const field = createLandField(state.world.landSeed);
      const home = homeOf(state.world);
      const rim = tileHexes(state).filter(t => centre.distance(t.hex) == state.map.radius);
      expect(rim.length).toEqual(66);
      for (const {id, hex} of rim) {
        const isLand = field.landAt(worldPoint(home, hex.toPoint())) >= 0;
        const water = state.ecs.mappable[id].terrain.includes("water");
        if (!isLand) { expect(water).toBe(true); sea++; }
        if (!water) { land++; }
      }
    }
    expect(sea).toBeGreaterThan(0);
    expect(land).toBeGreaterThan(0);
  });

  it("is mostly land before settlements clear any terrain, for every tested seed", async () => {
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      expect(homeOf(state.world).landFraction).toBeGreaterThanOrEqual(0.65);
      const land = Object.values(state.ecs.mappable).filter(t => !t.terrain.includes("water"));
      expect(land.length / 397).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("replays the same complete map from the same seed", async () => {
    const replay = {};
    await regenerate(replay, 1234);
    expect(replay).toEqual(await mapFor(1234));
  });

  it("keeps everything at or above zero, so the map's points stay positive", async () => {
    const state = await mapFor(1234);
    tileHexes(state).forEach(({ hex }) => {
      const { x, y } = hex.toPoint();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    });
  });

  it("starts the player on grassland with grassland all round it, on every seed", async () => {
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y);
      Grid.spiral({ center: start, radius: 1 }).forEach(hex => {
        const id = state.space[hex.toString()].find(e => state.ecs.mappable[e]);
        expect(state.ecs.mappable[id].terrain).toEqual("grassland");
      });
    }
  });

  it("keeps the world of world hexes in state, playing in the chosen land hex", async () => {
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      expect(state.world).toEqual(generateWorld(seed));
      expect(homeOf(state.world)).toBeDefined();
    }
  });

  it("makes high ground one step colder than the world hex, down to cold, and the rest the world hex's temperature", async () => {
    let high = 0;
    let colderThanHome = 0;
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      const home = homeOf(state.world);
      const ground = createHeightField({ seed, terrainAt: key => {
        const id = (state.space[key] || []).find(e => state.ecs.mappable[e]);
        return id && state.ecs.mappable[id].terrain;
      }});
      for (const id in state.ecs.mappable) {
        const { terrain, temperature } = state.ecs.mappable[id];
        const isHigh = terrain == "mountain" || ground.hex(state.ecs.spatial[id]).centre >= HIGH_GROUND;
        expect([id, temperature]).toEqual([id, isHigh ? colder(home.temperature) : home.temperature]);
        high += isHigh ? 1 : 0;
        colderThanHome += temperature != home.temperature ? 1 : 0;
      }
    }
    // NOTE: so the rule is actually exercised
    expect(high).toBeGreaterThan(20);
    expect(colderThanHome).toBeGreaterThan(0);
  });

  it("leaves walking speed to the terrain alone, whatever the world hex", async () => {
    const speeds = { "grassland": 1, "stone": 0.5, "mountain": 0, "shallow water": 0, "deep water": 0 };
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      for (const id in state.ecs.mappable) {
        expect(state.ecs.walkable[id].speed).toEqual(speeds[state.ecs.mappable[id].terrain]);
      }
    }
  });
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

  it("leaves trees within reach of the start on real maps, desert and tundra too", async () => {
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      // NOTE: walk out from the start along the walkable links, five hexes at most
      const tileAt = hex => (state.space[hex.toString()] || []).find(e => state.ecs.mappable[e]);
      const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y);
      const reached = new Set([tileAt(start)]);
      let frontier = [tileAt(start)];
      for (let d = 0; d < 5; d++) {
        frontier = frontier.flatMap(id => Object.values(state.ecs.walkable[id].neighbours))
          .filter(id => !reached.has(id));
        frontier.forEach(id => reached.add(id));
      }
      const trees = Object.keys(state.ecs.good)
        .filter(id => state.ecs.good[id].type == "wood" && reached.has(tileAt(Hex().fromPoint(state.ecs.spatial[id]))));
      expect([seed, homeOf(state.world).biome, trees.length >= MIN_START_TREES])
        .toEqual([seed, homeOf(state.world).biome, true]);
    }
  });
});

