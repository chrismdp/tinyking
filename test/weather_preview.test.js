import { applyWeatherPreview } from "../src/render/weather_preview";

it("accepts weather, season and hour for repeatable development captures", () => {
  const state = { days: 0.375, map: { seed: 13 },
    world: { home: { x: 0, y: 0 }, hexes: [{ x: 0, y: 0, temperature: "temperate", moisture: "normal", biome: "grassland" }] },
    ecs: { mappable: { 1: { temperature: "cold", terrain: "mountain" }, 2: { temperature: "hot", terrain: "grassland" } } } };
  applyWeatherPreview(state, "?weather=snow&season=winter&hour=11&snow=0.6");
  expect(state.days).toBeCloseTo(9 + 11 / 24);
  expect(state.weather["0,0"].type).toBe("snow");
  expect(state.snow[1]).toBe(0.6);
  expect(state.weatherOverride).toBe("snow");
  applyWeatherPreview(state, "?weather=invalid&season=invalid&hour=invalid");
  expect(state.days).toBeCloseTo(9 + 11 / 24);
  expect(state.weatherOverride).toBeUndefined();
});
