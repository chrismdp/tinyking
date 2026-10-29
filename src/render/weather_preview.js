import { WEATHER_TYPES, updateWeather } from "game/weather";

// NOTE: Called only by the development build. URL controls keep visual
// captures reproducible, including after Reset to seed.
export function applyWeatherPreview(state, search) {
  const params = new URLSearchParams(search);
  const seasons = ["spring", "summer", "autumn", "winter"];
  const s = seasons.indexOf(params.get("season"));
  const hour = params.has("hour") ? Number(params.get("hour")) : NaN;
  if (s >= 0) state.days = Math.floor(state.days / 12) * 12 + s * 3 + state.days % 1;
  if (Number.isFinite(hour) && hour >= 0 && hour < 24) state.days = Math.floor(state.days) + hour / 24;
  const weather = params.get("weather");
  state.weatherOverride = WEATHER_TYPES.includes(weather) ? weather : undefined;
  updateWeather(state, 0);
  const snow = Number(params.get("snow"));
  if (snow > 0 && snow <= 1) {
    for (const id in state.snow) {
      if (!state.ecs.mappable[id].terrain.includes("water")) state.snow[id] = snow;
    }
    state.snowRevision++;
  }
}
