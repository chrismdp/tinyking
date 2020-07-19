import * as React from "react";
import * as PIXI from "pixi.js";
import PropTypes from "prop-types";

import { Hex } from "features/map_slice";

import { Viewport } from "pixi-viewport";

export function World({ map, width, height }) {
  const containingDiv = React.useRef(null);
  const [app, setApp] = React.useState(null);
  const [viewport, setViewport] = React.useState(null);

  React.useEffect(() => {
    console.log("creating app");
    let a = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoResize: true
    });

    containingDiv.current.appendChild(a.view);

    window.onresize = () => {
      a.renderer.resize(window.innerWidth, window.innerHeight);
    };
    setApp(a);

    return function cleanup() {
      if (app) {
        containingDiv.current.removeChild(app);
        app.destroy({children: true, texture: true, baseTexture: true});
      }
    };
  }, []);

  React.useEffect(() => {
    console.log("width/height changed");
    if (!app) {
      console.log("app not ready");
      return;
    }

    let vp = new Viewport({
      screenWidth: app.view.offsetWidth,
      screenHeight: app.view.offsetHeight,
      worldWidth: width,
      worldHeight: height,
      passiveWheel: false,
      disableOnContextMenu: true
    });

    console.log("viewport", vp);

    app.stage.addChild(vp);

    vp.
      drag().
      wheel().
      pinch().
      clampZoom({minScale: 0.1, maxScale: 1}).
      clamp({direction: "all"}).
      //zoomPercent(-0.4).
      moveCenter(width * 0.5, height * 0.5);

    setViewport(vp);

    return function cleanup() {
      console.log("Destroy old map viewport");
      vp.destroy({children: true});
      setViewport(null);
    };
  }, [app, width, height]);

  React.useEffect(() => {
    if (map.length == 0) {
      console.log("map not ready");
      return;
    } else if (!app) {
      console.log("app not ready");
      return;
    } else if (!viewport) {
      console.log("viewport not ready");
      return;
    }

    console.log("rendering map");

    const terrainColours = {
      "mountain": 0x3C3A44,
      "water": 0x3F6FAE,
      "grassland": 0x80C05D,
      "forest": 0x30512F,
      "stone": 0x5D7084,
    };

    var mapContainer = new PIXI.Container();

    // Add map to viewport
    map.forEach(tile => {
      const graphics = new PIXI.Graphics();

      const hex = Hex(tile.x, tile.y);
      const point = hex.toPoint();
      const corners = hex.corners().map(corner => corner.add(point));

      graphics.beginFill(terrainColours[tile.terrain]);
      graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
      graphics.drawPolygon(...corners);
      graphics.endFill();

      mapContainer.addChild(graphics);
    });

    viewport.addChild(mapContainer);

    return function cleanup() {
      console.log("Destroy old map");
      viewport.removeChild(mapContainer);
      mapContainer.destroy({children: true});
    };
  }, [app, map, viewport]);

  return (<div ref={containingDiv}></div>);
}

World.propTypes = {
  map: PropTypes.any.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired
};
