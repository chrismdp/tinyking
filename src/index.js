// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
//import "regenerator-runtime/runtime";

import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

import * as Honeycomb from "honeycomb-grid";

import "./style.scss";

import * as mapgen from "./mapgen";

let app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoResize: true
});

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

app.renderer.backgroundColor = 0x444444;
app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";

document.body.appendChild(app.view);
var viewport = new Viewport({
  screenWidth: app.view.offsetWidth,
  screenHeight: app.view.offsetHeight,
  worldWidth: map.pointWidth(),
  worldHeight: map.pointHeight(),
  passiveWheel: false,
  disableOnContextMenu: true
});

app.stage.addChild(viewport);
viewport.
  drag().
  wheel().
  pinch().
  clampZoom({minScale: 0.1, maxScale: 1}).
  clamp({direction: "all"}).
  zoomPercent(-0.9).
  moveCenter(map.pointWidth() * 0.5, map.pointHeight() * 0.5);

let message = new PIXI.Text("Tiny King", new PIXI.TextStyle({ fill: "white" }));
message.position.set(window.innerWidth * 0.5, 50);
message.anchor.x = 0.5;
app.stage.addChild(message);

let disclaimer = new PIXI.Text("Technical Demo.\nAll features in very early stages and subject to change.\nCopyright (c) 2020 Think Code Learn Ltd t/a Revelation Games", new PIXI.TextStyle({ fill: "white", fontSize: 9 }));
disclaimer.position.set(3, window.innerHeight - 3);
disclaimer.anchor.y = 1.0;
app.stage.addChild(disclaimer);

window.onresize = () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  message.position.set(window.innerWidth * 0.5, 50);
  disclaimer.position.set(3, window.innerHeight - 3);
};


const terrainColours = {
  "mountain": 0x3C3A44,
  "water": 0x3F6FAE,
  "grassland": 0x80C05D,
  "forest": 0x30512F,
  "stone": 0x5D7084,
};

// Render
map.forEach(hex => {
  const graphics = new PIXI.Graphics();

  const point = hex.toPoint();
  const corners = hex.corners().map(corner => corner.add(point));

  graphics.beginFill(terrainColours[hex.tile.terrain]);
  graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
  graphics.drawPolygon(...corners);
  graphics.endFill();

  viewport.addChild(graphics);
});
