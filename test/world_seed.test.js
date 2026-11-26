/* global it, expect */
import { weekSeed } from "game/world_seed";

it.each([
  ["2026-11-23T00:00:00Z", 202648],
  ["2026-11-29T23:59:59Z", 202648],
  ["2026-11-30T00:00:00Z", 202649],
  ["2021-01-01T12:00:00Z", 202053],
  ["2021-01-04T00:00:00Z", 202101],
  ["2024-12-30T00:00:00Z", 202501],
  ["2026-11-30T01:00:00+02:00", 202648]
])("uses the UTC ISO week year and week for %s", (date, expected) => {
  expect(weekSeed(new Date(date))).toBe(expected);
});

it("uses the current date by default and leaves its input unchanged", () => {
  const date = new Date("2026-11-26T16:30:00Z"), before = date.getTime();
  expect(weekSeed(date)).toBe(202648);
  expect(date.getTime()).toBe(before);
  expect(weekSeed()).toBe(weekSeed(new Date()));
});
