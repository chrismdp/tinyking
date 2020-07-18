import { createSlice } from "@reduxjs/toolkit";

import * as Honeycomb from "honeycomb-grid";
import * as SimplexNoise from "simplex-noise";

const hexSize = 50;
const mapRadius = 50;

export const Hex = Honeycomb.extendHex({
  size: hexSize,
  orientation: "flat"
});
const Grid = Honeycomb.defineGrid(Hex);

function generateTerrain(grid, seed) {
  console.log("Generating map");
  const simplex = new SimplexNoise(seed);
  // Terrain
  const centre = { x: grid.width * 0.5, y: grid.height * 0.5 };
  return grid.map(hex => {
    const d = { x: (centre.x - hex.x), y: (centre.y - hex.y) };
    const relativeDistance = (d.x * d.x + d.y * d.y) / (grid.width * grid.width);
    hex.customHeight =
      Math.min(1.5, simplex.noise2D(hex.x * 0.025, hex.y * 0.025) * 1) +
      Math.max(0, simplex.noise2D(hex.x * 0.1, hex.y * 0.1) * 2);
    if (relativeDistance >= 0.19) {
      hex.customHeight -= (relativeDistance - 0.19) * 25;
    }
    if (hex.x == 0 || hex.y == 0 || hex.x == grid.width-1 || hex.y == grid.height-1) {
      hex.customHeight = -1;
    }
    var terrain = "";
    if (hex.customHeight > 1.4) {
      terrain = "mountain";
    } else if (hex.customHeight < 0) {
      terrain = "water";
    } else {
      if (simplex.noise2D(hex.x * 0.2, hex.y * 0.2) > 0.45) {
        terrain = "forest";
      } else if (simplex.noise2D(hex.x * 0.5, hex.y * 0.5) > 0.85) {
        terrain = "stone";
      } else {
        terrain = "grassland";
      }
    }
    return {
      x: hex.x,
      y: hex.y,
      terrain: terrain
    };
  });
}

const mapSlice = createSlice({
  name: "map",
  initialState: {
    seed: "12345",
    landscape: [],
    pointWidth: 0,
    pointHeight: 0
  },
  reducers: {
    generate(state, action) {
      const { seed } = action.payload;
      console.log("generate", action.payload);
      const grid = Grid.rectangle({width: mapRadius * 2, height: mapRadius * 2});
      const pointWidth = grid.pointWidth();
      const pointHeight = grid.pointHeight();
      const landscape = generateTerrain(grid, seed);
      return Object.assign({}, state, { seed, landscape, pointWidth, pointHeight });
    }
  }
});

export const { generate } = mapSlice.actions;
export default mapSlice.reducer;
