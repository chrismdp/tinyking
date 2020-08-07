import { createSlice } from "@reduxjs/toolkit";
import { select, delay, put, putResolve, call } from "redux-saga/effects";
import { getAllComponents, clearEntities, newEntities, getPlayerId, discoverTiles } from "features/entities_slice";

import * as Honeycomb from "honeycomb-grid";
import * as SimplexNoise from "simplex-noise";

import MersenneTwister from "mersenne-twister";

import ReactGA from "react-ga";

export const HEX_SIZE = 80;
const MAP_RADIUS = 10;

const SETTLEMENT_LIKELIHOOD = 50; // 30 - certain, 100 - sparse
const MIN_START_SETTLEMENT_DISTANCE = 3;
const STARTING_KNOWN_DISTANCE = 2;

const blankMap = {
  seed: "12345",
  progress: { count: 0 },
  pointWidth: 0,
  pointHeight: 0
};

const mapSlice = createSlice({
  name: "map",
  initialState: blankMap,
  reducers: {
    generate() {},
    clearMap(state, action) {
      const seed = action.payload;
      var newState = Object.assign({}, state, blankMap);
      newState.seed = seed;
      return newState;
    },
    storeMap(state, action) {
      return Object.assign({}, state, action.payload);
    },
    generationProgress(state, action) {
      state.progress = { ...action.payload, count: state.progress.count + 1 };
    }
  }
});

const HAIR = {
  red: 0x8D3633,
  brown: 0x292021,
  black: 0x20232A,
  blonde: 0x957E3C
};
const hair = Object.values(HAIR);

const BODY_MALE = 0x4E3F30;
const BODY_FEMALE = 0x3B6071;

function generateFamily(size, x, y, generator) {
  var result = [];
  for (var p = 0; p < size; p++) {
    result.push({
      nameable: { type: "person", seed: generator.random_int() },
      spatial: { x, y },
      personable: {
        type: "person",
        familyIndex: p / (size * 1.5),
        size: p > 1 ? 12 : 20,
        hair: hair[generator.random_int() % hair.length],
        body: generator.random_int() % 2 == 0 ? BODY_MALE : BODY_FEMALE
      }
    });
  }
  return result;
}

export function* generateFamilies({ seed, playerStart }) {
  var people = [];
  var generator = new MersenneTwister(seed);
  var habitables = yield select(getAllComponents("habitable", "spatial"));
  for (var i = 0; i < habitables.length; i++) {
    var spatial = habitables[i].spatial;
    if (spatial.x == playerStart.x && spatial.y == playerStart.y) {
      const player = { ...generateFamily(1, spatial.x, spatial.y, generator)[0],
        playable: { known: [] },
        assignable: {}
      };
      people = [ ...people, player ];
    } else {
      const familySize = 1 + (generator.random_int() % 5);
      people = [ ...people, ...generateFamily(familySize, spatial.x, spatial.y, generator) ];
    }
  }
  yield put(newEntities(people));
}

export const Hex = Honeycomb.extendHex({
  size: HEX_SIZE,
  orientation: "flat",
  origin: [ HEX_SIZE, HEX_SIZE * Math.sqrt(3) * 0.5 ]
});

export const Grid = Honeycomb.defineGrid(Hex);

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
      yield put(generationProgress({ label: "terrain" }));
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


function* findPlayerStart(grid, landscape) {
  const center = Grid.pointToHex(grid.pointWidth() * 0.5, grid.pointHeight() * 0.5);

  const spiral = Grid.spiral({ radius: MAP_RADIUS });
  for (let spiral_index = 0; spiral_index < spiral.length; spiral_index++) {
    const hex = center.add(spiral[spiral_index]);
    if (landscape[hex].terrain == "grassland") {
      return hex;
    }
    if (spiral_index % 500 == 0) {
      yield delay(10);
      yield put(generationProgress({ label: "find start" }));
    }
  }
  throw "Cannot find any grassland for player to start on!";
  // TODO: do something more useful here
}

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
      yield put(generationProgress({ label: "economic" }));
    }
  }
}

function makeHouseAndField(settlements, grid, target) {
  settlements[target] = {
    x: target.x,
    y: target.y,
    type: "house"
  };
}

function* generateSettlements(seed, grid, landscape, start) {
  var settlements = {};
  var generator = new MersenneTwister(seed);
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    const target = grid[grid_index];
    if (!settlements[target] && landscape[target].terrain == "grassland") {
      const dieRoll = Math.max(3, SETTLEMENT_LIKELIHOOD - landscape[target].economic_value * 2);
      if (generator.random_int() % dieRoll == 0) {
        if (start.distance(target) >= MIN_START_SETTLEMENT_DISTANCE) {
          makeHouseAndField(settlements, grid, target);
        }
      }
    }
    if (grid_index % 500 == 0) {
      yield delay(10);
      yield put(generationProgress({ label: "settlements" }));
    }
  }

  makeHouseAndField(settlements, grid, start, landscape, generator);
  return settlements;
}

function* discoverStartingTiles(id, center) {
  const tiles = Grid.spiral({ radius: STARTING_KNOWN_DISTANCE })
    .map(s => ({ x: center.x + s.x, y: center.y + s.y }));
  yield put(discoverTiles({ id, tiles }));
}

export function* generateMap(action) {
  const { seed } = action.payload;
  yield putResolve(clearMap(seed));
  yield putResolve(clearEntities());

  const grid = Grid.rectangle({width: MAP_RADIUS * 2, height: MAP_RADIUS * 2});

  var landscape = yield call(generateTerrain, grid, seed);

  yield call(generateEconomicValue, grid, landscape);
  var start = yield call(findPlayerStart, grid, landscape);
  const settlements = yield call(generateSettlements, seed, grid, landscape, start);

  yield put(generationProgress({ label: "store" }));

  const entities = [
    ...Object.values(landscape).map((tile) => ({
      nameable: { nickname: "Map tile" },
      spatial: { x: tile.x, y: tile.y },
      mappable: { terrain: tile.terrain },
      valuable: { value: tile.economic_value },
      workable: {},
    })),
    ...Object.values(settlements).map((s) => {
      var entity = {
        spatial: { x: s.x, y: s.y },
      };
      if (s.type == "house") {
        entity.nameable = { nickname: "Wooden building" };
        entity.habitable = {};
        entity.workable = {};
      }
      return entity;
    })];
  const playerStart = { x: start.x, y: start.y };
  yield put(newEntities(entities));
  yield put(storeMap({
    seed,
    playerStart,
    pointWidth: grid.pointWidth(),
    pointHeight: grid.pointHeight()
  }));
  yield put(generationProgress({ label: "families" }));
  yield delay(10);
  yield call(generateFamilies, { seed, playerStart });

  const playerId = yield select(getPlayerId);
  yield call(discoverStartingTiles, playerId, playerStart);

  yield put(generationProgress({ label: "complete" }));
}

export const getMapSeed = state => state.map.seed;

export const { generate, clearMap, storeMap, generationProgress } = mapSlice.actions;
export default mapSlice.reducer;
