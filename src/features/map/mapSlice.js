import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  tiles: {
    "0,0": {
      type: "grass",
      x: 0,
      y: 0
    },
    "0,-1": {
      type: "coast",
      x: 0,
      y: -1
    },
  }
};

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    addTile: {
      reducer: (state, action) => {
        state.tiles[action.tileCoordinates] = action.tile
      },
      prepare: (hex, type) => {
        return {
          tileCoordinates: hex.q + "," + hex.r,
          tile: {
            type: type,
            ...hex.coordinates()
          }
        };
      }
    }
  }
});

export const { addTile } = mapSlice.actions;

export default mapSlice.reducer;
