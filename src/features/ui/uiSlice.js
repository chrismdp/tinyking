import { createSlice } from '@reduxjs/toolkit';
import MersenneTwister from 'mersenne-twister';

import { addTile } from "../map/mapSlice.js";

import Engine from "json-rules-engine-simplified"

import EVENTS from "../../data/events.json"

const initialState = {
  visiblePanel: null,
  panel: {}
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    info: (state, action) => {
      const { x, y, availableTerrains, display, type } = action.payload;
      state.visiblePanel = "info";
      state.panel = { hex: { x, y }, display, type, availableTerrains };
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

export const infoPanelVisible = (state) => state.ui.visiblePanel === "info";
export const eventPanelVisible = (state) => state.ui.visiblePanel === "event";

export const { info, hide, showEvent } = uiSlice.actions;

const rules = Object.keys(EVENTS)
  .map(event => ({
    event,
    conditions: {
      ...EVENTS[event].conditions,
      terrain: { is: EVENTS[event].terrain }
    },
  }));

export const engine = new Engine(rules);

export const chooseTerrain = ({ terrain, effects, x, y }) => async dispatch => {
  const events = await engine.run({ terrain, ...effects })

  const generator = new MersenneTwister(); // TODO: Seeding
  const event = events[generator.random_int() % events.length];
  if (EVENTS[event].prompts) {
    dispatch(showEvent({ terrain, x, y, event }));
  } else {
    dispatch(addTile({ x, y, type: EVENTS[event].tile }));
  }
};

export default uiSlice.reducer;
