import { delay, put, putResolve, call } from "redux-saga/effects";
import { clearMap, storeMap, generationProgress } from "features/map_slice";

import * as Honeycomb from "honeycomb-grid";
import * as SimplexNoise from "simplex-noise";

import MersenneTwister from "mersenne-twister";

import ReactGA from "react-ga";

const HEX_SIZE = 50;
const MAP_RADIUS= 50;

const SETTLEMENT_LIKELIHOOD = 50; // 30 - certain, 100 - sparse

export const Hex = Honeycomb.extendHex({
  size: HEX_SIZE,
  orientation: "flat",
  origin: [ HEX_SIZE, HEX_SIZE * Math.sqrt(3) * 0.5 ]
});

const Grid = Honeycomb.defineGrid(Hex);

function* generateTerrain(grid, seed) {
  console.log("Generating terrain", seed);

  ReactGA.event({category: "Map generation", action: "generate"});

  const simplex = new SimplexNoise(seed);
  const centre = { x: grid.width * 0.5, y: grid.height * 0.5 };
  var result = {};
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    const hex = grid[grid_index];

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
    if (grid_index % 500 == 0) {
      yield delay(10);
      yield put(generationProgress({ progress: (grid_index / grid.length) * 0.2, label: "terrain" }));
    }
  }
  return result;
}

const terrainValueFn = {
  "mountain": (distance) => distance <= 2 ? 2 : (15 - distance * 3),
  "shallow_water": (distance) => (10 - distance * 2),
  "deep_water": () => 0,
  "forest": (distance) => distance <= 2 ? 2 : (10 - distance * 2),
  "stone": (distance) => distance <= 2 ? 3 : (15 - distance * 3),
  "grassland": (distance) => (10 - distance * 2),
};

function* generateEconomicValue(grid, landscape) {
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
            found[terrain] = terrainValueFn[terrain](target.distance(hex));
          }
        }
      }
      landscape[target].economic_value = Object.values(found).reduce((a, b) => a + b, 0);
    }
    if (grid_index % 500 == 0) {
      yield delay(10);
      yield put(generationProgress({ progress: 0.2 + (grid_index / grid.length) * 0.2, label: "economic" }));
    }
  }
}

function* generateSettlements(seed, grid, landscape) {
  var settlements = {};
  var generator = new MersenneTwister(seed);
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    const target = grid[grid_index];
    if (!settlements[target] && landscape[target].terrain == "grassland") {
      const dieRoll = Math.max(3, SETTLEMENT_LIKELIHOOD - landscape[target].economic_value * 2);
      if (generator.random_int() % dieRoll == 0) {
        settlements[target] = {
          x: target.x,
          y: target.y,
          type: "house"
        };
        const adj = grid.neighborsOf(target);
        const start = generator.random_int() % adj.length;
        for (let n_index = 0; n_index < adj.length; n_index++) {
          const n = adj[(n_index + start) % adj.length];
          if (!settlements[n] && landscape[n].terrain == "grassland") {
            settlements[n] = {
              x: n.x,
              y: n.y,
              type: "field"
            };
            break;
          }
        }
      }
    }
    if (grid_index % 500 == 0) {
      yield delay(10);
      yield put(generationProgress({ progress: 0.4 + (grid_index / grid.length) * 0.2, label: "settlements" }));
    }
  }
  return settlements;
}

export function* generateMap(action) {
  const { seed } = action.payload;
  yield putResolve(clearMap(seed));

  const grid = Grid.rectangle({width: MAP_RADIUS * 2, height: MAP_RADIUS * 2});

  var landscape = yield call(generateTerrain, grid, seed);

  yield call(generateEconomicValue, grid, landscape);
  const settlements = yield call(generateSettlements, seed, grid, landscape);

  yield put(generationProgress({ progress: 0.9, label: "store" }));
  yield put(storeMap({
    seed: seed,
    settlements: Object.values(settlements),
    landscape: Object.values(landscape),
    pointWidth: grid.pointWidth(),
    pointHeight: grid.pointHeight()
  }));
  yield put(generationProgress({ progress: 1, label: "complete" }));
}
