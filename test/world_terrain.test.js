import { Hex, Grid, WorldHex, WorldGrid, ALL_SIDES } from "game/hex";
import { MAP_CENTRE, MAP_RADIUS, createLandField, worldPoint } from "game/world_terrain";

const origin = h => worldPoint(h, MAP_CENTRE.toPoint());

describe("the continuous world terrain", () => {
  it("replays land and inland terrain from the seed", () => {
    const a = createLandField(1234);
    const b = createLandField(1234);
    const c = createLandField(4321);
    const points = [...Grid.hexagon({ radius: 3 })].map(h => h.toPoint());
    expect(points.map(p => a.landAt(p))).toEqual(points.map(p => b.landAt(p)));
    expect(points.map(p => a.terrainAt(p))).toEqual(points.map(p => b.terrainAt(p)));
    expect(points.map(p => a.landAt(p))).not.toEqual(points.map(p => c.landAt(p)));
  });

  it("agrees along every shared world border, sampled in each map's local coordinates", () => {
    const home = WorldHex(5, 5);
    const neighbours = WorldGrid.hexagon({ center: home, radius: 1 }).neighborsOf(home, ALL_SIDES);
    for (const seed of [1, 1234, 98765]) {
      const a = createLandField(seed);
      const b = createLandField(seed);
      for (const next of neighbours) {
        const from = origin(home);
        const to = origin(next);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        for (let i = -10; i <= 10; i++) {
          const p = { x: (from.x + to.x) / 2 - dy * i / 40, y: (from.y + to.y) / 2 + dx * i / 40 };
          const local = h => {
            const o = origin(h);
            const c = MAP_CENTRE.toPoint();
            return { x: c.x + p.x - o.x, y: c.y + p.y - o.y };
          };
          const left = worldPoint(home, local(home));
          const right = worldPoint(next, local(next));
          expect(a.landAt(left)).toBeCloseTo(b.landAt(right), 10);
          expect(a.terrainAt(left)).toEqual(b.terrainAt(right));
        }
      }
    }
  });

  it("places world neighbours in pointy-top directions while small tiles stay flat-top", () => {
    expect(Hex().width()).toBeGreaterThan(Hex().height());
    expect(WorldHex().height()).toBeGreaterThan(WorldHex().width());
    const home = WorldHex(5, 5);
    const from = origin(home);
    const neighbours = WorldGrid.hexagon({ center: home, radius: 1 }).neighborsOf(home, ALL_SIDES);
    for (const n of neighbours) {
      const to = origin(n);
      const expected = n.toPoint().subtract(home.toPoint());
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      // NOTE: stepped map borders skew the ideal directions by less than one small tile.
      const cosine = (dx * expected.x + dy * expected.y) / (Math.hypot(dx, dy) * Math.hypot(expected.x, expected.y));
      expect(cosine).toBeGreaterThan(0.999);
    }
  });

  it("tiles neighbouring maps without overlapping or skipping small hexes", () => {
    const home = WorldHex(5, 5);
    const neighbours = WorldGrid.hexagon({ center: home, radius: 1 }).neighborsOf(home, ALL_SIDES);
    const tiles = [...Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS })];
    const keys = new Set();
    for (const h of [home, ...neighbours]) {
      for (const tile of tiles) {
        const p = worldPoint(h, tile.toPoint());
        const key = Math.round(p.x * 1000) + "," + Math.round(p.y * 1000);
        expect(keys.has(key)).toBe(false);
        keys.add(key);
      }
    }
    expect(keys.size).toEqual(7 * 1519);
    for (const tile of tiles.filter(h => MAP_CENTRE.distance(h) == MAP_RADIUS)) {
      const around = Grid.hexagon({ center: tile, radius: 1 }).neighborsOf(tile, ALL_SIDES);
      for (const n of around) {
        const p = worldPoint(home, n.toPoint());
        expect(keys.has(Math.round(p.x * 1000) + "," + Math.round(p.y * 1000))).toBe(true);
      }
    }
  });

  it("keeps mountains, stone, grassland and inland water above the ocean field", () => {
    const field = createLandField(1234);
    const seen = new Set();
    let inlandWater = 0;
    for (let x = 0; x < 24000; x += 110) {
      for (let y = 0; y < 24000; y += 110) {
        const p = {x, y};
        const terrain = field.terrainAt(p);
        seen.add(terrain);
        if (field.landAt(p) < 0) { expect(terrain).toMatch(/water/); }
        if (field.landAt(p) > 0.2 && terrain.includes("water")) { inlandWater++; }
      }
    }
    expect([...seen].sort()).toEqual(["deep water", "grassland", "mountain", "shallow water", "stone"]);
    expect(inlandWater).toBeGreaterThan(0);
  });
});

it("has few isolated single land and water tiles along the coasts", () => {
  let isolated = 0;
  let coastal = 0;
  const tiles = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
  const offsets = Grid.hexagon({ radius: 1 }).neighborsOf(Hex(0, 0), ALL_SIDES)
    .map(h => h.toPoint().subtract(Hex(0, 0).toPoint()));
  for (const seed of [1, 13, 1234, 98765]) {
    const field = createLandField(seed);
    for (const h of WorldGrid.hexagon({ center: WorldHex(5, 5), radius: 2 })) {
      for (const tile of tiles) {
        const p = worldPoint(h, tile.toPoint());
        if (Math.abs(field.landAt(p)) > 0.15) continue;
        const water = field.terrainAt(p).includes("water");
        const same = offsets.filter(o => field.terrainAt({ x: p.x + o.x, y: p.y + o.y }).includes("water") == water).length;
        coastal++;
        if (same == 0) isolated++;
      }
    }
  }
  expect(coastal).toBeGreaterThan(500);
  expect(isolated / coastal).toBeLessThan(0.001);
});
