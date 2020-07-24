import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { debug: { mapLayer: false }, windows: [ { id: 0, type: "mapgen" } ] },
  reducers: {
    toggleDebugMapLayer(state) {
      state.debug.mapLayer = !state.debug.mapLayer;
    },
    entityClicked(state, action) {
      const entityId = action.payload;
      const existingEntities = state.windows.filter(w => w.type == "info").map(w => w.entityId);
      if (!existingEntities.includes(entityId)) {
        state.windows.push({ id: "info-" + entityId, type: "info", entityId });
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
