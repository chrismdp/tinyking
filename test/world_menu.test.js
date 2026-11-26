/* global it, expect, jest */
import { weekChoices, loadWeekChoices } from "game/world_menu";

it("omits the earlier-week option with zero or one distinct stored week", () => {
  expect(weekChoices([])).toEqual([]);
  expect(weekChoices([{ id: "2026-W48" }])).toEqual([]);
  expect(weekChoices([{ id: "2026-W48" }, { id: "2026-W48" }])).toEqual([]);
});

it("shows the weeks before the newest, newest first, with English Monday labels across a year boundary", () => {
  expect(weekChoices([{ id: "2026-W48" }, { id: "2025-W01" }, { id: "2026-W47" }, { id: "2021-W53" }])).toEqual([
    { id: "2026-W47", label: "Week of 16 November 2026" },
    { id: "2025-W01", label: "Week of 30 December 2024" }
  ]);
});

it("fetches the listing without reusing an old cached list", async () => {
  const fetchWeeks = jest.fn(async () => new Response(JSON.stringify([{ id: "2026-W47" }, { id: "2026-W48" }])));
  expect((await loadWeekChoices(fetchWeeks)).map(week => week.id)).toEqual(["2026-W47"]);
  expect(fetchWeeks).toHaveBeenCalledWith("/worlds", { cache: "no-cache" });
});

it("reports a failed listing to the menu", async () => {
  await expect(loadWeekChoices(async () => new Response("down", { status: 503 }))).rejects.toThrow("Could not load earlier weeks. Please try again.");
});
