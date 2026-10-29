import * as time from "game/time";

const MAX_NIGHT = 0.5;

// NOTE: How much sunset glow and night darkness to apply at a time of day,
// each from 0 to 1 (night tops out at MAX_NIGHT). The curve is the one the 2D
// colour filters used.
export function skyAt(days) {
  const hour = time.hour_of_day(days);
  if (hour > 22 || hour <= 5) {
    return { night: MAX_NIGHT, sunset: 0 };
  } else if (hour <= 7) {
    const t = (hour - 5) / 2;
    return { night: MAX_NIGHT - MAX_NIGHT * t, sunset: t * 0.5 };
  } else if (hour <= 10) {
    const t = (hour - 7) / 3;
    return { night: 0, sunset: 0.5 - 0.5 * t };
  } else if (hour <= 18) {
    return { night: 0, sunset: 0 };
  } else if (hour <= 20) {
    const t = (hour - 18) / 2;
    return { night: 0, sunset: t };
  }
  const t = (hour - 20) / 2;
  return { night: MAX_NIGHT * t, sunset: 1 - t };
}

export const SUNSET_TINT = 0xFFBA86;
export const NIGHT_TINT = 0x5A6AA0;

// NOTE: Keep diffuse fill in a storm so characters and UI anchors stay readable.
export function weatherLight(type) {
  if (type == "storm") return { sun: 0.3, sky: 0.65, grey: 0.55 };
  if (type == "rain" || type == "snow") return { sun: 0.5, sky: 0.85, grey: 0.4 };
  if (type == "cloudy") return { sun: 0.68, sky: 0.92, grey: 0.25 };
  return { sun: 1, sky: 1, grey: 0 };
}
