import { createSlice } from '@reduxjs/toolkit';
import MersenneTwister from 'mersenne-twister';

import { addTile } from "../map/mapSlice.js";

import EVENTS from "../../data/events.json"

const initialState = {
  visiblePanel: null,
  panel: {}
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    explore: (state, action) => {
      const { x, y, availableTerrains } = action.payload;
      state.visiblePanel = "explore";
      state.panel = { hex: { x, y }, availableTerrains };
    },
    hide: (state, action) => {
      state.visiblePanel = null;
      state.panel = {}
    },
    showEvent: (state, action) => {
      state.visiblePanel = "event";
      const { x, y, ...rest } = action.payload;
      state.panel = { hex: { x, y }, ...rest };
    }
  },
  extraReducers: (builder) => {
    builder.addCase(addTile, (state, action) => {
      state.visiblePanel = null;
    })
  }
});

export const explorePanelVisible = (state) => state.ui.visiblePanel === "explore";
export const eventPanelVisible = (state) => state.ui.visiblePanel === "event";

export const { explore, hide, showEvent } = uiSlice.actions;

export const chooseTerrain = ({ terrain, x, y }) => dispatch => {
  const generator = new MersenneTwister(); // TODO: Seeding
  const events = EVENTS.filter(e => e.terrain === terrain);
  const event = events[generator.random_int() % events.length];
  if (event.prompts) {
    dispatch(showEvent({ terrain, x, y, event }));
  } else {
    dispatch(addTile({ x, y, type: event.tile }));
  }
};

export default uiSlice.reducer;
