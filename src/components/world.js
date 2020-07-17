import * as React from "react";
import * as PIXI from "pixi.js";

import { Viewport } from "pixi-viewport";

export function World(props) {
  const container = React.useRef(null);

  let app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoResize: true
  });
  console.log(app);

  app.renderer.backgroundColor = 0x444444;
  app.renderer.view.style.position = "absolute";
  app.renderer.view.style.display = "block";

  var viewport = new Viewport({
    screenWidth: app.view.offsetWidth,
    screenHeight: app.view.offsetHeight,
    worldWidth: props.map.pointWidth(),
    worldHeight: props.map.pointHeight(),
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
    moveCenter(props.map.pointWidth() * 0.5, props.map.pointHeight() * 0.5);

  let message = new PIXI.Text("Tiny King", new PIXI.TextStyle({ fill: "white" }));
  message.position.set(window.innerWidth * 0.5, 50);
  message.anchor.x = 0.5;
  app.stage.addChild(message);

  let disclaimer = new PIXI.Text("Technical Demo.\nAll features in very early stages and subject to change.\nCopyright (c) 2020 Think Code Learn Ltd t/a Revelation Games", new PIXI.TextStyle({ fill: "white", fontSize: 9 }));
  disclaimer.position.set(3, window.innerHeight - 3);
  disclaimer.anchor.y = 1.0;
  app.stage.addChild(disclaimer);

  const terrainColours = {
    "mountain": 0x3C3A44,
    "water": 0x3F6FAE,
    "grassland": 0x80C05D,
    "forest": 0x30512F,
    "stone": 0x5D7084,
  };

  window.onresize = () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    message.position.set(window.innerWidth * 0.5, 50);
    disclaimer.position.set(3, window.innerHeight - 3);
  };

  // Render
  props.map.forEach(hex => {
    const graphics = new PIXI.Graphics();

    const point = hex.toPoint();
    const corners = hex.corners().map(corner => corner.add(point));

    graphics.beginFill(terrainColours[hex.tile.terrain]);
    graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
    graphics.drawPolygon(...corners);
    graphics.endFill();

    viewport.addChild(graphics);
  });

  React.useEffect(() => {
    container.current.appendChild(app.view);
  });

  return (<div ref={container}></div>);
}
