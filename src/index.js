// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
//import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import ReactDOM from "react-dom";
import ReactGA from "react-ga";
import { Provider } from "react-redux";

import mapReducer from "features/map_slice";
import { Game } from "components/game";

import { configureStore } from "@reduxjs/toolkit";

const store = configureStore({ reducer: mapReducer });

ReactDOM.render(<Provider store={store}><Game/></Provider>,
  document.getElementById("root"));

if (process.env.NODE_ENV !== "production") {
  console.log("Tiny King: development mode!");
}

ReactGA.initialize("UA-431118-26", {debug: process.env.NODE_ENV !== "production"});
