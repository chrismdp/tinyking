// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import ReactDOM from "react-dom";
import ReactGA from "react-ga";
import { Provider } from "react-redux";
import { combineReducers } from "redux";
import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import mapReducer from "features/map_slice";
import uiReducer from "features/ui_slice";
import { Game } from "components/game";
import baseSaga from "sagas";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDice } from "@fortawesome/free-solid-svg-icons";
library.add(faDice);

const sagaMiddleware = createSagaMiddleware();
const reducer = combineReducers({ map: mapReducer, ui: uiReducer });
const store = configureStore({
  reducer: reducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(sagaMiddleware)
});
sagaMiddleware.run(baseSaga);

ReactDOM.render(<Provider store={store}><Game/></Provider>,
  document.getElementById("root"));

if (process.env.NODE_ENV !== "production") {
  console.log("Tiny King: development mode!");
}

ReactGA.initialize("UA-431118-26", {debug: false});//process.env.NODE_ENV !== "production"});
