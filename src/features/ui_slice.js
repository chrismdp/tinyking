import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { debug: { mapLayer: false }},
  reducers: {
    toggleDebugMapLayer(state) {
      state.debug.mapLayer = !state.debug.mapLayer;
    }
  }
});

export const { toggleDebugMapLayer } = uiSlice.actions;
export default uiSlice.reducer;
