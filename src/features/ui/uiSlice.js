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
    showExplore: (state, action) => {
      state.visiblePanel = "explore"
    },
    hide: (state, action) => {
      state.visiblePanel = null;
    }
  }
});

export const explorePanelVisible = (state) => state.ui.visiblePanel === "explore";

export const { showExplore, hideExplore } = uiSlice.actions;

export default uiSlice.reducer;
