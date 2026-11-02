import { WorldGrid, WorldHex, ALL_SIDES } from "game/hex";
import { AXES, BIOMES, biomeOf, colder, tileTemperature, propagateFrom } from "game/overworld";

const SEEDS = [1, 1234, 98765, 4242424, 7777777, 31337, 2026];
const keyOf = hex => hex.x + "," + hex.y;
const step = (axis, value) => AXES[axis].indexOf(value);
const axisWorld = (seed, radius = 2) => ({
  radius, centre: { x: radius, y: radius },
  hexes: WorldGrid.hexagon({ center: WorldHex(radius, radius), radius }).map((h, i) => {
    const temperature = AXES.temperature[SEEDS.indexOf(seed) % 3], moisture = AXES.moisture[SEEDS.indexOf(seed) % 3];
    return { x: h.x, y: h.y, morality: AXES.morality[SEEDS.indexOf(seed) % 3], temperature, moisture,
      biome: biomeOf(temperature, moisture), ocean: i % 4 == 0, landFraction: i % 4 == 0 ? 0.2 : 0.8 };
  })
});
const neighboursIn = (world, hex) => WorldGrid.hexagon({ center: WorldHex(hex), radius: 1 })
  .neighborsOf(WorldHex(hex), ALL_SIDES).map(n => world.hexes.find(h => keyOf(h) == keyOf(n))).filter(Boolean);
const clashesIn = world => world.hexes.flatMap(h => neighboursIn(world, h).flatMap(n =>
  Object.keys(AXES).filter(axis => Math.abs(step(axis, h[axis]) - step(axis, n[axis])) > 1)
    .map(axis => ({ axis, a: keyOf(h), b: keyOf(n) }))));
const withValue = (world, key, axis, value) => ({
  ...world, hexes: world.hexes.map(h => keyOf(h) == key ? { ...h, [axis]: value } : h)
});

describe("the biomes", () => {
  it("names all nine from temperature and moisture", () => {
    const expected = {
      "hot,dry": "desert", "hot,normal": "savanna", "hot,wet": "jungle",
      "temperate,dry": "steppe", "temperate,normal": "grassland", "temperate,wet": "marsh",
      "cold,dry": "tundra", "cold,normal": "taiga", "cold,wet": "snowfield",
    };
    const seen = new Set();
    AXES.temperature.forEach(t => AXES.moisture.forEach(m => {
      expect(biomeOf(t, m)).toEqual(expected[t + "," + m]);
      seen.add(biomeOf(t, m));
    }));
    expect(seen.size).toEqual(9);
    expect(Object.keys(BIOMES).sort()).toEqual(Object.values(expected).sort());
  });

  it("has three steps on each axis", () => {
    expect(AXES.morality).toEqual(["good", "neutral", "evil"]);
    expect(AXES.temperature).toEqual(["hot", "temperate", "cold"]);
    expect(AXES.moisture).toEqual(["wet", "normal", "dry"]);
  });
});

describe("a change spreading out from one world hex", () => {
  // NOTE: a world all neutral, temperate and normal, except one good hex
  const calm = () => {
    const world = axisWorld(1);
    return { ...world, hexes: world.hexes.map(h => ({
      ...h, morality: "neutral", temperature: "temperate", moisture: "normal", biome: "grassland"
    })) };
  };

  it("pulls a good neighbour to neutral when a world hex turns evil", () => {
    const world = calm();
    const centre = world.hexes.find(h => h.x == world.centre.x && h.y == world.centre.y);
    const [ good ] = neighboursIn(world, centre);
    const before = withValue(world, keyOf(good), "morality", "good");
    const changed = withValue(before, keyOf(centre), "morality", "evil");
    expect(clashesIn(changed).length).toBeGreaterThan(0);

    const after = propagateFrom(changed, keyOf(centre), "morality");

    const find = (w, hex) => w.hexes.find(h => h.x == hex.x && h.y == hex.y);
    expect(find(after, centre).morality).toEqual("evil");
    expect(find(after, good).morality).toEqual("neutral");
    expect(clashesIn(after)).toEqual([]);
    // NOTE: nothing else moves, and the world it was given is left alone
    after.hexes.filter(h => keyOf(h) != keyOf(good))
      .forEach(h => expect(h).toEqual(find(changed, h)));
    expect(find(changed, good).morality).toEqual("good");
  });

  it("restores the one-step rule across the whole world, whichever hex changes on whichever axis", () => {
    SEEDS.slice(0, 3).forEach(seed => {
      const world = axisWorld(seed);
      for (const axis in AXES) {
        world.hexes.forEach((hex, i) => {
          // NOTE: push it to whichever extreme is further from where it was
          const value = step(axis, hex[axis]) < 1 ? 2 : (step(axis, hex[axis]) > 1 ? 0 : (i % 2) * 2);
          const changed = withValue(world, keyOf(hex), axis, AXES[axis][value]);
          const after = propagateFrom(changed, keyOf(hex), axis);
          expect(after.hexes.find(h => keyOf(h) == keyOf(hex))[axis]).toEqual(AXES[axis][value]);
          expect(clashesIn(after)).toEqual([]);
          after.hexes.forEach(h => expect(h.biome).toEqual(biomeOf(h.temperature, h.moisture)));
        });
      }
    });
  });

  it("propagates through oceans on the full world without changing their land classification", () => {
    const world = axisWorld(1234, 5);
    for (const axis in AXES) {
      const hex = world.hexes.find(h => h.ocean && h[axis] != AXES[axis][2]);
      const changed = withValue(world, keyOf(hex), axis, AXES[axis][2]);
      const after = propagateFrom(changed, keyOf(hex), axis);
      expect(clashesIn(after)).toEqual([]);
      expect(after.hexes.find(h => keyOf(h) == keyOf(hex))[axis]).toEqual(AXES[axis][2]);
      expect(after.hexes.map(h => [h.ocean, h.landFraction])).toEqual(world.hexes.map(h => [h.ocean, h.landFraction]));
    }
  });

  it("keeps each biome in step when temperature or moisture spreads", () => {
    const world = calm();
    const centre = world.hexes.find(h => h.x == world.centre.x && h.y == world.centre.y);
    const [ cold ] = neighboursIn(world, centre);
    const before = withValue(world, keyOf(cold), "temperature", "cold");
    const changed = withValue(before, keyOf(centre), "temperature", "hot");
    const after = propagateFrom(changed, keyOf(centre), "temperature");
    const pulled = after.hexes.find(h => keyOf(h) == keyOf(cold));
    expect(pulled.temperature).toEqual("temperate");
    expect(pulled.biome).toEqual("grassland");
  });
});

describe("high ground", () => {
  it("is one step colder than its world hex, down to a floor of cold", () => {
    expect(colder("hot")).toEqual("temperate");
    expect(colder("temperate")).toEqual("cold");
    expect(colder("cold")).toEqual("cold");

    expect(tileTemperature("hot", true)).toEqual("temperate");
    expect(tileTemperature("temperate", true)).toEqual("cold");
    expect(tileTemperature("cold", true)).toEqual("cold");
  });

  it("leaves low ground at its world hex's temperature", () => {
    AXES.temperature.forEach(t => expect(tileTemperature(t, false)).toEqual(t));
  });
});
