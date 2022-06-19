import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  visiblePanel: null,
  explore: {}
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    toggleExplore: (state, action) => {
      if (state.visiblePanel !== "explore") {
        state.visiblePanel = "explore";
        state.explore.selection = null;
      } else {
        state.visiblePanel = null;
      }
    },
    hide: (state, action) => {
      state.visiblePanel = null;
    },
    setExploreSelection: (state, action) => {
      state.explore.selection = action.payload;
    }
  }
});

export const explorePanelVisible = (state) => state.ui.visiblePanel === "explore";

export const { toggleExplore, hide, setExploreSelection } = uiSlice.actions;

export default uiSlice.reducer;
