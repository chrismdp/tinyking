import SimplexNoise from "simplex-noise";

import { WorldGrid as Grid, WorldHex as Hex, ALL_SIDES } from "game/hex";
import { surveyWorld } from "game/world_terrain";

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

export const WORLD_RADIUS = 5;
const WORLD_CENTRE = Hex(WORLD_RADIUS, WORLD_RADIUS);

// NOTE: Neighbours may differ by one step at most.
const pullTowards = (step, anchor) => Math.abs(step - anchor) <= 1 ? step : anchor + Math.sign(step - anchor);

const neighbourIndex = new Map();
const neighbourKeys = hex => {
  const key = hex.toString();
  if (!neighbourIndex.has(key)) {
    neighbourIndex.set(key, Grid.hexagon({ center: hex, radius: 1 })
      .neighborsOf(hex, ALL_SIDES).map(n => n.toString()));
  }
  return neighbourIndex.get(key);
};

// NOTE: When one world hex's value on an axis changes, the change spreads:
// any neighbour now more than a step away is pulled to one step away, and
// so on outwards from each hex that moved, until the one-step rule holds
// everywhere again. The changed hex keeps its new value; hexes only ever
// move towards it, so the spreading stops. Returns a new world.
export function propagateFrom(world, key, axis) {
  const steps = AXES[axis];
  const hexes = world.hexes.map(h => ({ ...h }));
  const byKey = new Map(hexes.map(h => [Hex(h.x, h.y).toString(), h]));
  const queue = [key];
  while (queue.length > 0) {
    const from = byKey.get(queue.shift());
    for (const next of neighbourKeys(Hex(from.x, from.y))) {
      const to = byKey.get(next);
      if (!to) {
        continue;
      }
      const pulled = steps[pullTowards(steps.indexOf(to[axis]), steps.indexOf(from[axis]))];
      if (pulled != to[axis]) {
        to[axis] = pulled;
        queue.push(next);
      }
    }
  }
  hexes.forEach(h => { h.biome = biomeOf(h.temperature, h.moisture); });
  return { ...world, hexes };
}

const layouts = new Map();
export function generateWorld(seed, { radius = WORLD_RADIUS } = {}) {
  const centre = radius == WORLD_RADIUS ? WORLD_CENTRE : Hex(radius, radius);
  if (!layouts.has(radius)) {
    layouts.set(radius, [...Grid.spiral({ center: centre, radius })]);
  }
  // NOTE: Sample separate seeded fields in units of a world hex's height.
  // Scales and thresholds balance thirds and about 2/3 matching neighbours
  // across seeds, after the one-step repair below.
  const fields = Object.fromEntries(Object.keys(AXES).map(axis => [axis, new SimplexNoise(axis + ":" + seed)]));
  const c = centre.toPoint();
  const hexes = layouts.get(radius).map(hex => {
    const values = {};
    const p = hex.toPoint();
    const x = (p.x - c.x) / Hex().height();
    const y = (p.y - c.y) / Hex().height();
    const latitude = radius ? Math.abs(y) / radius : 0;
    for (const axis in AXES) {
      const scale = axis == "temperature" ? 0.145 : 0.125;
      const threshold = axis == "temperature" ? 0.22 : 0.215;
      const noise = fields[axis].noise2D(x * scale + 17.3, y * scale - 9.1);
      const value = axis == "temperature" ? 1.6 * (latitude - 0.4) + 0.65 * noise : noise;
      values[axis] = AXES[axis][value < -threshold ? 0 : value > threshold ? 2 : 1];
    }
    return { x: hex.x, y: hex.y, ...values };
  });
  // NOTE: Use the same pull as an in-play change, in fixed spiral and side
  // order. A clash between extremes pulls one to the middle, which cannot
  // create another clash on a three-step axis. Include oceans in the repair.
  const byKey = new Map(hexes.map(h => [Hex(h).toString(), h]));
  for (const h of hexes) {
    for (const key of neighbourKeys(Hex(h))) {
      const n = byKey.get(key);
      if (!n) { continue; }
      for (const axis in AXES) {
        const steps = AXES[axis];
        n[axis] = steps[pullTowards(steps.indexOf(n[axis]), steps.indexOf(h[axis]))];
      }
    }
  }
  hexes.forEach(h => { h.biome = biomeOf(h.temperature, h.moisture); });
  const world = { radius, centre: { x: centre.x, y: centre.y }, hexes };
  return { ...world, ...surveyWorld(world.hexes, seed) };
}

export const homeOf = world => world.hexes.find(h => h.x == world.home.x && h.y == world.home.y);

export const colder = temperature =>
  AXES.temperature[Math.min(AXES.temperature.length - 1, AXES.temperature.indexOf(temperature) + 1)];

// NOTE: High ground is one step colder than its world hex, down to cold.
export const tileTemperature = (worldTemperature, high) => high ? colder(worldTemperature) : worldTemperature;
