import { createLandField, worldPoint, MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { Grid, Hex, WorldGrid, WorldHex, ALL_SIDES } from "game/hex";
import {
  AXES, BIOMES, biomeOf, generateWorld, homeOf,
  WORLD_RADIUS
} from "game/overworld";

const SEEDS = [1, 1234, 98765, 4242424, 7777777, 31337, 2026];

const step = (axis, value) => AXES[axis].indexOf(value);

const keyOf = hex => hex.x + "," + hex.y;
const geometry = new Map();
const indices = new WeakMap();
const neighboursIn = (world, hex) => {
  const key = keyOf(hex);
  if (!geometry.has(key)) {
    geometry.set(key, WorldGrid.hexagon({ center: WorldHex(hex), radius: 1 })
      .neighborsOf(WorldHex(hex), ALL_SIDES).map(keyOf));
  }
  if (!indices.has(world)) {
    indices.set(world, new Map(world.hexes.map(h => [keyOf(h), h])));
  }
  return geometry.get(key).map(k => indices.get(world).get(k)).filter(h => h);
};

const clashesIn = world => world.hexes.flatMap(h => neighboursIn(world, h).flatMap(n =>
  Object.keys(AXES).filter(axis => Math.abs(step(axis, h[axis]) - step(axis, n[axis])) > 1)
    .map(axis => ({ axis, a: keyOf(h), b: keyOf(n) }))));

const worlds = new Map();
const smallWorlds = new Map();
const smallWorldFor = seed => {
  if (!smallWorlds.has(seed)) { smallWorlds.set(seed, generateWorld(seed, { radius: 2 })); }
  return smallWorlds.get(seed);
};
const worldFor = seed => {
  if (!worlds.has(seed)) { worlds.set(seed, generateWorld(seed)); }
  return worlds.get(seed);
};

// NOTE: Include complete worlds and oceans; measuring a walk's parent alone
// misses the borders that make a map look speckled. Cache the surveys.
const regionalWorlds = () => Array.from({ length: 100 }, (_, i) => worldFor(i + 1));

describe("regions across many seeds", () => {
  it("keeps about two thirds of all neighbours the same on each independent seeded axis", () => {
    for (const axis of ["temperature", "morality"]) {
      let same = 0;
      let pairs = 0;
      for (const world of regionalWorlds()) {
        for (const h of world.hexes) {
          for (const n of neighboursIn(world, h)) {
            pairs++;
            same += h[axis] == n[axis] ? 1 : 0;
          }
        }
      }
      expect(Math.abs(same / pairs - 2 / 3)).toBeLessThan(0.06);
    }
  });

  it("gives each of the three values about a third of the world on each independent seeded axis", () => {
    for (const axis of ["temperature", "morality"]) {
      const counts = [0, 0, 0];
      for (const world of regionalWorlds()) {
        world.hexes.forEach(h => { counts[step(axis, h[axis])]++; });
      }
      const total = counts.reduce((a, b) => a + b, 0);
      counts.forEach(count => expect(Math.abs(count / total - 1 / 3)).toBeLessThan(0.055));
    }
  });

  it("joins oceans into seas and land into continents instead of isolated specks", () => {
    const counts = { ocean: 0, land: 0, seaInterior: 0, isolatedSea: 0, isolatedLand: 0 };
    for (const world of regionalWorlds()) {
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
      expect(clashesIn(world)).toEqual([]);
    }
    // NOTE: 90% allows coastline tips and the world's clipped edges, but
    // requires almost every sea hex to belong to more than a pair. Singles
    // should be under 1% on either side. Also reject all-land/all-sea worlds.
    expect(counts.seaInterior / counts.ocean).toBeGreaterThan(0.9);
    expect(counts.isolatedSea / counts.ocean).toBeLessThan(0.01);
    expect(counts.isolatedLand / counts.land).toBeLessThan(0.01);
    expect(counts.ocean / (counts.ocean + counts.land)).toBeGreaterThan(0.3);
    expect(counts.ocean / (counts.ocean + counts.land)).toBeLessThan(0.7);
  });
});

describe("the world of world hexes", () => {
  it("is a hexagon of 91 world hexes, radius 5", () => {
    const world = worldFor(1234);
    expect(WORLD_RADIUS).toEqual(5);
    expect(world.radius).toEqual(5);
    expect(world.hexes.length).toEqual(91);
    const centre = WorldHex(world.centre.x, world.centre.y);
    world.hexes.forEach(h => expect(centre.distance(WorldHex(h.x, h.y))).toBeLessThanOrEqual(5));
  });

  it("gives every world hex a value on each axis, and the biome they make", () => {
    const world = worldFor(98765);
    world.hexes.forEach(h => {
      expect(AXES.morality).toContain(h.morality);
      expect(AXES.temperature).toContain(h.temperature);
      expect(AXES.moisture).toContain(h.moisture);
      expect(h.biome).toEqual(biomeOf(h.temperature, h.moisture));
    });
  });

  it("makes the same world from the same seed, and a different one from another", () => {
    const originals = SEEDS.map(worldFor);
    SEEDS.forEach((seed, i) => expect(generateWorld(seed)).toEqual(originals[i]));
    const worlds = originals.map(world => JSON.stringify(world.hexes));
    expect(new Set(worlds).size).toEqual(SEEDS.length);
  });

  it("never lets neighbouring world hexes differ by more than one step on any axis", () => {
    const clashes = [];
    let pairs = 0;
    SEEDS.forEach(seed => {
      const world = worldFor(seed);
      world.hexes.forEach(h => neighboursIn(world, h).forEach(n => {
        pairs++;
        for (const axis in AXES) {
          if (Math.abs(step(axis, h[axis]) - step(axis, n[axis])) > 1) {
            clashes.push({ seed, axis, a: [h.x, h.y, h[axis]], b: [n.x, n.y, n[axis]] });
          }
        }
      }));
    });
    // NOTE: 91 hexes have 240 neighbouring pairs, each seen from both sides
    expect(pairs).toEqual(SEEDS.length * 480);
    expect(clashes).toEqual([]);
  });

  it("has colder north and south polar rows than equatorial rows", () => {
    const bands = { north: [], equator: [], south: [] };
    for (let seed = 1; seed <= 40; seed++) {
      const world = worldFor(seed);
      const cy = WorldHex(world.centre).toPoint().y;
      for (const h of world.hexes) {
        const latitude = (WorldHex(h).toPoint().y - cy) / (WorldHex().height() * world.radius);
        const band = latitude <= -0.7 ? "north" : latitude >= 0.7 ? "south" : Math.abs(latitude) <= 0.2 ? "equator" : null;
        if (band) { bands[band].push(step("temperature", h.temperature)); }
      }
    }
    const mean = band => bands[band].reduce((a, b) => a + b, 0) / bands[band].length;
    expect(mean("north")).toBeGreaterThan(mean("equator") + 0.25);
    expect(mean("south")).toBeGreaterThan(mean("equator") + 0.25);
  });

  it("chooses the nearest mostly-land hex with a farmable start, even when the centre is ocean", () => {
    let oceanCentres = 0;
    for (const seed of SEEDS) {
      const world = worldFor(seed);
      const centre = WorldHex(world.centre);
      const home = homeOf(world);
      expect(home.landFraction).toBeGreaterThanOrEqual(0.65);
      expect(home.start).toBeDefined();
      expect(home.ocean).toBe(false);
      const closer = world.hexes.filter(h => centre.distance(WorldHex(h)) < centre.distance(WorldHex(home)));
      const field = createLandField(world.landSeed);
      const tiles = [...Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS })];
      for (const h of closer.filter(h => h.landFraction >= 0.65)) {
        const terrain = new Map(tiles.map(tile => [keyOf(tile), field.terrainAt(worldPoint(h, tile.toPoint()))]));
        if ([...terrain.values()].filter(t => !t.includes("water")).length / tiles.length < 0.6) { continue; }
        const patches = tiles.filter(tile => MAP_CENTRE.distance(tile) <= MAP_RADIUS - 2);
        expect(patches.some(tile => [...Grid.hexagon({ center: tile, radius: 2 })]
          .every(n => terrain.get(keyOf(n)) == "grassland"))).toBe(false);
      }
      if (world.hexes.find(h => keyOf(h) == keyOf(centre)).ocean) { oceanCentres++; }
    }
    expect(oceanCentres).toBeGreaterThan(0);
  });

  it("classifies ocean hexes from their actual tile samples and carries axes through them", () => {
    let oceans = 0;
    for (const seed of SEEDS.slice(0, 3)) {
      const world = worldFor(seed);
      const field = createLandField(world.landSeed);
      const points = [...Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS })].map(h => h.toPoint());
      for (const h of world.hexes) {
        const land = points.filter(p => field.landAt(worldPoint(h, p)) >= 0).length / points.length;
        expect(h.landFraction).toEqual(land);
        expect(h.ocean).toEqual(land < 0.5);
        if (h.ocean) { oceans++; }
      }
      expect(clashesIn(world)).toEqual([]);
    }
    expect(oceans).toBeGreaterThan(20);
  });

  it("keeps the chosen map mostly dry with two farmable rings across many seeds", () => {
    const tiles = [...Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS })];
    for (let seed = 1; seed <= 120; seed++) {
      const world = smallWorldFor(seed);
      const home = homeOf(world);
      const field = createLandField(world.landSeed);
      const dry = tiles.filter(h => !field.terrainAt(worldPoint(home, h.toPoint())).includes("water"));
      expect(dry.length / tiles.length).toBeGreaterThanOrEqual(0.6);
      const start = Hex(home.start);
      expect(MAP_CENTRE.distance(start)).toBeLessThanOrEqual(MAP_RADIUS - 2);
      Grid.hexagon({ center: start, radius: 2 }).forEach(h =>
        expect(field.terrainAt(worldPoint(home, h.toPoint()))).toEqual("grassland"));
    }
  });

  it("lands the playable world hex on every biome and every morality across seeds", () => {
    const biomes = new Set();
    const moralities = new Set();
    for (let seed = 1; seed <= 120; seed++) {
      const home = homeOf(smallWorldFor(seed));
      biomes.add(home.biome);
      moralities.add(home.morality);
    }
    expect([...biomes].sort()).toEqual(Object.keys(BIOMES).sort());
    expect([...moralities].sort()).toEqual([...AXES.morality].sort());
  });
});
