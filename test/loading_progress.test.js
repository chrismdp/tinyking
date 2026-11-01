import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateMap } from "game/map";
import { createLoadingProgress } from "game/loading";
import { LoadingScreen } from "../src/components/loading_screen";

it("reports completed history seasons and ordered generation milestones from real work", async () => {
  const s = { ecs: { nextId: 1 }, days: .375, ui: { show: {} } };
  const updates = [];
  await generateMap(s, 13, async (label, value) => {
    updates.push({ label, value, day: s.days, events: s.events?.length || 0 });
  });
  const seasons = updates.filter(u => u.label.startsWith("Forty-five years"));
  expect(seasons).toHaveLength(180);
  expect(seasons[0].label).toContain("year 1");
  expect(seasons[179].label).toContain("year 45");
  expect(seasons[0].events).toBeLessThan(seasons[179].events);
  expect(updates.map(u => u.value)).toEqual(updates.map(u => u.value).sort((a,b) => a-b));
  expect(updates.at(-1)).toMatchObject({label:"Ready to arrive",value:1});
  for (const label of ["Shaping the land", "Planting forests", "Founding villages", "Waking the villagers"]) expect(updates.some(u => u.label == label)).toBe(true);
});

it("paints immediately on a new operation and yields for progress without adding timed progress", async () => {
  const s = { ui: {} }, render = jest.fn(), paint = jest.fn(async () => {});
  const update = createLoadingProgress(s, render, paint);
  await update("Reading your saved world", 0);
  expect(s.ui.progress).toMatchObject({label:"Reading your saved world",value:0});
  expect(render).toHaveBeenCalled();
  expect(paint).toHaveBeenCalledTimes(1);
  await update("Waking the villagers", .9);
  expect(s.ui.progress.value).toBe(.9);
  expect(paint).toHaveBeenCalledTimes(2);
});

it("renders a named, accessible progress bar with the actual completed amount", () => {
  const html = renderToStaticMarkup(<LoadingScreen progress={{label:"Planting forests",value:.38}}/>);
  expect(html).toContain("Tiny King");
  expect(html).toContain("Planting forests");
  expect(html).toContain('value="0.38"');
  expect(html).toContain('max="1"');
  expect(html).toContain('role="status"');
});
