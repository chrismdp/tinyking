import { createSlice } from "@reduxjs/toolkit";

const blankMap = {
  seed: "12345",
  progress: {},
  pointWidth: 0,
  pointHeight: 0
};

const mapSlice = createSlice({
  name: "map",
  initialState: blankMap,
  reducers: {
    generate() {},
    clearMap(state, seed) {
      var newState = Object.assign({}, state, blankMap);
      newState.seed = seed;
      return newState;
    },
    storeMap(state, action) {
      return Object.assign({}, state, action.payload);
    },
    generationProgress(state, action) {
      state.progress = action.payload;
    }
  }
});

export const { generate, clearMap, storeMap, generationProgress } = mapSlice.actions;
export default mapSlice.reducer;
