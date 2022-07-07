import { createSlice } from '@reduxjs/toolkit';
import { addTile } from "../map/mapSlice.js";

const initialState = {
  turn: 0,
  phase: 'explore'
};

export const timeSlice = createSlice({
  name: 'time',
  initialState,
  reducers: {
    skip: (state) => {
      console.log("skip");
      const phaseNames = Object.keys(PHASES);
      const index = phaseNames.indexOf(state.phase)
      const newIndex = (index + 1) % phaseNames.length;
      if (newIndex < index) {
        state.turn++;
      }
      state.phase = phaseNames[newIndex];
    }
  },
  extraReducers: (builder) => {
    builder.addCase(addTile, (state, action) => {
      state.phase = 'build';
    })
  }
});

const SEASONS = ["spring", "summer", "autumn", "winter"]

export const PHASES = {
  explore: {
    skippable: false
  },
  build: {
    skippable: true
  }
}

export const turnData = state => {
  const year = Math.floor(state.time.turn / 4) + 1;
  const season = SEASONS[state.time.turn % 4];
  const phase = state.time.phase;
  return { year, season, phase };
};

export const { skip } = timeSlice.actions;
export default timeSlice.reducer;
