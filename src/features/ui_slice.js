import { createSlice } from "@reduxjs/toolkit";

const MULTIPLE_INFO_WINDOWS_ALLOWED = false;

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    showMainMenu: true,
    debug: {
      mapLayer: false
    },
    windows: []
  },
  reducers: {
    toggleDebugMapLayer(state) {
      state.debug.mapLayer = !state.debug.mapLayer;
    },
    startGame(state) {
      state.showMainMenu = false;
    },
    customGame(state) {
      state.showMainMenu = false;
      state.windows.push({ id: "mapgen", type: "mapgen" });
    },
    entityClicked(state, action) {
      const entityId = action.payload;
      const existingEntities = state.windows.filter(w => w.type == "info").map(w => w.entityId);
      if (!existingEntities.includes(entityId)) {

        if (!MULTIPLE_INFO_WINDOWS_ALLOWED) {
          state.windows = state.windows.filter(w => w.type != "info");
        }

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

export const { entityClicked, closeWindow, startGame, customGame, toggleDebugMapLayer } = uiSlice.actions;
export default uiSlice.reducer;
