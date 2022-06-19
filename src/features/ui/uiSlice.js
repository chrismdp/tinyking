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
      } else {
        state.visiblePanel = null;
      }
    },
    hide: (state, action) => {
      state.visiblePanel = null;
    }
  }
});

export const explorePanelVisible = (state) => state.ui.visiblePanel === "explore";

export const { toggleExplore, hideExplore } = uiSlice.actions;

export default uiSlice.reducer;
