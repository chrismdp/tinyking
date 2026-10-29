import SimplexNoise from "simplex-noise";

import { Grid, Hex, ALL_SIDES } from "game/hex";

// NOTE: The world is a hexagon of world hexes, and the map the game is
// played on is one of them. Each world hex has one value on each of three
// axes, and its temperature and moisture make its biome. They change how the
// map looks and nothing else: no rule of the game reads them.

export const AXES = {
  morality: ["good", "neutral", "evil"],
  temperature: ["hot", "temperate", "cold"],
  moisture: ["wet", "normal", "dry"],
};

export const BIOMES = {
  desert: { temperature: "hot", moisture: "dry" },
  savanna: { temperature: "hot", moisture: "normal" },
  jungle: { temperature: "hot", moisture: "wet" },
  steppe: { temperature: "temperate", moisture: "dry" },
  grassland: { temperature: "temperate", moisture: "normal" },
  marsh: { temperature: "temperate", moisture: "wet" },
  tundra: { temperature: "cold", moisture: "dry" },
  taiga: { temperature: "cold", moisture: "normal" },
  snowfield: { temperature: "cold", moisture: "wet" },
};

export const biomeOf = (temperature, moisture) => Object.keys(BIOMES)
  .find(b => BIOMES[b].temperature == temperature && BIOMES[b].moisture == moisture);

export const WORLD_RADIUS = 3;
const WORLD_CENTRE = Hex(WORLD_RADIUS, WORLD_RADIUS);

// NOTE: World hex centres are about 100 apart, so neighbours sit about
// 0.15 apart in the noise: slowly enough changing to make regions a few
// world hexes across, with few clashes for the repair to smooth over.
const NOISE_SCALE = 0.0015;
// NOTE: Simplex noise falls below -0.25 a third of the time and above 0.25
// a third of the time, so these cut it into three roughly equal steps.
const THRESHOLD = 0.25;

const quantise = value => value < -THRESHOLD ? 0 : (value > THRESHOLD ? 2 : 1);

// NOTE: Steps are 0, 1 and 2, and neighbours may differ by one at most, so
// a clash is a 0 next to a 2. Cells are visited from least to most certain
// (ties in order), and an extreme that still clashes moves to the middle.
// A middle step clashes with nothing, and values only ever move to the
// middle, so one pass leaves no clash: when the first cell of a clashing
// pair was visited, the other was already extreme, so it would have moved.
export function repairClashes(steps, neighbours, confidence) {
  const result = [...steps];
  const order = steps.map((_, i) => i).sort((a, b) => confidence[a] - confidence[b] || a - b);
  for (const i of order) {
    if (result[i] != 1 && neighbours[i].some(j => Math.abs(result[j] - result[i]) > 1)) {
      result[i] = 1;
    }
  }
  return result;
}

export function generateWorld(seed) {
  const grid = [...Grid.hexagon({ center: WORLD_CENTRE, radius: WORLD_RADIUS })];
  const index = new Map(grid.map((hex, i) => [hex.toString(), i]));
  const neighbours = grid.map(hex => Grid.hexagon({ center: hex, radius: 1 })
    .neighborsOf(hex, ALL_SIDES)
    .map(n => index.get(n.toString()))
    .filter(i => i != null));

  const steps = {};
  for (const axis in AXES) {
    const simplex = new SimplexNoise(axis + ":" + seed);
    // NOTE: Noise is always zero on its lattice, and small near it, so the
    // world is moved to somewhere new in the noise for each seed. Otherwise
    // a world hex near a lattice point would come out neutral on most seeds.
    const shift = { x: simplex.noise2D(0.5, 0.25) * 1000, y: simplex.noise2D(0.25, 0.5) * 1000 };
    const raw = grid.map(hex => {
      const { x, y } = hex.toPoint();
      return simplex.noise2D(x * NOISE_SCALE + shift.x, y * NOISE_SCALE + shift.y);
    });
    // NOTE: how far past its threshold each value is
    const confidence = raw.map(r => Math.abs(r) - THRESHOLD);
    steps[axis] = repairClashes(raw.map(quantise), neighbours, confidence);
  }

  return {
    radius: WORLD_RADIUS,
    centre: { x: WORLD_CENTRE.x, y: WORLD_CENTRE.y },
    hexes: grid.map((hex, i) => {
      const values = {};
      for (const axis in AXES) {
        values[axis] = AXES[axis][steps[axis][i]];
      }
      return { x: hex.x, y: hex.y, ...values, biome: biomeOf(values.temperature, values.moisture) };
    })
  };
}

// NOTE: The map is played in the centre world hex, so it always has six
// neighbours, as the new game window's six neighbouring towns expect.
export const homeOf = world => world.hexes.find(h => h.x == world.centre.x && h.y == world.centre.y);

export const colder = temperature =>
  AXES.temperature[Math.min(AXES.temperature.length - 1, AXES.temperature.indexOf(temperature) + 1)];

// NOTE: High ground is one step colder than its world hex, down to cold.
export const tileTemperature = (worldTemperature, high) => high ? colder(worldTemperature) : worldTemperature;
