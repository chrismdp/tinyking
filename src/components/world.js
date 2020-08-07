import * as React from "react";
import PropTypes from "prop-types";
import { useSelector, useDispatch } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";

import * as PIXI from "pixi.js";

import { getEntity, assign, getAllComponents } from "features/entities_slice";
import { entityClicked } from "features/ui_slice";
import { Hex, HEX_SIZE } from "features/map_slice";

import { Viewport } from "pixi-viewport";

import { actions } from "data/actions";

// TODO: belongs in a playable slice
const getKnown = (state, playerId) => playerId ? state.entities.components.playable[playerId].known : [];
const filterByKnown = (list, known) => list.filter(e => known.some(k => k.x == e.spatial.x && k.y == e.spatial.y));

const mappablesAtKnownTiles = () => createSelector(
  getAllComponents("mappable", "spatial"),
  getKnown,
  filterByKnown);

const personablesAtKnownTiles = () => createSelector(
  getAllComponents("personable", "spatial"),
  getKnown,
  filterByKnown);

const habitablesAtKnownTiles = () => createSelector(
  getAllComponents("habitable", "spatial"),
  getKnown,
  filterByKnown);

const workablesAtKnownTiles = createSelector(
  getAllComponents("workable", "spatial"),
  getKnown,
  filterByKnown);

const makeAllActionsAtKnownTiles = () => createSelector(
  workablesAtKnownTiles,
  state => state,
  (workables, state) => workables.reduce((result, e) => {
    const entity = getEntity(e.spatial.id)(state);

    const key = e.spatial.x + "," + e.spatial.y;
    if (!(key in result)) { result[key] = []; }

    result[key] = [...result[key], ...Object.values(actions)
      .filter(a => ((a.needs || {}).terrain == (entity.mappable || {}).terrain))
      .map(a => ({
        id: e.spatial.id,
        action: a,
        hex: Hex(e.spatial.x, e.spatial.y)
      }))];
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
        drop(id, t);
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

  const getAllMappablesAtKnownTiles = React.useMemo(mappablesAtKnownTiles, [playerId]);
  const getAllPersonablesAtKnownTiles = React.useMemo(personablesAtKnownTiles, [playerId]);
  const getAllHabitablesAtKnownTiles = React.useMemo(habitablesAtKnownTiles, [playerId]);
  const getAllActionsAtKnownTiles = React.useMemo(makeAllActionsAtKnownTiles, [playerId]);

  const mappables = useSelector(state => getAllMappablesAtKnownTiles(state, playerId));
  const personables = useSelector(state => getAllPersonablesAtKnownTiles(state, playerId));
  const habitables = useSelector(state => getAllHabitablesAtKnownTiles(state, playerId));
  const possibleActions = useSelector(state => getAllActionsAtKnownTiles(state, playerId));
  const width = useSelector(state => state.map.pointWidth);
  const height = useSelector(state => state.map.pointHeight);
  const playerStart = useSelector(state => state.map.playerStart);

  const dispatch = useDispatch();
  const click = React.useCallback((id) => dispatch(entityClicked(id)), [dispatch]);
  // TODO: turn this into a better event - there's a second 'action' param we can use.
  const drop = React.useCallback((id, task) => dispatch(assign({ id, task })), [dispatch]);

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
    if (mappables.length == 0) {
      return;
    } else if (!app || !viewport) {
      return;
    }

    console.log("rendering mappables");

    var base = new PIXI.Container();

    const terrainColours = {
      "mountain": 0x3C3A44,
      "deep_water": 0x2F4999,
      "shallow_water": 0x3F6FAE,
      "grassland": 0x80C05D,
      "forest": 0x30512F,
      "stone": 0x5D7084,
    };

    // Add mappables to viewport
    for (var i = 0; i < mappables.length; i++) {
      const entity = mappables[i];
      const graphics = new PIXI.Graphics();
      const hex = Hex(entity.spatial.x, entity.spatial.y);
      const point = hex.toPoint();
      graphics.position.set(point.x, point.y);

      graphics.beginFill(terrainColours[entity.mappable.terrain]);
      graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
      graphics.drawPolygon(...hex.corners());
      graphics.endFill();

      base.addChild(graphics);
    }

    viewport.addChild(base);

    return function cleanup() {
      console.log("Destroy old mappables");

      viewport.removeChild(base);
      base.destroy({children: true});
    };
  }, [app, mappables, viewport]);

  React.useEffect(() => {
    if (habitables.length == 0) {
      return;
    } else if (!app || !viewport) {
      return;
    }

    console.log("rendering habitables");

    var base = new PIXI.Container();

    // Add habitables to viewport
    for (var i = 0; i < habitables.length; i++) {
      const entity = habitables[i];
      const graphics = new PIXI.Graphics();
      const hex = Hex(entity.spatial.x, entity.spatial.y);
      const point = hex.toPoint();
      graphics.position.set(point.x, point.y);

      graphics.beginFill(0x6C4332);
      graphics.lineStyle({color: "black", width: 2, alpha: 1});
      graphics.drawRect(-25, -30, 50, 35);
      graphics.endFill();

      base.addChild(graphics);
    }

    viewport.addChild(base);

    return function cleanup() {
      console.log("Destroy old habitables");

      viewport.removeChild(base);
      base.destroy({children: true});
    };
  }, [app, habitables, viewport]);

  React.useEffect(() => {
    if (personables.length == 0) {
      return;
    } else if (possibleActions.length == 0) {
      return;
    } else if (!app || !viewport) {
      return;
    }

    console.log("rendering possibleActions");

    var highlight = new PIXI.Container();
    var dropTargets = [];
    const keys = Object.keys(possibleActions);
    for (var i = 0; i < keys.length; i++) {
      const record  = possibleActions[keys[i]];
      record.forEach((r, index) => {
        const angle = (index / record.length) * Math.PI * 2 - (Math.PI * 0.25);
        const point = r.hex.toPoint();
        const graphics = new PIXI.Graphics();
        graphics.position.set(point.x - Math.sin(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1), point.y + Math.cos(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1));
        graphics.lineStyle({color: 0xffffff, width: 8, alpha: 0.5});
        graphics.drawCircle(0, 0, 15);
        graphics.endFill();
        var text = new PIXI.Text(r.action.name, {fontFamily: "Raleway", fontSize: 12, fill: "white"});
        text.position.set(0, 30);
        text.anchor = { x: 0.5, y: 0.5 };
        graphics.addChild(text);
        highlight.addChild(graphics);
        dropTargets.push({
          x: graphics.position.x,
          y: graphics.position.y,
          id: r.id,
          action: r.action,
          hex: { x: r.hex.x, y: r.hex.y },
        });
      });
    }
    highlight.visible = false;

    console.log("rendering personables");

    var base = new PIXI.Container();

    // Add personables to viewport
    for (i = 0; i < personables.length; i++) {
      const entity = personables[i];
      const personable = entity.personable;
      const graphics = new PIXI.Graphics();
      const hex = Hex(entity.spatial.x, entity.spatial.y);
      const point = hex.toPoint();
      graphics.position.set(point.x, point.y);

      const person = new PIXI.Graphics();
      person.position.set(-Math.cos(personable.familyIndex * Math.PI * 2) * HEX_SIZE * 0.5, Math.sin(personable.familyIndex * Math.PI * 2) * HEX_SIZE * 0.5);
      person.lineStyle({color: "black", width: 2, alpha: 1});
      person.beginFill(personable.body);
      person.drawEllipse(0, 0, personable.size * 0.55, personable.size * 0.65);
      person.endFill();
      person.beginFill(personable.hair);
      person.drawCircle(0, -personable.size * 0.6, personable.size * 0.5);
      person.endFill();

      person.lineStyle(null);
      person.beginFill(0xEACAAA);
      person.drawCircle(0, -personable.size * 0.48, personable.size * 0.35);
      person.endFill();

      graphics.addChild(person);

      person.interactive = true;
      person.on("mousedown", entityMouseDown(viewport, highlight, base, dropTargets, graphics));
      person.on("touchstart", entityMouseDown(viewport, highlight, base, dropTargets, graphics));
      person.on("mouseup", entityMouseUp(personable.id, click, drop));
      person.on("mouseupoutside", entityMouseUp(personable.id, click, drop));
      person.on("touchend", entityMouseUp(personable.id, click, drop));
      person.on("touchendoutside", entityMouseUp(personable.id, click, drop));

      base.addChild(graphics);
    }

    viewport.addChild(base);
    viewport.addChild(highlight);

    return function cleanup() {
      console.log("Destroy old personables and workables");

      viewport.removeChild(base);
      base.destroy({children: true});

      viewport.removeChild(highlight);
      highlight.destroy({children: true});
    };
  }, [app, possibleActions, personables, viewport]);

  return (<div id="world" ref={containingDiv}></div>);
}

World.propTypes = {
  playerId: PropTypes.number
};
