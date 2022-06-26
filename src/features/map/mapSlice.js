import { createSlice } from '@reduxjs/toolkit';

import { Hex, ring } from "./hex.js";

import TILES from "../../data/tiles.json"

import Engine from "json-rules-engine-simplified"

import { limitRules } from "./limits"

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

const rules = Object.keys(TILES)
  .filter(tile => TILES[tile].conditions)
  .map(tile => ({
    conditions: {
      ...TILES[tile].conditions,
      ...limitRules(TILES, tile)
    },
    event: tile
  }));

const engine = new Engine(rules);

export const availableTiles = async payload => await engine.run(payload)

export const { addTile } = mapSlice.actions;

export default mapSlice.reducer;
