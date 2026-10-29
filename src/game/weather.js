import SimplexNoise from "simplex-noise";
import { WorldHex, WorldGrid, ALL_SIDES } from "game/hex";
import { HOUR, season } from "game/time";

const WORLD_WIDTH = WorldHex().width();
const keyOf = h => h.x + "," + h.y;
const clamp = n => Math.max(0, Math.min(1, n));
const fields = new Map();
const layouts = new WeakMap();
const points = new Map();
const neighbours = new Map();
const pointAt = hex => {
  const key = keyOf(hex);
  if (!points.has(key)) points.set(key, WorldHex(hex).toPoint());
  return points.get(key);
};
const PLAINS = ["grassland", "steppe", "savanna"];
export const WEATHER_TYPES = ["clear", "cloudy", "rain", "snow", "storm"];

const fieldFor = seed => {
  if (!fields.has(seed)) fields.set(seed, new SimplexNoise("weather:" + seed));
  return fields.get(seed);
};

// NOTE: hPa, sampled in world-hex widths. Subtracting time from x carries
// the same system east by one hex every ten hours. No local-map coordinates.
export function pressureAt(hex, seed, days) {
  const p = pointAt(hex);
  const x = p.x / WORLD_WIDTH;
  const y = p.y / WORLD_WIDTH;
  const hours = days / HOUR;
  const baseline = { hot: -7, temperate: 0, cold: 7 }[hex.temperature];
  const seasonal = hex.ocean ? 0 : { spring: 0, summer: -4, autumn: 0, winter: 4 }[season(days)];
  const system = fieldFor(seed).noise2D((x - hours * 0.1) * 0.42 + 17.3, y * 0.42 - 9.1);
  return 1013 + baseline + seasonal + system * (hex.ocean ? 31 : 23);
}

const neighboursOf = hex => {
  const key = keyOf(hex);
  if (!neighbours.has(key)) {
    neighbours.set(key, WorldGrid.hexagon({ center: WorldHex(hex), radius: 1 })
      .neighborsOf(WorldHex(hex), ALL_SIDES));
  }
  return neighbours.get(key);
};

// NOTE: Average the downhill pressure differences along the six directions.
// Missing neighbours at the world's rim contribute no gradient.
export function windAt(hex, pressures, neighbours = neighboursOf(hex)) {
  const p = pointAt(hex);
  const pressure = pressures[keyOf(hex)];
  let x = 0;
  let y = 0;
  for (const n of neighbours) {
    const other = pressures[keyOf(n)];
    if (other === undefined) continue;
    const q = pointAt(n);
    const distance = Math.hypot(q.x - p.x, q.y - p.y);
    x += (p.x - q.x) / distance * (other - pressure) / 3;
    y += (p.y - q.y) / distance * (other - pressure) / 3;
  }
  const length = Math.hypot(x, y);
  return { x: length ? x / length : 0, y: length ? y / length : 0,
    direction: Math.atan2(y, x), strength: length / 20 };
}

const moistureAt = hex => hex.ocean ? 1 : { wet: 0.9, normal: 0.5, dry: 0.15 }[hex.moisture];
export const coldEnough = (hex, days) => hex.temperature == "cold" ||
  (hex.temperature == "temperate" && season(days) == "winter");

const layoutFor = world => {
  if (!layouts.has(world)) {
    layouts.set(world, new Map(world.hexes.map(h => [keyOf(h),
      neighboursOf(h).filter(n => world.hexes.some(other => keyOf(other) == keyOf(n)))])));
  }
  return layouts.get(world);
};

// NOTE: Type is sampled on three-hour boundaries, so it cannot flicker
// between adjacent hourly samples. Pressure and wind still move every hour.
export function weatherForWorld(world, seed, days) {
  const at = Math.floor((days / HOUR + 1e-7) / 3) * 3 * HOUR;
  const pressures = Object.fromEntries(world.hexes.map(h => [keyOf(h), pressureAt(h, seed, days)]));
  const settled = Object.fromEntries(world.hexes.map(h => [keyOf(h), pressureAt(h, seed, at)]));
  const byKey = new Map(world.hexes.map(h => [keyOf(h), h]));
  const layout = layoutFor(world);
  return Object.fromEntries(world.hexes.map(h => {
    const key = keyOf(h);
    const neighbours = layout.get(key);
    const wind = windAt(h, pressures, neighbours);
    const p = pointAt(h);
    const advection = windAt(h, settled, neighbours);
    let supply = 0;
    let weight = 0;
    // NOTE: One-step advection from the higher-pressure, upwind neighbours.
    for (const n of neighbours) {
      const q = pointAt(n);
      const w = Math.max(0, settled[keyOf(n)] - settled[key]);
      if (w && (q.x - p.x) * advection.x + (q.y - p.y) * advection.y < 0) {
        supply += moistureAt(byKey.get(keyOf(n))) * w;
        weight += w;
      }
    }
    const moisture = clamp(weight ? moistureAt(h) * 0.55 + supply / weight * 0.45 : moistureAt(h));
    const change = Math.abs(settled[key] - pressureAt(h, seed, Math.max(0, at - 3 * HOUR)));
    const stormThreshold = PLAINS.includes(h.biome) ? 5.5 : ["jungle", "taiga"].includes(h.biome) ? 14 : 9;
    let type = "clear";
    if (settled[key] < 1020 && change > stormThreshold) {
      type = "storm";
    } else if (settled[key] < 1011 && moisture >= 0.46) {
      type = coldEnough(h, days) ? "snow" : "rain";
    } else if (settled[key] < 1018 && moisture >= 0.3) {
      type = "cloudy";
    }
    return [key, { type, pressure: pressures[key], wind, moisture, change }];
  }));
}

// NOTE: Depth is a visual fraction (0..1), never read by walking, crops or
// needs. High ground already has its colder temperature in mappable.
export function snowDepthAfter(depth, tile, weather, days, hours) {
  if (tile.terrain.includes("water")) return 0;
  const winter = season(days) == "winter";
  const summer = season(days) == "summer";
  if (weather == "snow") return clamp(depth + 0.085 * hours);
  const melt = tile.temperature == "hot" ? (summer ? 0.18 : 0.12) :
    tile.temperature == "temperate" ? (winter ? 0.012 : summer ? 0.12 : 0.06) : (winter ? 0 : 0.006);
  return Math.max(0, depth - melt * hours);
}

export function localWeather(state) {
  const h = state.world && state.world.home;
  return h && state.weather && state.weather[keyOf(h)];
}

export function updateWeather(state, hours = 1, seed = state.map && state.map.seed) {
  if (!state.world) return;
  state.weather = weatherForWorld(state.world, seed, state.days);
  if (state.weatherOverride) {
    const here = localWeather(state);
    here.type = state.weatherOverride;
    here.wind = { x: 0.8, y: 0.6, direction: Math.atan2(0.6, 0.8), strength: here.type == "storm" ? 1 : 0.35 };
  }
  if (!state.snow) state.snow = {};
  let changed = false;
  const here = localWeather(state);
  const home = state.world.hexes.find(h => keyOf(h) == keyOf(state.world.home));
  const precipitation = here.type == "storm" && here.moisture >= 0.46 && coldEnough(home, state.days) ? "snow" : here.type;
  for (const id in state.ecs.mappable) {
    const old = state.snow[id] || 0;
    const depth = snowDepthAfter(old, state.ecs.mappable[id], precipitation, state.days, hours);
    state.snow[id] = depth;
    changed = changed || depth != old;
  }
  if (changed) state.snowRevision = (state.snowRevision || 0) + 1;
}
