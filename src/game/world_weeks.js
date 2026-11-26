import { SAVE_VERSION } from "./save_version";
import { weekSeed } from "./world_seed";

export const WORLD_PREFIX = "v" + SAVE_VERSION + "/";

export function parseWorldWeek(id) {
  if (!/^\d{4}-W\d{2}$/.test(id)) return null;
  const year = Number(id.slice(0, 4)), week = Number(id.slice(6));
  if (year < 1000 || week < 1 || week > 53) return null;
  const monday = new Date(Date.UTC(year, 0, 4));
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() || 7) + 1 + (week - 1) * 7);
  if (weekSeed(monday) !== year * 100 + week) return null;
  return { id, monday: monday.toISOString().slice(0, 10) };
}

export function worldKey(id) {
  return WORLD_PREFIX + id + ".json.gz";
}

export function parseWorldKey(key) {
  if (!key.startsWith(WORLD_PREFIX) || !key.endsWith(".json.gz")) return null;
  return parseWorldWeek(key.slice(WORLD_PREFIX.length, -8));
}

export function worldWeek(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date).map(part => [part.type, part.value]));
  const seed = weekSeed(new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day)));
  return parseWorldWeek(Math.floor(seed / 100) + "-W" + String(seed % 100).padStart(2, "0"));
}
