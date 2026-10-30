import SimplexNoise from "simplex-noise";

import { Hex, HEX_SIZE } from "game/hex";

// Shared triangulated ground for rendering, picking, navigation and grounding.
// Generated maps supply geography corner elevations; legacy fixtures use bands.
//
// Heights live on hex corners, the points where up to three hexes meet. A
// corner's height comes from simplex noise at its position (seeded from the
// world seed) blended with the terrain of the hexes that touch it, so
// neighbouring hexes always agree at the corners they share. A hex centre is
// the mean of its six corners, and in between the surface is the flat fan of
// six triangles from the centre to the corners.

export const SEA_LEVEL = 0;

// Altitude band for alpine vegetation; navigation uses the local slope.
export const HIGH_GROUND = 260;

// NOTE: Each terrain's height starts at its base and rises by up to its
// rise with the noise. These are 70% of the first bands, which made the
// relief too extreme.
const TERRAIN = {
  "grassland": { base: 2.8, rise: 30.8 },
  "stone": { base: 8.4, rise: 35 },
  "mountain": { base: 70, rise: 63 },
};
const WATER = ["shallow water", "deep water"];

const CORNER_STEP_X = HEX_SIZE / 2;
const CORNER_STEP_Y = HEX_SIZE * Math.sqrt(3) / 2;
const SECTOR = Math.PI / 3;
const OFFSETS = Hex().corners().map(c => ({ x: c.x, y: c.y }));

const hexKey = (x, y) => Hex().fromPoint(x, y).toString();
const cornerHexes = new Map();

// NOTE: The hexes meeting at a corner: stepping half a hex out from the
// corner in each of six directions lands in (or between) exactly those.
function hexesAround(x, y) {
  const key = Math.round(x / CORNER_STEP_X) + "," + Math.round(y / CORNER_STEP_Y);
  if (cornerHexes.has(key)) {
    return cornerHexes.get(key);
  }
  const keys = new Set();
  for (let k = 0; k < 6; k++) {
    keys.add(hexKey(x + Math.cos(k * SECTOR) * HEX_SIZE * 0.5, y + Math.sin(k * SECTOR) * HEX_SIZE * 0.5));
  }
  const result = [...keys];
  cornerHexes.set(key, result);
  return result;
}

export function createHeightField({ seed, terrainAt, elevationAt, cornerAt }) {
  const simplex = new SimplexNoise("height:" + seed);
  const corners = new Map();
  const hexes = new Map();

  // NOTE: Snap to the lattice all hex corners sit on, so a corner reached
  // from any of its hexes is the same corner, whatever the rounding.
  const cornerHeight = (x, y) => {
    const i = Math.round(x / CORNER_STEP_X);
    const j = Math.round(y / CORNER_STEP_Y);
    const key = i + "," + j;
    if (!corners.has(key)) {
      const cx = i * CORNER_STEP_X;
      const cy = j * CORNER_STEP_Y;
      const terrains = hexesAround(cx, cy).map(terrainAt);
      let height = cornerAt?.(cx, cy);
      if (height == null) {
        height = SEA_LEVEL;
        if (!terrains.some(t => !t || WATER.includes(t))) {
          const shape = terrains.map(t => TERRAIN[t] || TERRAIN.grassland);
          const base = shape.reduce((sum, s) => sum + s.base, 0) / shape.length;
          const rise = shape.reduce((sum, s) => sum + s.rise, 0) / shape.length;
          const noise = 0.6 * simplex.noise2D(cx * 0.0035, cy * 0.0035) +
            0.4 * simplex.noise2D(cx * 0.012, cy * 0.012);
          height = elevationAt ? elevationAt(cx, cy) : SEA_LEVEL + base + rise * (noise * 0.5 + 0.5);
        }
      }
      corners.set(key, height);
    }
    return corners.get(key);
  };

  const hex = centre => {
    const key = centre.x.toFixed(3) + "," + centre.y.toFixed(3);
    if (!hexes.has(key)) {
      const heights = OFFSETS.map(o => cornerHeight(centre.x + o.x, centre.y + o.y));
      hexes.set(key, {
        centre: heights.reduce((sum, h) => sum + h, 0) / 6,
        corners: heights
      });
    }
    return hexes.get(key);
  };

  // NOTE: Which fan triangle (x, y) is on, and its position in it: the
  // triangle runs from the hex centre to corners k and k + 1.
  const triangle = (x, y) => {
    const centre = Hex().fromPoint(x, y).toPoint();
    const dx = x - centre.x;
    const dy = y - centre.y;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) {
      angle += Math.PI * 2;
    }
    const k = Math.floor(angle / SECTOR) % 6;
    const p = OFFSETS[k];
    const q = OFFSETS[(k + 1) % 6];
    const det = p.x * q.y - p.y * q.x;
    const { centre: h, corners: hs } = hex(centre);
    return {
      a: (dx * q.y - dy * q.x) / det,
      b: (p.x * dy - p.y * dx) / det,
      h,
      hp: hs[k] - h,
      hq: hs[(k + 1) % 6] - h,
      p, q, det
    };
  };

  return {
    cornerHeight,
    hex,
    heightAt(x, y) {
      const { a, b, h, hp, hq } = triangle(x, y);
      return h + a * hp + b * hq;
    },
    // NOTE: change in height per unit of x and of y on that triangle
    slopeAt(x, y) {
      const { hp, hq, p, q, det } = triangle(x, y);
      return {
        dx: (hp * q.y - hq * p.y) / det,
        dy: (hq * p.x - hp * q.x) / det
      };
    }
  };
}
