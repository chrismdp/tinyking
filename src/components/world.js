import * as React from "react";
import * as PIXI from "pixi.js";
import PropTypes from "prop-types";

import { Viewport } from "pixi-viewport";

export function World(props) {
  const [app, setApp] = React.useState(null);
  const container = React.useRef(null);

  const createApp = (view) => {
    console.log("Creating app");
    let result = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      view: view,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoResize: true
    });

    var viewport = new Viewport({
      screenWidth: result.view.offsetWidth,
      screenHeight: result.view.offsetHeight,
      worldWidth: props.map.pointWidth(),
      worldHeight: props.map.pointHeight(),
      passiveWheel: false,
      disableOnContextMenu: true
    });

    result.stage.addChild(viewport);

    viewport.
      drag().
      wheel().
      pinch().
      clampZoom({minScale: 0.1, maxScale: 1}).
      clamp({direction: "all"}).
      zoomPercent(-0.4).
      moveCenter(props.map.pointWidth() * 0.5, props.map.pointHeight() * 0.5);

    const terrainColours = {
      "mountain": 0x3C3A44,
      "water": 0x3F6FAE,
      "grassland": 0x80C05D,
      "forest": 0x30512F,
      "stone": 0x5D7084,
    };

    window.onresize = () => {
      result.renderer.resize(window.innerWidth, window.innerHeight);
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
    return result;
  };

  React.useLayoutEffect(() => {
    setApp(app || createApp(container.current));
    return function cleanup() {
      if (app) {
        app.destroy({children: true, texture: true, baseTexture: true});
      }
    };
  });

  return (<canvas ref={container}></canvas>);
}

World.propTypes = {
  map: PropTypes.array, // Actually a Honeycomb grid but close enough
};
