import { createSlice } from "@reduxjs/toolkit";
import ReactGA from "react-ga";

import * as Honeycomb from "honeycomb-grid";
import * as SimplexNoise from "simplex-noise";

const hexSize = 50;
const mapRadius = 50;

export const Hex = Honeycomb.extendHex({
  size: hexSize,
  orientation: "flat",
  origin: [ hexSize, hexSize * Math.sqrt(3) * 0.5 ]
});
const Grid = Honeycomb.defineGrid(Hex);

function generateTerrain(grid, seed) {
  console.log("Generating map");
  ReactGA.event({category: "Map generation", action: "generate"});

  const simplex = new SimplexNoise(seed);
  // Terrain
  const centre = { x: grid.width * 0.5, y: grid.height * 0.5 };
  return grid.reduce((result, hex) => {
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
    } else if (hex.customHeight <= -0.2) {
      terrain = "deep_water";
    } else if (hex.customHeight < 0) {
      terrain = "shallow_water";
    } else {
      if (simplex.noise2D(hex.x * 0.2, hex.y * 0.2) > 0.45) {
        terrain = "forest";
      } else if (simplex.noise2D(hex.x * 0.5, hex.y * 0.5) > 0.85) {
        terrain = "stone";
      } else {
        terrain = "grassland";
      }
    }
    result[hex] = {
      x: hex.x,
      y: hex.y,
      terrain: terrain
    };
    return result;
  }, {});
}

const terrainValueFn = {
  "mountain": (distance) => distance <= 2 ? 2 : (15 - distance * 3),
  "shallow_water": (distance) => (10 - distance * 2),
  "deep_water": () => 0,
  "forest": (distance) => distance <= 2 ? 2 : (10 - distance * 2),
  "stone": (distance) => distance <= 2 ? 3 : (15 - distance * 3),
  "grassland": (distance) => (10 - distance * 2),
};

function generateEconomicValue(grid, landscape) {
  const spiral = Grid.spiral({ radius: 5 });
  spiral.shift(); // Ignore centre
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    var found = {};
    const target = grid[grid_index];
    if (landscape[target].terrain == "grassland") {
      for (let spiral_index = 0; spiral_index < spiral.length; spiral_index++) {
        const hex = target.add(spiral[spiral_index]);
        if (hex in landscape) {
          const terrain = landscape[hex].terrain;
          if (!(terrain in found)) {
            //console.log(terrain, target.distance(hex));
            found[terrain] = terrainValueFn[terrain](target.distance(hex));
          }
        }
      }
      landscape[target].economic_value = Object.values(found).reduce((a, b) => a + b, 0);
      //console.log(target, found);
    }
  }
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
      var landscape = generateTerrain(grid, seed);
      console.log("generate economic");
      generateEconomicValue(grid, landscape);
      landscape = Object.values(landscape);
      console.log("finished");
      return Object.assign({}, state, { seed, landscape, pointWidth, pointHeight });
    }
  }
});

export const { generate } = mapSlice.actions;
export default mapSlice.reducer;
