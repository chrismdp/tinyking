import { createSlice } from '@reduxjs/toolkit';

import { Hex, neighbours } from "./hex.js";

import TILES from "../../data/tiles.json"
import TERRAINS from "../../data/terrains.json"

import Engine from "json-rules-engine-simplified"

const initialState = {
  tiles: {
    "0,0": { x: 0, y: 0, type: "quiet-woodland" },
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

export const selectable = async (tiles) => {
  const selectable = {};

  const rules = Object.keys(TILES)
    .map(type => ({ type, terrain: TERRAINS[TILES[type].terrain] }))
    .filter(({ terrain }) => terrain)
    .map(({ type, terrain }) => ({
      conditions: terrain.conditions,
      event: type
    }));
  let engine = new Engine(rules);

  const keys = Object.keys(tiles);
  for (let tile_index = 0; tile_index < keys.length; tile_index++) {
    const key = keys[tile_index];
    const center = Hex(tiles[key])
    selectable[key] = { status: FILLED };

    await neighbours(center).forEach(async (hex) => {
      const coord = hex.toString();
      if (selectable[coord] == null || selectable[coord].status !== FILLED) {
        const payload = {
          nextTo: neighbours(hex)
            .map(nextToHex => tiles[nextToHex.toString()])
            .filter(x => x)
            .map(tile => TILES[tile.type].terrain)
            .reduce((acc, terrain) => ({ ...acc, [terrain]: (acc[terrain] || 0) + 1}), {})
        };
        const availableTiles = await engine.run(payload);
        if (availableTiles.length > 0) {
          selectable[coord] = { ...hex.coordinates(), availableTiles, status: SELECTABLE };
        }
      }
    });
  }
  const result = Object.keys(selectable).map(key => {
    if (selectable[key].status === SELECTABLE) {
      const { status, ...rest } = selectable[key];
      return { key, ...rest };
    }
    return null;
  }).filter(x => x);
  return result;
}

export const { addTile } = mapSlice.actions;

export default mapSlice.reducer;
