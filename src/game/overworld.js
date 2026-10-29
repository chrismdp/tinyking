import MersenneTwister from "mersenne-twister";

import { Grid, Hex, ALL_SIDES } from "game/hex";
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

// NOTE: Clamp an out-of-range roll to the end it hit (5/6 stay, 1/6
// inward), rather than reflecting it and doubling the chance of leaving.
// Remove values forbidden by ANY generated neighbour, then renormalise.
// Latitude redistributes the two change weights, leaving the stay at four.
export function walkStep(anchor, neighbours, random, target = anchor) {
  const weights = [0, 0, 0];
  const down = target < anchor ? 1.75 : target > anchor ? 0.25 : 1;
  const up = 2 - down;
  for (const [delta, weight] of [[-1, down], [0, 4], [1, up]]) {
    const value = Math.max(0, Math.min(2, anchor + delta));
    if (neighbours.every(n => Math.abs(value - n) <= 1)) {
      weights[value] += weight;
    }
  }
  let roll = random * weights.reduce((a, b) => a + b, 0);
  for (let value = 0; value < weights.length; value++) {
    roll -= weights[value];
    if (roll < 0) { return value; }
  }
}

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
export function walkWorld(seed, { radius = WORLD_RADIUS } = {}) {
  const centre = radius == WORLD_RADIUS ? WORLD_CENTRE : Hex(radius, radius);
  if (!layouts.has(radius)) {
    layouts.set(radius, [...Grid.spiral({ center: centre, radius })]);
  }
  const generator = new MersenneTwister(seed);
  const generated = new Map();
  const cy = centre.toPoint().y;
  const hexes = layouts.get(radius).map(hex => {
    const neighbours = neighbourKeys(hex).map(k => generated.get(k)).filter(h => h);
    const parent = neighbours.length ? neighbours[Math.floor(generator.random() * neighbours.length)] : null;
    const values = {};
    const latitude = Math.abs(hex.toPoint().y - cy) / (Hex().height() * radius);
    const band = Math.min(2, Math.floor(latitude * 3));
    for (const axis in AXES) {
      const steps = AXES[axis];
      const anchor = parent ? steps.indexOf(parent[axis]) : Math.floor(generator.random() * 3);
      values[axis] = steps[parent ? walkStep(anchor, neighbours.map(n => steps.indexOf(n[axis])),
        generator.random(), axis == "temperature" ? band : anchor) : anchor];
    }
    const h = { x: hex.x, y: hex.y, ...values, parent: parent ? Hex(parent).toString() : null,
      biome: biomeOf(values.temperature, values.moisture) };
    generated.set(hex.toString(), h);
    return h;
  });
  return { radius, centre: { x: centre.x, y: centre.y }, hexes };
}

export function generateWorld(seed, options) {
  const world = walkWorld(seed, options);
  return { ...world, ...surveyWorld(world.hexes, seed) };
}

export const homeOf = world => world.hexes.find(h => h.x == world.home.x && h.y == world.home.y);

export const colder = temperature =>
  AXES.temperature[Math.min(AXES.temperature.length - 1, AXES.temperature.indexOf(temperature) + 1)];

// NOTE: High ground is one step colder than its world hex, down to cold.
export const tileTemperature = (worldTemperature, high) => high ? colder(worldTemperature) : worldTemperature;
