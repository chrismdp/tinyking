import { createSlice, createSelector } from '@reduxjs/toolkit';

import { Hex, Grid } from "../../hex.js";

const initialState = {
  tiles: {
    "0,0": { x: 0, y: 0, type: "grass" },
    // "0,1": { x: 0, y: 1, type: "house" }, // TODO: This is clearly wrong - it's a building
    "0,-1": { x: 0, y: -1, type: "coast" },
    "1,-1": { x: 1, y: -1, type: "coast" },
  },
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
      const spiral = Grid.spiral({center, radius: 1});
      for (let index = 1; index < spiral.length; index++) {
        const coord = spiral[index].toString();
        if (selectable[coord] == null || selectable[coord].status !== FILLED) {
          selectable[coord] = { hex: spiral[index], status: SELECTABLE };
        }
      }
    }
    return Object.keys(selectable).map(key => {
      if (selectable[key].status === SELECTABLE) {
        return selectable[key].hex.coordinates();
      }
      return null;
    }).filter(x => x);
  }
);

export const { addTile } = mapSlice.actions;

export default mapSlice.reducer;
