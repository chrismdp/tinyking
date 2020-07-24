import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { debug: { mapLayer: false }, windows: [ { type: "mapgen" } ] },
  reducers: {
    toggleDebugMapLayer(state) {
      state.debug.mapLayer = !state.debug.mapLayer;
    },
    entityClicked(state, action) {
      const entity = action.payload;
      if (!(entity in state.windows.filter(w => w.type == "info").map(w => w.entity))) {
        state.windows.push({ id: state.windows.length, type: "info", entity });
      }
    },
    closeWindow(state, action) {
      const id = action.payload;
      state.windows = state.windows.filter(w => w.id != id);
    }
  }
});

export const getWindows = state => state.ui.windows;

export const { entityClicked, closeWindow, toggleDebugMapLayer } = uiSlice.actions;
export default uiSlice.reducer;
