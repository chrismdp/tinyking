import { createSlice } from '@reduxjs/toolkit';
import { addTile, addBuilding } from "../map/mapSlice.js";

const SEASONS = ["spring", "summer", "autumn", "winter"]

export const PHASES = {
  explore: {
    skippable: false
  },
  build: {
    skippable: true
  }
}

const initialState = {
  turn: 0,
  phase: 'explore'
};

const phaseNames = Object.keys(PHASES);

function nextPhase(state) {
  const index = phaseNames.indexOf(state.phase)
  const newIndex = (index + 1) % phaseNames.length;
  if (newIndex < index) {
    state.turn++;
  }
  state.phase = phaseNames[newIndex];
}

export const timeSlice = createSlice({
  name: 'time',
  initialState,
  reducers: {
    skip: nextPhase,
  },
  extraReducers: (builder) => {
    builder.addCase(addTile, (state, action) => { state.phase = 'build'; });
    builder.addCase(addBuilding, nextPhase);
  }
});

export const turnData = state => {
  const year = Math.floor(state.time.turn / 4) + 1;
  const season = SEASONS[state.time.turn % 4];
  const phase = state.time.phase;
  return { year, season, phase };
};

export const { skip } = timeSlice.actions;
export default timeSlice.reducer;
