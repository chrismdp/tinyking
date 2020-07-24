import * as React from "react";
import { useSelector, useDispatch } from "react-redux";

import * as PIXI from "pixi.js";

import { getAllComponents,  getAllComponentsWithXY } from "features/entities_slice";
import { entityClicked } from "features/ui_slice";
import { Hex, HEX_SIZE } from "features/map_slice";

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

  const dispatch = useDispatch();

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
      graphics.position.set(point.x, point.y);

      switch(renderable.type) {
      case "hex": {
        graphics.beginFill(renderable.fill);
        graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
        graphics.drawPolygon(...hex.corners());
        graphics.endFill();
        break;
      }
      case "house": {
        graphics.beginFill(renderable.fill);
        graphics.lineStyle({color: "black", width: 2, alpha: 1});
        graphics.drawRect(-25, -30, 50, 35);
        graphics.endFill();
        break;
      }
      case "field": {
        graphics.beginFill(renderable.fill);
        graphics.lineStyle({color: "black", width: 2, alpha: 1});
        graphics.drawRect(-25, -30, 50, 50);
        graphics.endFill();
        break;
      }
      case "person": {
        const person = new PIXI.Graphics();
        person.position.set(-Math.cos(renderable.familyIndex * Math.PI * 2) * HEX_SIZE * 0.75, Math.sin(renderable.familyIndex * Math.PI * 2) * HEX_SIZE * 0.75);
        person.lineStyle({color: "black", width: 2, alpha: 1});
        person.beginFill(renderable.body);
        person.drawEllipse(0, 0, renderable.size * 0.55, renderable.size * 0.65);
        person.endFill();
        person.beginFill(renderable.hair);
        person.drawCircle(0, -renderable.size * 0.5, renderable.size * 0.5);
        person.endFill();
        graphics.addChild(person);
        break;
      }
      }

      if (!(renderable.layer in layers)) {
        layers[renderable.layer] = { layer: renderable.layer, container: new PIXI.Container() };
      }
      layers[renderable.layer].container.addChild(graphics);

      graphics.interactive = true;
      graphics.on("click", () => dispatch(entityClicked(renderable.id)));
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

  return (<div id="world" ref={containingDiv}></div>);
}
