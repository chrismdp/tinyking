import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  visiblePanel: null,
  explore: {
    hex: {}
  }
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    explore: (state, action) => {
      const { x, y } = action.payload
      state.visiblePanel = "explore";
      state.explore.selection = null;
      state.explore.hex = { x, y };
    },
    hide: (state, action) => {
      state.visiblePanel = null;
      state.explore.hex = {};
    },
    setExploreSelection: (state, action) => {
      state.explore.selection = action.payload;
    }
  }
});

export const explorePanelVisible = (state) => state.ui.visiblePanel === "explore";

export const { explore, hide, setExploreSelection } = uiSlice.actions;

export default uiSlice.reducer;
