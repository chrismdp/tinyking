import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Overworld, BiomeKey } from "../src/components/overworld";

// NOTE: The SVG only needs the static palette, not a WebGL/Three runtime.
jest.mock("../src/render/biomes", () => ({
  BIOME_COLOURS: Object.fromEntries(["desert", "savanna", "jungle", "steppe", "grassland", "marsh",
    "tundra", "taiga", "snowfield"].map(b => [b, 0x86c35f]))
}));

it("draws ocean hexes blue and labels them ocean in both world views, with axes retained", () => {
  const world = { centre: { x: 1, y: 1 }, home: { x: 1, y: 1 }, hexes: [
    { x: 1, y: 1, biome: "grassland", morality: "neutral", temperature: "temperate", moisture: "normal" },
    { x: 1, y: 2, ocean: true, biome: "jungle", morality: "evil", temperature: "hot", moisture: "wet" }
  ] };
  for (const labels of [true, false]) {
    const html = renderToStaticMarkup(<Overworld world={world} size={28} labels={labels}/>);
    expect(html).toContain("ocean: evil, hot, wet");
    expect(html).toContain("#286b9b");
    expect(html).toContain(">ocean</tspan>");
    expect(html).not.toContain("jungle");
    if (labels) {
      expect(html).toContain("evil");
      expect(html).toContain("hot / wet");
    }
  }
  expect(renderToStaticMarkup(<BiomeKey/>)).toContain("ocean");
});

it("draws pointy-top polygons on a pointy-top grid in both world views", () => {
  const world = { home: { x: 0, y: 0 }, hexes: [
    { x: 0, y: 0, biome: "grassland" },
    { x: 1, y: 0, biome: "grassland" },
    { x: 0, y: 1, biome: "grassland" }
  ] };
  for (const labels of [true, false]) {
    const html = renderToStaticMarkup(<Overworld world={world} size={30} labels={labels}/>);
    const points = html.match(/points="([^"]+)"/)[1].split(" ").map(p => p.split(",").map(Number));
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toEqual(60);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(52, 0);
    const centres = [...html.matchAll(/transform="translate\(([^)]+)\)"/g)]
      .slice(0, 3).map(m => m[1].split(",").map(Number));
    expect(centres[1][1]).toEqual(centres[0][1]);
    expect(centres[1][0] - centres[0][0]).toBeCloseTo(52, 0);
    expect(centres[2][1] - centres[0][1]).toEqual(45);
    expect(centres[2][0] - centres[0][0]).toBeCloseTo(26, 0);
  }
});
