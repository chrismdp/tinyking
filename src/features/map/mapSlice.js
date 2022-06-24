import { createSlice, createSelector } from '@reduxjs/toolkit';

import { Hex, Grid } from "./hex.js";

import TILE_INFO from "../../data/tiles.json"
import TERRAIN_INFO from "../../data/terrains.json"

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

export const selectable = createSelector(
  state => state.map.tiles,
  tiles => {
    const selectable = {};
    const keys = Object.keys(tiles);
    for (let tile_index = 0; tile_index < keys.length; tile_index++) {
      const key = keys[tile_index];
      const center = Hex(tiles[key])
      selectable[key] = { status: FILLED };

      const info = TERRAIN_INFO[TILE_INFO[tiles[key].type].terrain];
      if (info.land) {
        const spiral = Grid.spiral({center, radius: 1});
        for (let index = 1; index < spiral.length; index++) {
          const coord = spiral[index].toString();
          if (selectable[coord] == null || selectable[coord].status !== FILLED) {
            selectable[coord] = { hex: spiral[index], status: SELECTABLE };
          }
        }
      }
    }
    const result = Object.keys(selectable).map(key => {
      if (selectable[key].status === SELECTABLE) {
        return {key: key, ...selectable[key].hex.coordinates()};
      }
      return null;
    }).filter(x => x);
    return result;
  }
);

export const { addTile } = mapSlice.actions;

export default mapSlice.reducer;
