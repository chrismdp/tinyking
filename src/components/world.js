import * as React from "react";
import { useSelector } from "react-redux";

import * as PIXI from "pixi.js";

import { Hex } from "sagas/map";

import { Viewport } from "pixi-viewport";

export function World() {
  const containingDiv = React.useRef(null);
  const [app, setApp] = React.useState(null);
  const [viewport, setViewport] = React.useState(null);
  const debugLayer = useSelector(state => state.ui.debug.mapLayer);

  const landscape = useSelector(state => state.map.landscape);
  const settlements = useSelector(state => state.map.settlements);
  const width = useSelector(state => state.map.pointWidth);
  const height = useSelector(state => state.map.pointHeight);

  React.useEffect(() => {
    console.log("creating app");
    let a = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      antialias: true,
      transparent: true,
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
    if (landscape.length == 0) {
      console.log("landscape not ready");
      return;
    } else if (!app) {
      console.log("app not ready");
      return;
    } else if (!viewport) {
      console.log("viewport not ready");
      return;
    }

    console.log("rendering landscape");

    const terrainColours = {
      "mountain": 0x3C3A44,
      "deep_water": 0x2F4999,
      "shallow_water": 0x3F6FAE,
      "grassland": 0x80C05D,
      "forest": 0x30512F,
      "stone": 0x5D7084,
    };

    var landscapeContainer = new PIXI.Container();

    // Add landscape to viewport
    landscape.forEach(tile => {
      const graphics = new PIXI.Graphics();

      const hex = Hex(tile.x, tile.y);
      const point = hex.toPoint();
      const corners = hex.corners().map(corner => corner.add(point));

      graphics.beginFill(terrainColours[tile.terrain]);
      graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
      graphics.drawPolygon(...corners);
      graphics.endFill();

      landscapeContainer.addChild(graphics);
    });

    settlements.forEach(tile => {
      const graphics = new PIXI.Graphics();
      const hex = Hex(tile.x, tile.y);
      const point = hex.toPoint();

      graphics.beginFill(tile.type == "house" ? 0x6C4332 : 0xE2C879);
      graphics.lineStyle({color: "black", width: 2, alpha: 1});
      graphics.drawRect(point.x - 25, point.y - 30, 50, 35);
      graphics.endFill();
      landscapeContainer.addChild(graphics);
    });

    viewport.addChild(landscapeContainer);

    return function cleanup() {
      console.log("Destroy old landscape");
      viewport.removeChild(landscapeContainer);
      landscapeContainer.destroy({children: true});
    };
  }, [app, landscape, settlements, viewport]);

  React.useEffect(() => {
    if (landscape.length == 0) {
      console.log("landscape not ready");
      return;
    } else if (!app) {
      console.log("app not ready");
      return;
    } else if (!viewport) {
      console.log("viewport not ready");
      return;
    }

    console.log("rendering debug layer");

    var container;

    if (debugLayer) {
      container = new PIXI.Container();

      landscape.forEach(tile => {
        const hex = Hex(tile.x, tile.y);
        const point = hex.toPoint();
        if (tile.economic_value) {
          if (tile.economic_value >= 25) {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0x0000cc);
            graphics.drawCircle(point.x, point.y, 25);
            graphics.endFill();
            container.addChild(graphics);
          }

          var text = new PIXI.Text("E" + tile.economic_value.toFixed(2), {fontSize: 12, fill: "white"});
          text.position = point;
          text.anchor = { x: 0.5, y: 0.5 };
          container.addChild(text);
        }
      });
      viewport.addChild(container);
    }

    return function cleanup() {
      if (container) {
        console.log("destroy old debug layer");
        viewport.removeChild(container);
        container.destroy({children: true});
      }
    };
  }, [app, landscape, viewport, debugLayer]);

  return (<div ref={containingDiv}></div>);
}
