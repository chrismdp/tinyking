import * as React from "react";
import PropTypes from "prop-types";
import { useSelector, useDispatch } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";

import * as PIXI from "pixi.js";

import { getAllComponents,  getAllComponentsWithXY } from "features/entities_slice";
import { entityClicked } from "features/ui_slice";
import { Hex, HEX_SIZE } from "features/map_slice";

import { Viewport } from "pixi-viewport";

const getAllRenderable = getAllComponents("renderable");
const getAllValuableXY = getAllComponentsWithXY("valuable");

const makeAllRenderablesAtKnownTiles = () => createSelector(
  getAllRenderable,
  (state, playerId) => playerId ? state.entities.components.playable[playerId].known : [],
  (renderables, known) => renderables.filter(r => known.some(k => k.x == r.x && k.y == r.y)));

const getAllWorkables = createSelector(getAllComponentsWithXY("workable"),
  workables => workables.reduce((result, w) => {
    const key = w.x + "," + w.y;
    if (!(key in result)) { result[key] = []; }
    w.actions.forEach(a => result[key].push({ id: w.id, action: a, hex: Hex(w.x, w.y) }));
    return result;
  }, {})
);

const entityMouseMove = e => {
  if (e.currentTarget.custom.clicking) {
    e.currentTarget.custom.data = e.data;
    e.currentTarget.custom.clicking = false;
    e.currentTarget.custom.parent.removeChild(e.currentTarget);
    e.currentTarget.custom.viewport.addChild(e.currentTarget);
    e.currentTarget.position = e.data.getLocalPosition(e.currentTarget.parent);
    e.currentTarget.custom.base.filters = [ new PIXI.filters.BlurFilter(4) ];
    e.currentTarget.custom.base.alpha = 1.0;
    e.currentTarget.custom.highlight.visible = true;
  }
  e.currentTarget.position = e.currentTarget.custom.data.getLocalPosition(e.currentTarget.parent);
};

const entityMouseDown = (viewport, highlight, base, targets, parent) => e => {
  e.currentTarget.custom = { viewport, base, targets, highlight, parent };
  e.currentTarget.custom.startPosition = { x: e.currentTarget.position.x, y: e.currentTarget.position.y };

  viewport.plugins.pause("drag");

  e.currentTarget.custom.clicking = true;
  e.currentTarget.on("mousemove", entityMouseMove);
  e.currentTarget.on("touchmove", entityMouseMove);
};

const entityMouseUp = (id, click, drop) => e => {
  if (e.currentTarget.custom.clicking) {
    click(id);
  } else {
    e.currentTarget.custom.base.alpha = 1.0;
    e.currentTarget.custom.base.filters = null;
    e.currentTarget.custom.highlight.visible = false;
    e.currentTarget.custom.viewport.removeChild(e.currentTarget);
    e.currentTarget.custom.parent.addChild(e.currentTarget);

    e.currentTarget.custom.targets.forEach(t => {
      const x = t.x - e.currentTarget.position.x;
      const y = t.y - e.currentTarget.position.y;
      const d2 = x * x + y * y;
      if (d2 < 12 * 12) {
        drop(t.id, t.action);
      }
    });
    // If leaving it there
    //e.currentTarget.position = e.data.getLocalPosition(e.currentTarget.parent);
    e.currentTarget.position = { ...e.currentTarget.custom.startPosition };
  }

  e.currentTarget.custom.viewport.plugins.resume("drag");
  e.currentTarget.off("mousemove", entityMouseMove);
  e.currentTarget.off("touchmove", entityMouseMove);
  delete e.currentTarget.custom;
};

export function World({ playerId }) {
  const containingDiv = React.useRef(null);
  const [app, setApp] = React.useState(null);
  const [viewport, setViewport] = React.useState(null);
  const debugLayer = useSelector(state => state.ui.debug.mapLayer);

  const getAllRenderableAtKnownTiles = React.useMemo(makeAllRenderablesAtKnownTiles, []);

  const renderables = useSelector(state => getAllRenderableAtKnownTiles(state, playerId));
  const workables = useSelector(getAllWorkables);
  const valuables = useSelector(getAllValuableXY);
  const width = useSelector(state => state.map.pointWidth);
  const height = useSelector(state => state.map.pointHeight);
  const playerStart = useSelector(state => state.map.playerStart);

  const dispatch = useDispatch();
  const click = React.useCallback((id) => dispatch(entityClicked(id)), [dispatch]);
  // TODO: turn this into a better event - there's a second 'action' param we can use.
  const drop = React.useCallback((id) => dispatch(entityClicked(id)), [dispatch]);

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
    if (!app) {
      return;
    }
    if (!playerStart) {
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

    console.log("create viewport", vp);

    app.stage.addChild(vp);

    const point = Hex(playerStart.x, playerStart.y).toPoint();

    vp.
      drag().
      wheel().
      pinch().
      clampZoom({minScale: 0.1, maxScale: 10}).
      clamp({direction: "all"}).
      zoomPercent(-0.5).
      moveCenter(point.x, point.y);

    setViewport(vp);

    return function cleanup() {
      console.log("Destroy old map viewport");
      vp.destroy({children: true});
      setViewport(null);
    };
  }, [app, width, height]);

  React.useEffect(() => {
    if (renderables.length == 0) {
      return;
    } else if (!app) {
      return;
    } else if (!viewport) {
      return;
    }

    console.log("rendering workables");

    var highlight = new PIXI.Container();
    var dropTargets = [];
    const keys = Object.keys(workables);
    for (i = 0; i < keys.length; i++) {
      const record  = workables[keys[i]];
      record.forEach((r, index) => {
        const angle = (index / record.length) * Math.PI * 2 - (Math.PI * 0.25);
        const point = r.hex.toPoint();
        const graphics = new PIXI.Graphics();
        graphics.position.set(point.x - Math.sin(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1), point.y + Math.cos(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1));
        graphics.lineStyle({color: 0xffffff, width: 8, alpha: 0.5});
        graphics.drawCircle(0, 0, 15);
        graphics.endFill();
        var text = new PIXI.Text(r.action.type.toUpperCase(), {fontFamily: "Raleway", fontSize: 12, fill: "white"});
        text.position.set(0, 30);
        text.anchor = { x: 0.5, y: 0.5 };
        graphics.addChild(text);
        highlight.addChild(graphics);
        dropTargets.push({
          x: graphics.position.x,
          y: graphics.position.y,
          id: r.id,
          action: r.action
        });
      });
    }
    highlight.visible = false;

    console.log("rendering landscape");

    var layers = {};
    var base = new PIXI.Container();

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
        person.position.set(-Math.cos(renderable.familyIndex * Math.PI * 2) * HEX_SIZE * 0.5, Math.sin(renderable.familyIndex * Math.PI * 2) * HEX_SIZE * 0.5);
        person.lineStyle({color: "black", width: 2, alpha: 1});
        person.beginFill(renderable.body);
        person.drawEllipse(0, 0, renderable.size * 0.55, renderable.size * 0.65);
        person.endFill();
        person.beginFill(renderable.hair);
        person.drawCircle(0, -renderable.size * 0.6, renderable.size * 0.5);
        person.endFill();

        person.lineStyle(null);
        person.beginFill(0xEACAAA);
        person.drawCircle(0, -renderable.size * 0.48, renderable.size * 0.35);
        person.endFill();

        graphics.addChild(person);

        person.interactive = true;
        person.on("mousedown", entityMouseDown(viewport, highlight, base, dropTargets, graphics));
        person.on("touchstart", entityMouseDown(viewport, highlight, base, dropTargets, graphics));
        person.on("mouseup", entityMouseUp(renderable.id, click, drop));
        person.on("mouseupoutside", entityMouseUp(renderable.id, click, drop));
        person.on("touchend", entityMouseUp(renderable.id, click, drop));
        person.on("touchendoutside", entityMouseUp(renderable.id, click, drop));

        break;
      }
      }

      if (!(renderable.layer in layers)) {
        layers[renderable.layer] = { layer: renderable.layer, container: new PIXI.Container() };
      }
      layers[renderable.layer].container.addChild(graphics);
    }

    const containers = Object.values(layers).sort((a, b) => a.layer - b.layer);
    containers.forEach(c => {
      base.addChild(c.container);
    });
    viewport.addChild(base);
    viewport.addChild(highlight);

    return function cleanup() {
      console.log("Destroy old layers");

      viewport.removeChild(base);
      base.destroy({children: true});
      viewport.removeChild(highlight);
      highlight.destroy({children: true});
    };
  }, [app, renderables, viewport]);

  React.useEffect(() => {
    if (renderables.length == 0) {
      return;
    } else if (!app) {
      return;
    } else if (!viewport) {
      return;
    }
    console.log("rendering debug layer");

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
  }, [app, valuables, viewport, debugLayer, renderables]);

  return (<div id="world" ref={containingDiv}></div>);
}

World.propTypes = {
  playerId: PropTypes.number
};
