import SimplexNoise from "simplex-noise";
import { Hex, Grid, WorldHex, HEX_SIZE } from "game/hex";

export const MAP_RADIUS = 22;
export const MAP_CENTRE = Hex(MAP_RADIUS, MAP_RADIUS);
const centre = MAP_CENTRE.toPoint();
const tiles = [...Grid.spiral({ center: MAP_CENTRE, radius: MAP_RADIUS })];
const offsets = tiles.map(hex => {
  const p = hex.toPoint();
  return { x: p.x - centre.x, y: p.y - centre.y };
});
const origins = new Map();

// NOTE: The axial translations (45,-22) and (22,23) tile the plane with
// 1519-tile hexagons, including their stepped borders. Multiplying offset
// coordinates by the map width would leave gaps and shift alternate columns.
export function worldPoint(worldHex, localPoint) {
  const key = worldHex.x + "," + worldHex.y;
  if (!origins.has(key)) {
    const { q, r } = WorldHex(worldHex);
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
export function createLandField(seed, fixture) {
  const land = new SimplexNoise("land:" + seed);
  const relief = new SimplexNoise("terrain:" + seed);
  // NOTE: the two finer octaves are at map scale, so a coast wiggles across
  // a single map instead of running as a near-straight line. Keep their
  // wavelengths above a tile and their amplitudes low enough to avoid
  // isolated shore tiles. The same field is sampled on both sides of borders.
  const landAt = ({x, y}) => land.noise2D(x * 0.000045 + 17.3, y * 0.000045 - 9.1) +
    0.2 * land.noise2D(x * 0.0001 - 31.7, y * 0.0001 + 14.6) +
    0.06 * land.noise2D(x * 0.0007 + 5.9, y * 0.0007 - 22.4) +
    0.008 * land.noise2D(x * 0.0015 - 13.1, y * 0.0015 + 3.3);
  // Anisotropic zero contours form spines, rather than maxima forming cones.
  // Slow domain warping bends the belts. The envelope leaves whole plains
  // between uplands; the smaller contour only adds spurs on their shoulders.
  const angle = relief.noise2D(71.2, -39.4) * Math.PI;
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  const clamp = n => Math.max(0, Math.min(1, n));
  const elevationAt = p => {
    if (fixture?.kind == "mountain-pass") {
      const x=p.x-fixture.x, y=p.y-fixture.y;
      return 20+850*Math.exp(-((x/650)**2))*(1-.78*Math.exp(-(((y+420)/260)**2)));
    }
    const coast = clamp(landAt(p) / .16);
    if (!coast) return 14;
    const u = p.x * along.x + p.y * along.y;
    const v = -p.x * along.y + p.y * along.x;
    const bend = 2400 * relief.noise2D(u * .000035 + 28.1, v * .000045 - 11.7);
    const contour = Math.abs(relief.noise2D(u * .000012 + 8.2, (v + bend) * .00009 - 4.6));
    const envelope = clamp((relief.noise2D(p.x * .000025 - 2.8, p.y * .000025 + 12.4) + .55) * 1.3);
    const width = .42 + .14 * relief.noise2D(u * .00008 - 19.2, v * .00005 + 3.1);
    const shoulder = Math.max(0, 1 - contour / (width * 1.8));
    const spine = Math.max(0, 1 - (contour / width) ** 2) ** 2;
    const spur = Math.max(0, 1 - Math.abs(relief.noise2D(u * .00018 + v * .00009, v * .00032 - 18.2)) / .45);
    const summits = .76 + .24 * relief.noise2D(u * .0004 + 7.4, v * .00008);
    const hills = Math.max(0, relief.noise2D(p.x * .00009 + 8.2, p.y * .00009 - 4.6) + .25);
    // The max joins secondary ridges into a main shoulder without making a
    // grid. Detail is proportional to relief and cannot seed isolated peaks.
    const range = Math.max(spine * summits, .8 * spur * shoulder);
    return 14 + coast * (300 * hills + envelope * (300 * shoulder * shoulder + 1150 * range));
  };
  return {
    landAt, elevationAt,
    terrainAt(p) {
      const sea = landAt(p);
      if (sea < -0.07) { return "deep water"; }
      if (sea < 0) { return "shallow water"; }
      const x = p.x / (HEX_SIZE * 1.5);
      const y = p.y / Hex().height();
      const height = 0.5 + relief.noise2D(x * 0.025, y * 0.025) * 0.65 +
        Math.max(0, relief.noise2D(x * 0.1, y * 0.1) * 1.6);
      const altitude = elevationAt(p);
      const grade = Math.hypot(elevationAt({x:p.x+30,y:p.y})-elevationAt({x:p.x-30,y:p.y}),
        elevationAt({x:p.x,y:p.y+30})-elevationAt({x:p.x,y:p.y-30})) / 60;
      if (grade > .65) { return "mountain"; }
      if (altitude > 780) { return "stone"; }
      // NOTE: relief makes inland lakes; near sea level the coast field alone
      // decides water, so little relief pits do not pepper the beach.
      if (height < 0 && sea > 0.15 && altitude < 120) { return "shallow water"; }
      if (relief.noise2D(x * 0.5, y * 0.5) > 0.85) { return "stone"; }
      return "grassland";
    }
  };
}

const startPatches = tiles.filter(h => MAP_CENTRE.distance(h) == MAP_RADIUS - 2).map(hex => ({
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
  const clear = startPatches.filter(p => p.keys.every(k => terrain.get(k) == "grassland"));
  // A second clearing leaves room for a nearby village, joined by walkable land.
  const patch = clear.find(p => clear.some(v => p.hex.distance(v.hex) >= 3 && p.hex.distance(v.hex) <= 4));
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
    // NOTE: The spiral visits rings outwards, so the first suitable hex is
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
