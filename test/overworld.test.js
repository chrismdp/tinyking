import { createLandField, findHome, surveyWorld, worldPoint, MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { villageStart } from "game/geography";
import { Grid, Hex, WorldGrid, WorldHex, ALL_SIDES } from "game/hex";
import {
  AXES, BIOMES, biomeOf, generateRegions, repairRegions, homeOf, WORLD_RADIUS
} from "game/overworld";

const SEEDS = [1, 13, 1234];
const step = (axis, value) => AXES[axis].indexOf(value);
const keyOf = hex => hex.x + "," + hex.y;
const neighboursIn = (world, hex) => WorldGrid.hexagon({ center: WorldHex(hex), radius: 1 })
  .neighborsOf(WorldHex(hex), ALL_SIDES).map(n => world.hexes.find(h => keyOf(h) == keyOf(n))).filter(Boolean);
const clashesIn = world => world.hexes.flatMap(h => neighboursIn(world, h).flatMap(n =>
  Object.keys(AXES).filter(axis => Math.abs(step(axis, h[axis]) - step(axis, n[axis])) > 1)
    .map(axis => ({ axis, a: keyOf(h), b: keyOf(n) }))));
const regionsFor = seed => {
  const regions = generateRegions(seed);
  regions.hexes.forEach(h => { h.moisture = "normal"; });
  repairRegions(regions.hexes);
  return regions;
};
// Only seeded regional labels run here. No map, climate or history is generated.
const regions = Array.from({ length: 16 }, (_, i) => regionsFor(i + 1));
const flatField = { terrainAt: () => "grassland", elevationAt: () => 20 };
const localTiles = [...Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS })];

describe("seeded regional fields", () => {
  it("keeps about two thirds of neighbours the same on each independent seeded axis", () => {
    for (const axis of ["temperature", "morality"]) {
      let same = 0, pairs = 0;
      for (const world of regions) for (const h of world.hexes) for (const n of neighboursIn(world, h)) {
        pairs++;
        same += h[axis] == n[axis] ? 1 : 0;
      }
      // Sixteen independent seeds replace 100. Each seed contains correlated
      // regions, so retain a broad distribution check rather than a tight census.
      expect(Math.abs(same / pairs - 2 / 3)).toBeLessThan(0.10);
    }
  });

  it("gives each of the three values about a third of the regions on each seeded axis", () => {
    for (const axis of ["temperature", "morality"]) {
      const counts = [0, 0, 0];
      for (const world of regions) world.hexes.forEach(h => { counts[step(axis, h[axis])]++; });
      const total = counts.reduce((a, b) => a + b, 0);
      counts.forEach(count => expect(Math.abs(count / total - 1 / 3)).toBeLessThan(0.12));
    }
  });

  it("joins physical seas and continents instead of isolated specks", () => {
    const counts = { ocean: 0, land: 0, seaInterior: 0, isolatedSea: 0, isolatedLand: 0 };
    for (const seed of SEEDS) {
      const field = createLandField(seed + ":0");
      // One physical point per region tests continent scale directly, without
      // surveying 1519 tiles in every region or selecting a complete world.
      const regions = regionsFor(seed);
      const world = { ...regions, hexes: regions.hexes.map(h => ({ ...h,
        ocean: field.landAt(worldPoint(h, MAP_CENTRE.toPoint())) < 0 })) };
      for (const h of world.hexes) {
        const alike = neighboursIn(world, h).filter(n => n.ocean == h.ocean).length;
        if (h.ocean) {
          counts.ocean++;
          counts.seaInterior += alike >= 2 ? 1 : 0;
          counts.isolatedSea += alike == 0 ? 1 : 0;
        } else {
          counts.land++;
          counts.isolatedLand += alike == 0 ? 1 : 0;
        }
      }
    }
    expect(counts.seaInterior / counts.ocean).toBeGreaterThan(0.9);
    expect(counts.isolatedSea / counts.ocean).toBeLessThan(0.01);
    expect(counts.isolatedLand / counts.land).toBeLessThan(0.01);
    expect(counts.ocean / (counts.ocean + counts.land)).toBeGreaterThan(0.3);
    expect(counts.ocean / (counts.ocean + counts.land)).toBeLessThan(0.7);
  });

  it("lays out 91 regional labels in a hexagon of radius 5", () => {
    const world = regionsFor(1234);
    expect(WORLD_RADIUS).toEqual(5);
    expect(world.radius).toEqual(5);
    expect(world.hexes).toHaveLength(91);
    const centre = WorldHex(world.centre);
    world.hexes.forEach(h => expect(centre.distance(WorldHex(h))).toBeLessThanOrEqual(5));
  });

  it("keeps each regional biome in step with its axes", () => {
    regionsFor(13).hexes.forEach(h => {
      for (const axis in AXES) expect(AXES[axis]).toContain(h[axis]);
      expect(h.biome).toEqual(biomeOf(h.temperature, h.moisture));
    });
  });

  it("replays regional labels from their seed independently of request order", () => {
    const originals = SEEDS.map(regionsFor);
    [...SEEDS].reverse().forEach(seed => expect(regionsFor(seed)).toEqual(originals[SEEDS.indexOf(seed)]));
    expect(new Set(originals.map(world => JSON.stringify(world.hexes))).size).toBe(SEEDS.length);
  });

  it("repairs all three axes across regional neighbours including oceans", () => {
    const world = regionsFor(13);
    // Extreme moisture neighbours exercise repair of the climate-supplied axis.
    world.hexes.forEach((h, i) => { h.moisture = AXES.moisture[i % 3]; h.ocean = i % 2 == 0; });
    const land = world.hexes.map(h => h.ocean);
    expect(clashesIn(world).length).toBeGreaterThan(0);
    repairRegions(world.hexes);
    expect(world.hexes.map(h => h.ocean)).toEqual(land);
    expect(world.hexes.reduce((n, h) => n + neighboursIn(world, h).length, 0)).toBe(480);
    expect(clashesIn(world)).toEqual([]);
  });

  it("has colder north and south polar rows than equatorial rows", () => {
    const bands = { north: [], equator: [], south: [] };
    for (const world of regions) {
      const cy = WorldHex(world.centre).toPoint().y;
      for (const h of world.hexes) {
        const latitude = (WorldHex(h).toPoint().y - cy) / (WorldHex().height() * world.radius);
        const band = latitude <= -0.7 ? "north" : latitude >= 0.7 ? "south" : Math.abs(latitude) <= 0.2 ? "equator" : null;
        if (band) bands[band].push(step("temperature", h.temperature));
      }
    }
    const mean = band => bands[band].reduce((a, b) => a + b, 0) / bands[band].length;
    expect(mean("north")).toBeGreaterThan(mean("equator") + 0.25);
    expect(mean("south")).toBeGreaterThan(mean("equator") + 0.25);
  });
});

describe("physical home selection", () => {
  it("skips ocean and unsuitable nearer candidates before accepting the nearest farmable home", () => {
    const candidates = [
      { x: 0, y: 0, ocean: true, landFraction: .2 },
      { x: 1, y: 0, ocean: false, landFraction: .64 },
      { x: 2, y: 0, ocean: false, landFraction: .65 },
      { x: 3, y: 0, ocean: false, landFraction: .9 }
    ];
    const home = findHome(candidates, flatField, villageStart);
    expect(home).toBe(candidates[2]);
    expect(home.landFraction).toBeGreaterThanOrEqual(.65);
    expect(home.ocean).toBe(false);
    expect(home.start).toBeDefined();
    expect(homeOf({ home, hexes: candidates })).toBe(home);
    expect(candidates[3].start).toBeUndefined();
    expect(findHome([{ ...candidates[2], start: undefined }], flatField, () => false)).toBeUndefined();
  });

  it("classifies seven surveyed regions from their actual land samples and retains their axes", () => {
    const records = WorldGrid.spiral({ center: WorldHex(5, 5), radius: 1 }).map(h => ({ ...h,
      temperature: "temperate", moisture: "normal", morality: "neutral" }));
    const surveyed = surveyWorld(records, 13, villageStart);
    const field = createLandField(surveyed.landSeed);
    expect(surveyed.hexes).toHaveLength(7);
    for (const [i, h] of surveyed.hexes.entries()) {
      const land = localTiles.filter(tile => field.landAt(worldPoint(h, tile.toPoint())) >= 0).length / localTiles.length;
      expect(h).toMatchObject(records[i]);
      expect(h.landFraction).toBe(land);
      expect(h.ocean).toBe(land < .5);
    }
    expect(surveyed.hexes.some(h => h.ocean)).toBe(true);
    expect(surveyed.hexes.some(h => !h.ocean)).toBe(true);
  });

  it("requires 60 percent dry land and two grassland rings at the chosen boundary start", () => {
    const home = findHome([{ x: 0, y: 0, ocean: false, landFraction: 1 }], flatField, villageStart);
    const start = Hex(home.start);
    expect(MAP_CENTRE.distance(start)).toBe(MAP_RADIUS - 2);
    Grid.hexagon({ center: start, radius: 2 }).forEach(h =>
      expect(flatField.terrainAt(worldPoint(home, h.toPoint()))).toBe("grassland"));
    // Local coordinates coincide with world coordinates for home (0,0).
    const dryKeys = new Set(localTiles.slice(0, Math.floor(localTiles.length * .59))
      .map(h => keyOf(Hex().fromPoint(worldPoint(home, h.toPoint())))));
    const wetField = { ...flatField, terrainAt: p => dryKeys.has(keyOf(Hex().fromPoint(p))) ? "grassland" : "deep water" };
    expect(findHome([{ x: 0, y: 0, ocean: false, landFraction: 1 }], wetField, villageStart)).toBeUndefined();
    localTiles.slice(dryKeys.size, Math.ceil(localTiles.length * .6)).forEach(h =>
      dryKeys.add(keyOf(Hex().fromPoint(worldPoint(home, h.toPoint())))));
    expect(findHome([{ x: 0, y: 0, ocean: false, landFraction: 1 }], wetField, villageStart)).toBeDefined();
    const stonyField = { ...flatField, terrainAt: () => "stone" };
    expect(findHome([{ x: 0, y: 0, ocean: false, landFraction: 1 }], stonyField, villageStart)).toBeUndefined();
  });

  it("accepts a farmable home of every declared biome and morality", () => {
    for (const [i, [biome, climate]] of Object.entries(BIOMES).entries()) {
      const morality = AXES.morality[i % AXES.morality.length];
      const chosen = findHome([{ x: 0, y: 0, ...climate, biome, morality, ocean: false, landFraction: 1 }], flatField, villageStart);
      expect(chosen).toMatchObject({ biome, morality, ...climate, ocean: false });
      expect(chosen.landFraction).toBeGreaterThanOrEqual(.65);
      expect(chosen.start).toBeDefined();
    }
  });
});
