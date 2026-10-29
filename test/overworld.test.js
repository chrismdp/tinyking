import { Grid, Hex, ALL_SIDES } from "game/hex";
import {
  AXES, BIOMES, biomeOf, colder, tileTemperature, generateWorld, homeOf, repairClashes, propagateFrom,
  WORLD_RADIUS
} from "game/overworld";

const SEEDS = [1, 1234, 98765, 4242424, 7777777, 31337, 2026];

const step = (axis, value) => AXES[axis].indexOf(value);

const neighboursIn = (world, hex) => {
  const grid = Grid.hexagon({ center: Hex(hex.x, hex.y), radius: 1 });
  return grid.neighborsOf(Hex(hex.x, hex.y), ALL_SIDES)
    .map(n => world.hexes.find(h => h.x == n.x && h.y == n.y))
    .filter(h => h);
};

const keyOf = hex => Hex(hex.x, hex.y).toString();

// NOTE: every pair of neighbours more than one step apart, on any axis
const neighbourIndex = new Map();
const clashesIn = world => {
  const at = new Map(world.hexes.map(h => [keyOf(h), h]));
  const clashes = [];
  world.hexes.forEach(h => {
    if (!neighbourIndex.has(keyOf(h))) {
      neighbourIndex.set(keyOf(h), neighboursIn(world, h).map(keyOf));
    }
    return neighbourIndex.get(keyOf(h)).map(k => at.get(k)).forEach(n => {
    for (const axis in AXES) {
      if (Math.abs(step(axis, h[axis]) - step(axis, n[axis])) > 1) {
        clashes.push({ axis, a: [h.x, h.y, h[axis]], b: [n.x, n.y, n[axis]] });
      }
    }
    });
  });
  return clashes;
};

// NOTE: a copy of the world with one world hex's value changed
const withValue = (world, key, axis, value) => ({
  ...world,
  hexes: world.hexes.map(h => keyOf(h) == key ? { ...h, [axis]: value } : h)
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
    for (let seed = 1; seed <= 120; seed++) {
      const home = homeOf(generateWorld(seed));
      biomes.add(home.biome);
      moralities.add(home.morality);
    }
    expect([...biomes].sort()).toEqual(Object.keys(BIOMES).sort());
    expect([...moralities].sort()).toEqual([...AXES.morality].sort());
  });
});

describe("a change spreading out from one world hex", () => {
  // NOTE: a world all neutral, temperate and normal, except one good hex
  const calm = () => {
    const world = generateWorld(1);
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
      const world = generateWorld(seed);
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
