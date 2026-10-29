import { Grid, Hex, ALL_SIDES } from "game/hex";
import {
  AXES, BIOMES, biomeOf, colder, tileTemperature, generateWorld, homeOf, repairClashes, WORLD_RADIUS
} from "game/overworld";

const SEEDS = [1, 1234, 98765, 4242424, 7777777, 31337, 2026];

const step = (axis, value) => AXES[axis].indexOf(value);

const neighboursIn = (world, hex) => {
  const grid = Grid.hexagon({ center: Hex(hex.x, hex.y), radius: 1 });
  return grid.neighborsOf(Hex(hex.x, hex.y), ALL_SIDES)
    .map(n => world.hexes.find(h => h.x == n.x && h.y == n.y))
    .filter(h => h);
};

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

describe("repairing clashes", () => {
  // NOTE: cells in a row, each next to the one either side
  const row = n => Array.from({ length: n }, (_, i) => [i - 1, i + 1].filter(j => j >= 0 && j < n));

  it("moves the less certain of two clashing extremes to the middle step", () => {
    expect(repairClashes([0, 2], row(2), [0.1, 0.5])).toEqual([1, 2]);
    expect(repairClashes([0, 2], row(2), [0.5, 0.1])).toEqual([0, 1]);
  });

  it("leaves cells that do not clash alone", () => {
    expect(repairClashes([0, 1, 2, 1, 0], row(5), [1, 1, 1, 1, 1])).toEqual([0, 1, 2, 1, 0]);
    expect(repairClashes([0, 0, 2, 2], row(4), [0.9, 0.3, 0.8, 0.9])).toEqual([0, 1, 2, 2]);
    expect(repairClashes([0, 0, 2, 2], row(4), [0.9, 0.8, 0.3, 0.9])).toEqual([0, 0, 1, 2]);
  });

  it("is the same every time, with ties broken by position", () => {
    // NOTE: the first 2 gives way to the 0, which then still clashes with
    // the last 2, so gives way itself
    expect(repairClashes([2, 0, 2], row(3), [0.3, 0.3, 0.3])).toEqual([1, 1, 2]);
    expect(repairClashes([2, 0, 2], row(3), [0.3, 0.3, 0.3])).toEqual([1, 1, 2]);
  });

  it("leaves no clash anywhere, whatever it starts from", () => {
    const grid = [...Grid.hexagon({ center: Hex(5, 5), radius: 5 })];
    const index = new Map(grid.map((h, i) => [h.toString(), i]));
    const neighbours = grid.map(h => Grid.hexagon({ center: h, radius: 1 }).neighborsOf(h, ALL_SIDES)
      .map(n => index.get(n.toString())).filter(i => i != null));
    for (let trial = 0; trial < 20; trial++) {
      const steps = grid.map((h, i) => (i * 7 + trial * 13 + h.x * h.y) % 3);
      const confidence = grid.map((h, i) => ((i * 31 + trial) % 17) / 17);
      const repaired = repairClashes(steps, neighbours, confidence);
      repaired.forEach((s, i) => {
        // NOTE: only extremes ever move, and only to the middle
        expect(s == steps[i] || s == 1).toBe(true);
        neighbours[i].forEach(j => expect(Math.abs(s - repaired[j])).toBeLessThanOrEqual(1));
      });
    }
  });
});

describe("the world of world hexes", () => {
  it("is a hexagon of 37 world hexes, radius 3", () => {
    const world = generateWorld(1234);
    expect(WORLD_RADIUS).toEqual(3);
    expect(world.radius).toEqual(3);
    expect(world.hexes.length).toEqual(37);
    const centre = Hex(world.centre.x, world.centre.y);
    world.hexes.forEach(h => expect(centre.distance(Hex(h.x, h.y))).toBeLessThanOrEqual(3));
  });

  it("gives every world hex a value on each axis, and the biome they make", () => {
    const world = generateWorld(98765);
    world.hexes.forEach(h => {
      expect(AXES.morality).toContain(h.morality);
      expect(AXES.temperature).toContain(h.temperature);
      expect(AXES.moisture).toContain(h.moisture);
      expect(h.biome).toEqual(biomeOf(h.temperature, h.moisture));
    });
  });

  it("makes the same world from the same seed, and a different one from another", () => {
    SEEDS.forEach(seed => expect(generateWorld(seed)).toEqual(generateWorld(seed)));
    const worlds = SEEDS.map(seed => JSON.stringify(generateWorld(seed).hexes));
    expect(new Set(worlds).size).toEqual(SEEDS.length);
  });

  it("never lets neighbouring world hexes differ by more than one step on any axis", () => {
    const clashes = [];
    let pairs = 0;
    SEEDS.forEach(seed => {
      const world = generateWorld(seed);
      world.hexes.forEach(h => neighboursIn(world, h).forEach(n => {
        pairs++;
        for (const axis in AXES) {
          if (Math.abs(step(axis, h[axis]) - step(axis, n[axis])) > 1) {
            clashes.push({ seed, axis, a: [h.x, h.y, h[axis]], b: [n.x, n.y, n[axis]] });
          }
        }
      }));
    });
    // NOTE: 37 hexes have 90 neighbouring pairs, each seen from both sides
    expect(pairs).toEqual(SEEDS.length * 180);
    expect(clashes).toEqual([]);
  });

  it("forms broad regions, not noise: most neighbours share each value", () => {
    let same = 0;
    let pairs = 0;
    SEEDS.forEach(seed => {
      const world = generateWorld(seed);
      world.hexes.forEach(h => neighboursIn(world, h).forEach(n => {
        for (const axis in AXES) {
          pairs++;
          same += h[axis] == n[axis] ? 1 : 0;
        }
      }));
    });
    expect(same / pairs).toBeGreaterThan(0.5);
  });

  it("plays in the centre world hex, which has all six neighbours", () => {
    const world = generateWorld(4242424);
    const home = homeOf(world);
    expect([home.x, home.y]).toEqual([world.centre.x, world.centre.y]);
    expect(neighboursIn(world, home).length).toEqual(6);
  });

  it("lands the playable world hex on every biome and every morality across seeds", () => {
    const biomes = new Set();
    const moralities = new Set();
    for (let seed = 1; seed <= 400; seed++) {
      const home = homeOf(generateWorld(seed));
      biomes.add(home.biome);
      moralities.add(home.morality);
    }
    expect([...biomes].sort()).toEqual(Object.keys(BIOMES).sort());
    expect([...moralities].sort()).toEqual([...AXES.morality].sort());
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
