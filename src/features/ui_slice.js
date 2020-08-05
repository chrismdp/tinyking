import { createSlice } from "@reduxjs/toolkit";
import { put, take } from "redux-saga/effects";

const MULTIPLE_INFO_WINDOWS_ALLOWED = false;

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    showMainMenu: true,
    visibility: {
      clock: false
    },
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
      if (!(state.windows.some(w => w.type == "tutorial"))) {
        state.windows.push({ id: "tutorial", type: "tutorial" });
      }
    },
    customGame(state) {
      state.showMainMenu = false;
      state.windows.push({ id: "mapgen", type: "mapgen" });
    },
    stepTutorial(state, action) {
      state.tutorial = action.payload;
    },
    changeVisibility(state, action) {
      state.visibility = { ...state.visibility, ...action.payload };
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
  yield put(stepTutorial({ description: "You are a Tiny King, destined for greatness! Your little lands may only consist of a small wooden shack, and a field, but in them there is the potential for a bustling economy!"}));
  yield take(continueTutorial);
  yield put(changeVisibility({ clock: true }));
  yield put(stepTutorial({ description: "It's the beginning of spring - plenty of time until winter. You can take three actions a season."}));
  yield take(continueTutorial);
  yield put(changeVisibility({ supplies: true }));
  yield put(stepTutorial({ description: "Time to grow some grain to stop your supplies dwindling too much. You have a small field to plough; time to make use of it."}));
  yield take(continueTutorial);
  yield put(stepTutorial({ task: { main: "Survive The Winter", sub: [ "Drag your character to the nearest field to plough it" ] }}));
}

export const getWindows = state => state.ui.windows;
export const getTutorialSteps = state => state.ui.tutorial;
export const getVisibility = state => state.ui.visibility;

export const { entityClicked, closeWindow, startGame, stepTutorial, continueTutorial, changeVisibility, customGame, toggleDebugMapLayer } = uiSlice.actions;
export default uiSlice.reducer;
