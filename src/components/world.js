import * as React from "react";
import { useSelector } from "react-redux";

import * as PIXI from "pixi.js";

import { getAllComponents,  getAllComponentsWithXY } from "features/entities_slice";
import { Hex } from "features/map_slice";

import { Viewport } from "pixi-viewport";

const getAllRenderable = getAllComponents("renderable");
const getAllValuableXY = getAllComponentsWithXY("valuable");

export function World() {
  const containingDiv = React.useRef(null);
  const [app, setApp] = React.useState(null);
  const [viewport, setViewport] = React.useState(null);
  const debugLayer = useSelector(state => state.ui.debug.mapLayer);

  const renderables = useSelector(getAllRenderable);
  const valuables = useSelector(getAllValuableXY);
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
    console.log("rendering landscape");
    if (renderables.length == 0) {
      console.log("renderables not ready");
      return;
    } else if (!app) {
      console.log("app not ready");
      return;
    } else if (!viewport) {
      console.log("viewport not ready");
      return;
    }

    var layers = {};

    // Add landscape to viewport
    for (var i = 0; i < renderables.length; i++) {
      const renderable = renderables[i];
      const graphics = new PIXI.Graphics();
      const hex = Hex(renderable.x, renderable.y);
      const point = hex.toPoint();

      switch(renderable.type) {
      case "hex": {
        const corners = hex.corners().map(corner => corner.add(point));
        graphics.beginFill(renderable.fill);
        graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
        graphics.drawPolygon(...corners);
        graphics.endFill();
        break;
      }
      case "house": {
        graphics.beginFill(renderable.fill);
        graphics.lineStyle({color: "black", width: 2, alpha: 1});
        graphics.drawRect(point.x - 25, point.y - 30, 50, 35);
        graphics.endFill();
        break;
      }
      case "field":
        graphics.beginFill(renderable.fill);
        graphics.lineStyle({color: "black", width: 2, alpha: 1});
        graphics.drawRect(point.x - 25, point.y - 30, 50, 50);
        graphics.endFill();
        break;
      }

      if (!(renderable.layer in layers)) {
        layers[renderable.layer] = { layer: renderable.layer, container: new PIXI.Container() };
      }
      layers[renderable.layer].container.addChild(graphics);
    }

    const containers = Object.values(layers).sort((a, b) => a.layer - b.layer);
    containers.forEach(c => {
      viewport.addChild(c.container);
    });

    return function cleanup() {
      console.log("Destroy old containers");
      containers.forEach(c => {
        viewport.removeChild(c.container);
        c.container.destroy({children: true});
      });
    };
  }, [app, renderables, viewport]);

  React.useEffect(() => {
    console.log("rendering debug layer");
    if (renderables.length == 0) {
      console.log("renderables not ready");
      return;
    } else if (!app) {
      console.log("app not ready");
      return;
    } else if (!viewport) {
      console.log("viewport not ready");
      return;
    }

    var container;

    if (debugLayer) {
      container = new PIXI.Container();

      for (var i = 0; i < valuables.length; i++) {
        const valuable = valuables[i];
        if (valuable.value && valuable.x && valuable.y) {
          const hex = Hex(valuable.x, valuable.y);
          const point = hex.toPoint();
          if (valuable.value >= 25) {
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0x0000cc);
            graphics.drawCircle(point.x, point.y, 25);
            graphics.endFill();
            container.addChild(graphics);
          }

          var text = new PIXI.Text("E" + valuable.value.toFixed(2), {fontSize: 12, fill: "white"});
          text.position = point;
          text.anchor = { x: 0.5, y: 0.5 };
          container.addChild(text);
        }
      }
      viewport.addChild(container);
    }

    return function cleanup() {
      if (container) {
        console.log("destroy old debug layer");
        viewport.removeChild(container);
        container.destroy({children: true});
      }
    };
  }, [app, valuables, viewport, debugLayer]);

  return (<div ref={containingDiv}></div>);
}
