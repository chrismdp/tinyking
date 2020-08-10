// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import ReactDOM from "react-dom";
import ReactGA from "react-ga";

import { World } from "components/world";

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDice } from "@fortawesome/free-solid-svg-icons";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
library.add(faDice, faTimes);

ReactDOM.render(<World/>, document.getElementById("root"));

if (process.env.NODE_ENV !== "production") {
  console.log("Tiny King: development mode!");
}

ReactGA.initialize("UA-431118-26", {debug: false});//process.env.NODE_ENV !== "production"});
