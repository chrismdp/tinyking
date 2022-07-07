import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  turn: 0,
  phase: 'explore'
};

export const timeSlice = createSlice({
  name: 'time',
  initialState,
  reducers: {
  },
  extraReducers: (builder) => {
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
  const year = (state.time.turn / 4) + 1;
  const season = SEASONS[state.time.turn % 4];
  const phase = state.time.phase;
  return { year, season, phase };
};

// export const { info, hide, showEvent } = uiSlice.actions;
export default timeSlice.reducer;
