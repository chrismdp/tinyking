// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
//import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import ReactDOM from "react-dom";

import { Game } from "components/game";

ReactDOM.render( <Game/> , document.getElementById("root"));
