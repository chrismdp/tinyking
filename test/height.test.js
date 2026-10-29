import { Hex, Grid, ALL_SIDES } from "game/map";
import { createHeightField, SEA_LEVEL } from "game/height";

// NOTE: terrain lookups keyed the way state.space is: by hex "x,y"
const mapOf = fill => {
  const terrains = {};
  Grid.rectangle({ width: 12, height: 12 }).forEach(hex => {
    terrains[hex.toString()] = fill(hex);
  });
  return key => terrains[key];
};

const grassland = mapOf(() => "grassland");
const mixed = mapOf(hex => (hex.x + hex.y) % 3 == 0 ? "mountain" : (hex.x % 4 == 0 ? "stone" : "grassland"));

const centreOf = hex => Hex(hex).toPoint();
const cornersOf = hex => {
  const c = centreOf(hex);
  return Hex().corners().map(o => ({ x: c.x + o.x, y: c.y + o.y }));
};
const middle = Hex(5, 5);
const inland = [...Grid.spiral({ center: middle, radius: 3 })];

describe("terrain height", () => {
  it("gives the same corner heights every time for the same seed", () => {
    const a = createHeightField({ seed: 1234, terrainAt: mixed });
    const b = createHeightField({ seed: 1234, terrainAt: mixed });
    const other = createHeightField({ seed: 4321, terrainAt: mixed });

    const corners = inland.map(cornersOf).flat();
    const heights = corners.map(p => a.cornerHeight(p.x, p.y));

    expect(corners.map(p => b.cornerHeight(p.x, p.y))).toEqual(heights);
    expect(corners.map(p => other.cornerHeight(p.x, p.y))).not.toEqual(heights);
    expect(new Set(heights.map(h => h.toFixed(3))).size).toBeGreaterThan(10);
  });

  it("gives neighbouring hexes identical heights at the corners they share", () => {
    const field = createHeightField({ seed: 99, terrainAt: mixed });
    const grid = Grid.hexagon({ center: middle, radius: 1 });
    const mine = field.hex(centreOf(middle)).corners;
    const myCorners = cornersOf(middle);

    grid.neighborsOf(middle, ALL_SIDES).forEach(neighbour => {
      const theirs = field.hex(centreOf(neighbour)).corners;
      const shared = [];
      cornersOf(neighbour).forEach((p, j) => {
        const i = myCorners.findIndex(q => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6);
        if (i != -1) {
          shared.push([mine[i], theirs[j]]);
        }
      });
      expect(shared.length).toEqual(2);
      shared.forEach(([m, t]) => expect(t).toBe(m));
    });
  });

  it("is the corner height at a corner and the centre height at a centre", () => {
    const field = createHeightField({ seed: 7, terrainAt: mixed });
    inland.forEach(hex => {
      const c = centreOf(hex);
      const { centre, corners } = field.hex(c);

      expect(centre).toBeCloseTo(corners.reduce((t, h) => t + h, 0) / 6, 9);
      expect(field.heightAt(c.x, c.y)).toBeCloseTo(centre, 9);
      cornersOf(hex).forEach((p, k) => {
        expect(field.heightAt(p.x, p.y)).toBeCloseTo(corners[k], 9);
        expect(field.cornerHeight(p.x, p.y)).toBe(corners[k]);
      });
    });
  });

  it("follows the flat triangles in between, with no step across a hex edge", () => {
    const field = createHeightField({ seed: 7, terrainAt: mixed });
    const [ a, b ] = cornersOf(middle);
    const edge = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const c = centreOf(middle);
    const inside = { x: edge.x + (c.x - edge.x) * 1e-6, y: edge.y + (c.y - edge.y) * 1e-6 };
    const outside = { x: edge.x - (c.x - edge.x) * 1e-6, y: edge.y - (c.y - edge.y) * 1e-6 };

    expect(field.heightAt(edge.x, edge.y)).toBeCloseTo((field.cornerHeight(a.x, a.y) + field.cornerHeight(b.x, b.y)) / 2, 9);
    expect(field.heightAt(inside.x, inside.y)).toBeCloseTo(field.heightAt(outside.x, outside.y), 4);
  });

  it("reports the slope of the triangle a point is on", () => {
    const field = createHeightField({ seed: 7, terrainAt: mixed });
    const c = centreOf(middle);
    const p = { x: c.x + 20, y: c.y + 10 };
    const { dx, dy } = field.slopeAt(p.x, p.y);

    expect(field.heightAt(p.x + 1, p.y) - field.heightAt(p.x, p.y)).toBeCloseTo(dx, 6);
    expect(field.heightAt(p.x, p.y + 1) - field.heightAt(p.x, p.y)).toBeCloseTo(dy, 6);
  });

  it("puts every corner of a water hex at sea level, so lakes are flat", () => {
    const lake = Hex(5, 5).toString();
    const terrainAt = mapOf(hex => hex.toString() == lake ? "shallow water" : "grassland");
    const field = createHeightField({ seed: 5, terrainAt });

    const { centre, corners } = field.hex(centreOf(middle));
    expect(corners).toEqual([SEA_LEVEL, SEA_LEVEL, SEA_LEVEL, SEA_LEVEL, SEA_LEVEL, SEA_LEVEL]);
    expect(centre).toEqual(SEA_LEVEL);
    const c = centreOf(middle);
    expect(field.heightAt(c.x + 17, c.y - 23)).toBeCloseTo(SEA_LEVEL, 9);

    // NOTE: the shore slopes up from the water's edge
    const shore = field.hex(centreOf(Hex(5, 4))).corners;
    expect(shore.filter(h => h == SEA_LEVEL).length).toEqual(2);
    expect(shore.filter(h => h > SEA_LEVEL).length).toEqual(4);
  });

  it("keeps dry land above the sea and lifts mountains well above grassland", () => {
    const peak = [...Grid.spiral({ center: middle, radius: 1 })].map(h => h.toString());
    const terrainAt = mapOf(hex => peak.includes(hex.toString()) ? "mountain" : "grassland");
    const field = createHeightField({ seed: 11, terrainAt });

    const grass = [...Grid.spiral({ center: Hex(2, 9), radius: 1 })].map(cornersOf).flat()
      .map(p => field.cornerHeight(p.x, p.y));
    expect(Math.min(...grass)).toBeGreaterThan(SEA_LEVEL);

    const summit = field.hex(centreOf(middle)).centre;
    expect(summit).toBeGreaterThan(Math.max(...grass) * 2);
  });

  it("keeps each terrain's heights within its band, at 70% of the old relief", () => {
    // NOTE: the old bands were grassland 4 to 48, stone 12 to 62 and
    // mountain 100 to 190; each base and rise is now 70% of that
    const bands = {
      grassland: { low: 2.8, high: 2.8 + 30.8 },
      stone: { low: 8.4, high: 8.4 + 35 },
      mountain: { low: 70, high: 70 + 63 },
    };
    const wide = [...Grid.rectangle({ width: 40, height: 40 })];
    const inner = wide.filter(hex => hex.x > 0 && hex.y > 0 && hex.x < 39 && hex.y < 39);
    for (const terrain in bands) {
      const { low, high } = bands[terrain];
      const heights = [];
      [3, 17, 4242].forEach(seed => {
        const field = createHeightField({ seed, terrainAt: () => terrain });
        inner.forEach(hex => cornersOf(hex).forEach(p => heights.push(field.cornerHeight(p.x, p.y))));
      });
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(low);
      expect(Math.max(...heights)).toBeLessThanOrEqual(high);
      // NOTE: and the noise still spreads them across most of the band
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan((high - low) * 0.6);
    }
  });

  it("treats anywhere off the map as sea", () => {
    const field = createHeightField({ seed: 11, terrainAt: grassland });
    expect(field.heightAt(-5000, -5000)).toEqual(SEA_LEVEL);
  });
});
