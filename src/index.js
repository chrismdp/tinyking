// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
//import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import ReactDOM from "react-dom";

import { World } from "./components/world";

ReactDOM.render(<div>
  <World/>
</div>, document.getElementById("root"));
