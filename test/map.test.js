import { Hex, Grid, generateMap } from "game/map";
import { createHeightField, HIGH_GROUND } from "game/height";
import { generateWorld, homeOf, colder } from "game/overworld";

const noProgress = async () => {};

// NOTE: what the World component does for "Reset to seed": a fresh ECS, then
// generate a map into the same state
async function regenerate(state, seed) {
  state.ecs = { nextId: 1 };
  state.days = 0.375;
  const { map } = await generateMap(state, seed, noProgress);
  state.map = map;
}

const SEEDS = [1, 1234, 98765, 4242424, 7777777];

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
    await regenerate(state, 98765);

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

  it("rings the hexagon with sea, so its edge is a clean hexagon", async () => {
    for (const seed of SEEDS) {
      const state = await mapFor(seed);
      const centre = Hex(state.map.centre.x, state.map.centre.y);
      const rim = tileHexes(state).filter(t => centre.distance(t.hex) == state.map.radius);
      expect(rim.length).toEqual(66);
      rim.forEach(t => expect(state.ecs.mappable[t.id].terrain).toEqual("deep water"));
    }
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

  it("keeps the world of world hexes in state, playing in its centre", async () => {
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
