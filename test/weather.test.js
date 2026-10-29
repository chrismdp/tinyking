import { WorldHex, WorldGrid, ALL_SIDES } from "game/hex";
import { HOUR } from "game/time";
import { pressureAt, windAt, weatherForWorld, updateWeather, snowDepthAfter } from "game/weather";

const region = (biome = "grassland", temperature = "temperate", moisture = "normal", ocean = false) => ({
  home: { x: 2, y: 2 },
  hexes: [...WorldGrid.hexagon({ center: WorldHex(2, 2), radius: 2 })]
    .map(h => ({ x: h.x, y: h.y, biome, temperature, moisture, ocean }))
});
const keyOf = h => h.x + "," + h.y;

it("replays all pressures, winds and weather from seed and time without mutating the world", () => {
  const world = region();
  const before = JSON.stringify(world);
  const a = weatherForWorld(world, 13, 4.5);
  expect(a).toEqual(weatherForWorld(world, 13, 4.5));
  expect(a).not.toEqual(weatherForWorld(world, 14, 4.5));
  expect(JSON.stringify(world)).toEqual(before);
  expect(Object.keys(a)).toHaveLength(world.hexes.length);
});

it("has higher mean pressure in cold biomes, seasonal land pressure and stronger ocean swings", () => {
  const hex = region().hexes[0];
  const values = (temperature, ocean = false) => Array.from({ length: 288 }, (_, hour) =>
    pressureAt({ ...hex, temperature, ocean }, 13, hour * HOUR));
  const mean = a => a.reduce((s, n) => s + n, 0) / a.length;
  expect(mean(values("cold")) - mean(values("hot"))).toBeGreaterThan(10);
  const land = { ...hex, temperature: "temperate" };
  // Same weather-system position in the same seed: seasonal contribution is isolated by ocean.
  const seasonal = days => pressureAt(land, 13, days) - pressureAt({ ...land, ocean: true }, 13, days);
  expect(seasonal(9.5) - seasonal(3.5)).toBeGreaterThan(0);
  const spread = a => Math.max(...a) - Math.min(...a);
  expect(spread(values("temperate", true))).toBeGreaterThan(spread(values("temperate")));
});

it("carries a weather system west to east as time advances", () => {
  const a = { x: 0, y: 2, temperature: "temperate", ocean: true };
  const b = { ...a, x: 1 };
  // A system drifts one world-hex width in ten hours.
  expect(pressureAt(a, 13, 0)).toBeCloseTo(pressureAt(b, 13, 10 * HOUR), 8);
});

it("blows down the pressure gradient, with strength proportional to the difference", () => {
  const home = WorldHex(2, 2);
  const neighbours = WorldGrid.hexagon({ center: home, radius: 1 }).neighborsOf(home, ALL_SIDES);
  const field = difference => Object.fromEntries([home, ...neighbours].map(h =>
    [keyOf(h), 1013 + difference * (h.toPoint().x - home.toPoint().x) / WorldHex().width()]));
  const weak = windAt(home, field(3));
  const strong = windAt(home, field(6));
  expect(weak.x).toBeLessThan(-0.99);
  expect(Math.abs(weak.y)).toBeLessThan(0.01);
  expect(strong.strength).toBeCloseTo(weak.strength * 2, 8);
  expect(windAt(home, field(0)).strength).toBe(0);
});

it("only snows in cold hexes or temperate winter, with moisture from upwind oceans", () => {
  let snow = 0;
  let rain = 0;
  const world = region("jungle", "hot", "wet");
  world.hexes.forEach((h, i) => { if (i % 3 == 0) h.ocean = true; });
  for (const seed of [1, 13, 42]) for (let hour = 0; hour < 288; hour += 3) {
    for (const temperature of ["hot", "temperate", "cold"]) {
      const w = { ...world, hexes: world.hexes.map(h => ({ ...h, temperature })) };
      for (const weather of Object.values(weatherForWorld(w, seed, hour * HOUR))) {
        if (weather.type == "snow") {
          snow++;
          expect(temperature == "cold" || (temperature == "temperate" && hour >= 216)).toBe(true);
        }
        if (weather.type == "rain") rain++;
        expect(weather.moisture).toBeGreaterThanOrEqual(0);
        expect(weather.moisture).toBeLessThanOrEqual(1);
      }
    }
  }
  expect(snow).toBeGreaterThan(50);
  expect(rain).toBeGreaterThan(50);
  const dry = region("steppe", "temperate", "dry");
  const sea = region("steppe", "temperate", "dry", true);
  const downwind = dry.hexes[0];
  const neighbours = WorldGrid.hexagon({ center: WorldHex(downwind), radius: 1 }).neighborsOf(WorldHex(downwind), ALL_SIDES);
  const coastal = { ...dry, hexes: dry.hexes.map(h => neighbours.some(n => keyOf(n) == keyOf(h)) ? { ...h, ocean: true } : h) };
  let carried = false;
  for (let hour = 0; hour < 72; hour += 3) {
    const a = weatherForWorld(dry, 13, hour * HOUR)[keyOf(downwind)];
    const b = weatherForWorld(coastal, 13, hour * HOUR)[keyOf(downwind)];
    if (b.moisture > a.moisture + 0.05) carried = true;
    expect(weatherForWorld(sea, 13, hour * HOUR)[keyOf(downwind)].moisture).toBeGreaterThan(a.moisture);
  }
  expect(carried).toBe(true);
});

it("brings storms much more often to open plains than jungle or taiga over seeds and hours", () => {
  const counts = {};
  for (const biome of ["grassland", "steppe", "savanna", "jungle", "taiga"]) {
    const world = region(biome);
    counts[biome] = 0;
    for (let seed = 0; seed < 12; seed++) for (let hour = 0; hour < 144; hour += 3) {
      counts[biome] += Object.values(weatherForWorld(world, seed, hour * HOUR)).filter(w => w.type == "storm").length;
    }
  }
  const samples = 12 * 48 * region().hexes.length;
  expect(counts.jungle / samples).toBeLessThan(0.04);
  expect(counts.taiga / samples).toBeLessThan(0.04);
  for (const biome of ["grassland", "steppe", "savanna"]) {
    expect(counts[biome] / samples).toBeLessThan(0.4);
    expect(counts[biome]).toBeGreaterThan(100);
    expect(counts[biome]).toBeGreaterThan(counts.jungle * 3);
    expect(counts[biome]).toBeGreaterThan(counts.taiga * 3);
  }
});

it("holds weather for hours with an average run of at least four hours", () => {
  const world = region();
  let runs = 0;
  let changes = 0;
  for (let seed = 0; seed < 6; seed++) {
    const previous = {};
    for (let hour = 0; hour < 144; hour++) {
      const weather = weatherForWorld(world, seed, hour * HOUR);
      for (const key in weather) {
        if (previous[key] != weather[key].type) {
          runs++;
          if (hour > 0) changes++;
        }
        previous[key] = weather[key].type;
      }
    }
  }
  expect(changes).toBeGreaterThan(100);
  expect(6 * 144 * world.hexes.length / runs).toBeGreaterThanOrEqual(4);
});

it("builds snow on land, melts fastest when warm and preserves cold high ground in winter", () => {
  const snowy = snowDepthAfter(0, { temperature: "cold", terrain: "grassland" }, "snow", 9.5, 6);
  expect(snowy).toBeGreaterThan(0.3);
  const hot = snowDepthAfter(snowy, { temperature: "hot", terrain: "grassland" }, "clear", 3.5, 4);
  const cold = snowDepthAfter(snowy, { temperature: "cold", terrain: "grassland" }, "clear", 3.5, 4);
  expect(hot).toBe(0);
  expect(cold).toBeGreaterThan(hot);
  expect(snowDepthAfter(0, { temperature: "cold", terrain: "deep water" }, "snow", 9.5, 12)).toBe(0);
  let depth = snowy;
  for (let hour = 0; hour < 72; hour++) {
    depth = snowDepthAfter(depth, { temperature: "cold", terrain: "mountain" }, "clear", 9 + hour * HOUR, 1);
  }
  expect(depth).toBeGreaterThanOrEqual(0.25);
});

it("stores one current weather for every world hex and independent depths for every tile", () => {
  const state = { world: region(), map: { seed: 13 }, days: 0.375,
    ecs: { mappable: { 1: { temperature: "cold", terrain: "mountain" }, 2: { temperature: "hot", terrain: "grassland" } } } };
  updateWeather(state, 0);
  expect(Object.keys(state.weather)).toHaveLength(state.world.hexes.length);
  expect(state.snow).toEqual({ 1: 0, 2: 0 });
  state.snow[1] = state.snow[2] = 0.5;
  updateWeather(state, 4);
  expect(state.snow[1]).toBeGreaterThan(state.snow[2]);
});

it("also accumulates snow during a wet storm in a cold world hex", () => {
  const world = region("steppe", "cold", "wet");
  const state = { world, days: 9.5, map: { seed: 13 }, weatherOverride: "storm",
    ecs: { mappable: { 1: { temperature: "cold", terrain: "mountain" } } } };
  updateWeather(state, 2);
  expect(state.weather["2,2"].type).toBe("storm");
  expect(state.snow[1]).toBeGreaterThan(0);
});
