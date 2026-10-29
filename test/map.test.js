import { Hex, Grid, generateMap } from "game/map";

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
    const state = {};
    await regenerate(state, 1234);
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
      const state = {};
      await regenerate(state, seed);
      const centre = Hex(state.map.centre.x, state.map.centre.y);
      const rim = tileHexes(state).filter(t => centre.distance(t.hex) == state.map.radius);
      expect(rim.length).toEqual(66);
      rim.forEach(t => expect(state.ecs.mappable[t.id].terrain).toEqual("deep water"));
    }
  });

  it("keeps everything at or above zero, so the map's points stay positive", async () => {
    const state = {};
    await regenerate(state, 1234);
    tileHexes(state).forEach(({ hex }) => {
      const { x, y } = hex.toPoint();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    });
  });

  it("starts the player on grassland with grassland all round it, on every seed", async () => {
    for (const seed of SEEDS) {
      const state = {};
      await regenerate(state, seed);
      const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y);
      Grid.spiral({ center: start, radius: 1 }).forEach(hex => {
        const id = state.space[hex.toString()].find(e => state.ecs.mappable[e]);
        expect(state.ecs.mappable[id].terrain).toEqual("grassland");
      });
    }
  });
});
