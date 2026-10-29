import SimplexNoise from "simplex-noise";
import { Hex, Grid, HEX_SIZE } from "game/hex";

export const MAP_RADIUS = 11;
export const MAP_CENTRE = Hex(MAP_RADIUS, MAP_RADIUS);
const centre = MAP_CENTRE.toPoint();
const tiles = [...Grid.spiral({ center: MAP_CENTRE, radius: MAP_RADIUS })];
const offsets = tiles.map(hex => {
  const p = hex.toPoint();
  return { x: p.x - centre.x, y: p.y - centre.y };
});
const origins = new Map();

// NOTE: The axial translations (23,-11) and (11,12) tile the plane with
// 397-tile hexagons, including their stepped borders. Multiplying offset
// coordinates by the map width would leave gaps and shift alternate columns.
export function worldPoint(worldHex, localPoint) {
  const key = worldHex.x + "," + worldHex.y;
  if (!origins.has(key)) {
    const { q, r } = Hex(worldHex);
    const a = (2 * MAP_RADIUS + 1) * q + MAP_RADIUS * r;
    const b = -MAP_RADIUS * q + (MAP_RADIUS + 1) * r;
    origins.set(key, { x: HEX_SIZE * 1.5 * a, y: Hex().height() * (b + a / 2) });
  }
  const o = origins.get(key);
  return { x: o.x + localPoint.x - centre.x, y: o.y + localPoint.y - centre.y };
}

// NOTE: A single field in world coordinates, with continents a few world
// hexes across. The extra octave roughens coasts; neither map edges nor
// biome values enter it. Inland relief can still make lakes and mountains.
export function createLandField(seed) {
  const land = new SimplexNoise("land:" + seed);
  const relief = new SimplexNoise("terrain:" + seed);
  const landAt = ({x, y}) => land.noise2D(x * 0.00023 + 17.3, y * 0.00023 - 9.1) +
    0.2 * land.noise2D(x * 0.00075 - 31.7, y * 0.00075 + 14.6);
  return {
    landAt,
    terrainAt(p) {
      const sea = landAt(p);
      if (sea < -0.07) { return "deep water"; }
      if (sea < 0) { return "shallow water"; }
      const x = p.x / (HEX_SIZE * 1.5);
      const y = p.y / Hex().height();
      const height = 0.5 + relief.noise2D(x * 0.025, y * 0.025) * 0.65 +
        Math.max(0, relief.noise2D(x * 0.1, y * 0.1) * 1.6);
      if (height > 1.4) { return "mountain"; }
      if (height < 0) { return "shallow water"; }
      if (relief.noise2D(x * 0.5, y * 0.5) > 0.85) { return "stone"; }
      return "grassland";
    }
  };
}

const startPatches = tiles.filter(h => MAP_CENTRE.distance(h) <= MAP_RADIUS - 2).map(hex => ({
  hex,
  keys: [...Grid.hexagon({ center: hex, radius: 2 })].map(h => h.toString())
}));

// NOTE: Survey only geometry and terrain, without ECS, height meshes, trees
// or settlements. This is also the map's start, with two grassland rings:
// room to farm and reachable spots for the existing minimum-tree planting.
function startIn(field, home) {
  const terrain = new Map(tiles.map(hex => [hex.toString(), field.terrainAt(worldPoint(home, hex.toPoint()))]));
  if ([...terrain.values()].filter(t => !t.includes("water")).length / tiles.length < 0.6) {
    return;
  }
  const patch = startPatches.find(p => p.keys.every(k => terrain.get(k) == "grassland"));
  return patch && { x: patch.hex.x, y: patch.hex.y };
}

export function surveyWorld(hexes, seed) {
  // NOTE: Reject an unusable field rather than editing a local coastline.
  // Retry deterministically until the field contains a mostly-land start;
  // there is no attempt cap that could let an unplayable seed escape.
  for (let attempt = 0; ; attempt++) {
    const landSeed = seed + ":" + attempt;
    const field = createLandField(landSeed);
    const surveyed = hexes.map(h => {
      const o = worldPoint(h, centre);
      const count = offsets.filter(p => field.landAt({ x: o.x + p.x, y: o.y + p.y }) >= 0).length;
      const landFraction = count / tiles.length;
      return { ...h, landFraction, ocean: landFraction < 0.5 };
    });
    // NOTE: The walk visits rings outwards, so the first suitable hex is
    // nearest the centre. Ring order breaks ties deterministically.
    for (const h of surveyed) {
      if (h.landFraction < 0.65) { continue; }
      const start = startIn(field, h);
      if (start) {
        h.start = start;
        return { hexes: surveyed, landSeed, home: { x: h.x, y: h.y } };
      }
    }
  }
}
