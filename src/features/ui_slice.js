import { createSlice } from "@reduxjs/toolkit";
import { put, take } from "redux-saga/effects";

const MULTIPLE_INFO_WINDOWS_ALLOWED = false;

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    showMainMenu: true,
    debug: {
      mapLayer: false
    },
    tutorial: {
      description: "",
      task: {
        main: "",
        sub: [
          { main: "step 1", complete: false }
        ]
      },
    },
    windows: [
      { id: "main-menu", type: "main-menu" }
    ]
  },
  reducers: {
    toggleDebugMapLayer(state) {
      state.debug.mapLayer = !state.debug.mapLayer;
    },
    startGame(state) {
      state.showMainMenu = false;
      state.windows.push({ id: "tutorial", type: "tutorial" });
    },
    customGame(state) {
      state.showMainMenu = false;
      state.windows.push({ id: "mapgen", type: "mapgen" });
    },
    stepTutorial(state, action) {
      state.tutorial = action.payload;
    },
    continueTutorial() {},
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

export function* tutorial() {
  yield put(stepTutorial({ description: "You are a Tiny King, destined for greatness! It's the beginning of spring, and there's plenty of time until winter, but your food supplies are dwindling."}));
  yield take(continueTutorial);
  yield put(stepTutorial({ description: "You have a small field to plough. Time to make use of it."}));
}

export const getWindows = state => state.ui.windows;
export const getTutorialSteps = state => state.ui.tutorial;

export const { entityClicked, closeWindow, startGame, stepTutorial, continueTutorial, customGame, toggleDebugMapLayer } = uiSlice.actions;
export default uiSlice.reducer;
