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

import { Game } from "components/game";
import baseSaga from "sagas";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDice } from "@fortawesome/free-solid-svg-icons";
library.add(faDice);

const sagaMiddleware = createSagaMiddleware();

import map from "features/map_slice";
import ui from "features/ui_slice";
import entities from "features/entities_slice";

const reducer = combineReducers({ map, ui, entities });
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
