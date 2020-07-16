// These are needed as soon as we want to transpile down to default browsers
//import "core-js/stable";
//import "regenerator-runtime/runtime";

import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

import * as Honeycomb from "honeycomb-grid";

import "./style.scss";

let app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoResize: true
});

app.renderer.backgroundColor = 0x444444;
app.renderer.view.style.position = "absolute";
app.renderer.view.style.display = "block";

document.body.appendChild(app.view);
var viewport = new Viewport({
  screenWidth: app.view.offsetWidth,
  screenHeight: app.view.offsetHeight,
  worldWidth: 5000,
  worldHeight: 5000,
  passiveWheel: false,
  disableOnContextMenu: true
});

app.stage.addChild(viewport);
viewport.
  drag().
  wheel().
  pinch().
  clampZoom({minScale: 0.2, maxScale: 1}).
  clamp({direction: "all"}).
  moveCenter(2500, 2500);

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

const Hex = Honeycomb.extendHex({
  size: 50,
  orientation: "flat"
});

const Grid = Honeycomb.defineGrid(Hex);
Grid.rectangle({width: 100, height: 100}).forEach(hex => {
  const graphics = new PIXI.Graphics();
  graphics.lineStyle({color: 0xffffff, width: 1, alpha: 0.25});

  const point = hex.toPoint();
  const corners = hex.corners().map(corner => corner.add(point));
  const [firstCorner, ...otherCorners] = corners;

  graphics.moveTo(firstCorner.x, firstCorner.y);
  otherCorners.forEach(({ x, y }) => graphics.lineTo(x, y));
  graphics.lineTo(firstCorner.x, firstCorner.y);

  viewport.addChild(graphics);
});
