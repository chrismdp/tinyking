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
