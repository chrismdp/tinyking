// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
//import "regenerator-runtime/runtime";

import "./style.scss";

import React from "react";
import ReactDOM from "react-dom";

import * as Honeycomb from "honeycomb-grid";

import { World } from "./components/world";
import * as mapgen from "mapgen";

const seed = "1234567890"; // TODO: will obviously change this later
const mapRadius = 50;
const hexSize = 50;

const Hex = Honeycomb.extendHex({
  size: hexSize,
  orientation: "flat"
});

const Grid = Honeycomb.defineGrid(Hex);
const map = Grid.rectangle({width: mapRadius * 2, height: mapRadius * 2});
mapgen.generate(map, seed);

ReactDOM.render(
  <div id='game'>
    <World map={map}/>
    <h1 className='header'>Tiny King</h1>
    <div className='disclaimer'>Technical Demo.<br/>All features in very early stages and subject to change.<br/>Copyright (c) 2020 Think Code Learn Ltd t/a Revelation Games</div>
  </div>, document.getElementById("root"));
