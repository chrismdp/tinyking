import { createSlice } from '@reduxjs/toolkit';
import { chooseTerrain } from "../map/mapSlice.js";

const initialState = {
  visiblePanel: null,
  explore: {
    hex: {},
    availableTerrains: []
  }
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    explore: (state, action) => {
      const { x, y, availableTerrains } = action.payload;
      state.visiblePanel = "explore";
      state.explore = { hex: { x, y }, availableTerrains };
    },
    hide: (state, action) => {
      state.visiblePanel = null;
      state.explore.hex = {};
    },
    setExploreSelection: (state, action) => {
      state.explore.selection = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(chooseTerrain, (state, action) => {
      state.visiblePanel = null;
    })
  }
});

export const explorePanelVisible = (state) => state.ui.visiblePanel === "explore";

export const { explore, hide, setExploreSelection } = uiSlice.actions;

export default uiSlice.reducer;
