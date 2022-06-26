import { createSlice } from '@reduxjs/toolkit';

import { Hex, ring } from "./hex.js";

import TILES from "../../data/tiles.json"

import Engine from "json-rules-engine-simplified"

const initialState = {
  tiles: {
    "0,0": { x: 0, y: 0, type: "grass" },
    "0,-1": { x: 0, y: -1, type: "coast" },
    "1,-1": { x: 1, y: -1, type: "coast" },
  },
  buildings: {
    "0,0": { x: 0, y: 0, type: "house" },
  }
};

const FILLED = "filled";
const SELECTABLE = "selectable";

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    addTile: (state, action) => {
      const { x, y, type } = action.payload;
      const hex = Hex(x, y);
      state.tiles[hex.toString()] = { type, ...hex.coordinates() };
    }
  }
});

export const selectable = (tiles) => {
  const keys = Object.keys(tiles);
  const filled = keys.reduce((acc, key) => ({...acc, [key]: { status: FILLED } }), {});
  const selectable = keys.map(key => Hex(tiles[key])).reduce((acc, center) =>
    ring(center).reduce((acc, hex) => {
      const coord = hex.toString();
      return { ...acc,
        [coord]: {
          status: SELECTABLE,
          ...hex.coordinates(),
          ...acc[coord]
        }
      }
    }, acc), filled);
  const result = Object.keys(selectable)
    .filter(key => selectable[key].status === SELECTABLE)
    .map(key => {
      const { status, ...rest } = selectable[key];
      return { key, ...rest };
    });
  // console.log({ filled, selectable, result });
  return result;
}

const sumValues = objectArray => objectArray.reduce((acc, object) =>
  Object.keys(object).reduce((memo, k) => ({ ...memo, [k]: (memo[k] || 0) + object[k] }), acc),
  {});

const allAreaEffectsAtZero = () => Object.values(TILES).flatMap(t => Object.keys(t.conditions || {})).reduce((memo, k) => ({...memo, [k]: 0}), {})

export const areaEffects = (tiles, tile) => {
  const effects = sumValues([1, 2, 3].map(radius => sumValues(
    ring(tile, radius)
      .filter(hex => tiles[hex.toString()])
      .map(hex => TILES[tiles[hex.toString()].type])
      .map(type => (type.effect || {}).area)
      .map(area =>
        Object.keys(area).reduce((memo, k) => ({...memo, [k]: Math.trunc(area[k] / (radius + 1))}), allAreaEffectsAtZero()))
    )));
  return effects;
}

const minMax = (array) => array.reduce((memo, h) => ({
  max: Math.max(h, memo.max),
  min: Math.min(h, memo.min)
}), { max: Number.MIN_SAFE_INTEGER, min: Number.MAX_SAFE_INTEGER});

const limitRange = (key) => {
  const { min, max } = minMax(Object.values(TILES).map(t => ((t.limits || {})[key] || 0)));
  return max - min;
};

const allLimitValues = Object.keys(Object.values(TILES).reduce((memo, t) => ({...memo, ...t.limits}), {}));
console.log(allLimitValues);

export const limits = (tiles, tile) => allLimitValues.reduce((memo, key) => ({
  ...memo,
  [key]: limitsForKey(tiles, tile, key)
}), {});

export const limitsForKey = (tiles, tile, key) => {
  const values = [...Array(limitRange(key)).keys()].flatMap(radius =>
    minMax(ring(tile, radius + 1)
      .filter(hex => tiles[hex.toString()])
      .map(hex => (TILES[tiles[hex.toString()].type].limits[key] || 0))
    ))
  const result = values.reduce((memo, { min, max }, i) => ({
    max: Math.max(memo.max, max - i),
    min: Math.min(memo.min, min + i)
  }), { max: Number.MIN_SAFE_INTEGER, min: Number.MAX_SAFE_INTEGER});
  return { max: result.min + 1, min: result.max - 1 };
}

const limitRules = (tile) => allLimitValues.reduce((memo, key) => ({
  ...memo,
  [`limits.${key}.max`]: { greaterEq: TILES[tile].limits[key] || 0 },
  [`limits.${key}.min`]: { lessEq: TILES[tile].limits[key] || 0 },
}), {});

const rules = Object.keys(TILES)
  .filter(tile => TILES[tile].conditions)
  .map(tile => ({
    conditions: {
      ...TILES[tile].conditions,
      ...limitRules(tile)
    },
    event: tile
  }));

const engine = new Engine(rules);

export const availableTiles = async payload => await engine.run(payload)

export const { addTile } = mapSlice.actions;

export default mapSlice.reducer;
