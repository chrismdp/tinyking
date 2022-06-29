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

const rules = Object.keys(EVENTS)
  .map(event => ({
    event,
    conditions: {
      ...EVENTS[event].conditions,
      terrain: { is: EVENTS[event].terrain }
    },
  }));

const engine = new Engine(rules);

export const chooseTerrain = ({ terrain, effects, x, y }) => async dispatch => {
  const events = await engine.run({ terrain, ...effects })
  console.log({ terrain, effects, events })

  const generator = new MersenneTwister(); // TODO: Seeding
  const event = events[generator.random_int() % events.length];
  if (EVENTS[event].prompts) {
    dispatch(showEvent({ terrain, x, y, event }));
  } else {
    dispatch(addTile({ x, y, type: EVENTS[event].tile }));
  }
};

export default uiSlice.reducer;
