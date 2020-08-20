import * as React from "react";
import PropTypes from "prop-types";

import { createPopper } from "@popperjs/core";

import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

import Engine from "json-rules-engine-simplified";

import { Hex, HEX_SIZE, generateMap } from "game/map";
import { fullEntity } from "game/entities";
import { endTurn } from "game/turn";
import * as time from "game/time";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { Info } from "components/info";
import { PossibleAction } from "components/possible_action";

import { actions } from "data/actions";

const engine = new Engine(actions);

const DROP_RADIUS = 12;

const entityMouseMove = e => {
  if (e.currentTarget.custom.clicking) {
    e.currentTarget.custom.data = e.data;
    e.currentTarget.custom.clicking = false;
    e.currentTarget.custom.parent.removeChild(e.currentTarget);
    e.currentTarget.custom.state.pixi.viewport.addChild(e.currentTarget);
    e.currentTarget.position = e.data.getLocalPosition(e.currentTarget.parent);
    e.currentTarget.custom.base.filters = [ new PIXI.filters.BlurFilter(4) ];
    e.currentTarget.custom.base.alpha = 1.0;
    e.currentTarget.custom.state.pixi.highlight.visible = true;
  }
  e.currentTarget.position = e.currentTarget.custom.data.getLocalPosition(e.currentTarget.parent);

  var over = false;

  e.currentTarget.custom.state.pixi.dropTargets.forEach(t => {
    const x = t.x - e.currentTarget.position.x;
    const y = t.y - e.currentTarget.position.y;
    const d2 = x * x + y * y;
    if (d2 < DROP_RADIUS * DROP_RADIUS) {
      over = true;
      e.currentTarget.custom.setPopupEntity({
        possibleAction: {
          actorId: e.currentTarget.custom.parent.entityId,
          targetId: t.id,
          action: t.action
        }
      });
    }
  });
  if (!over) {
    e.currentTarget.custom.setPopupEntity(null);
  }
};

const entityMouseDown = (state, base, parent, setPopupEntity) => e => {
  e.currentTarget.custom = { state, base, parent, setPopupEntity };
  e.currentTarget.custom.startPosition = { x: e.currentTarget.position.x, y: e.currentTarget.position.y };

  state.pixi.viewport.plugins.pause("drag");

  e.currentTarget.custom.clicking = true;
  e.currentTarget.on("mousemove", entityMouseMove);
  e.currentTarget.on("touchmove", entityMouseMove);
};

const entityMouseUp = (id, click, drop, state) => e => {
  if (!e.currentTarget.custom) {
    return;
  }
  if (e.currentTarget.custom.clicking) {
    click(id);
  } else {
    e.currentTarget.custom.base.alpha = 1.0;
    e.currentTarget.custom.base.filters = null;
    e.currentTarget.custom.state.pixi.highlight.visible = false;
    e.currentTarget.custom.state.pixi.viewport.removeChild(e.currentTarget);
    e.currentTarget.custom.parent.addChild(e.currentTarget);

    var dropped = false;

    e.currentTarget.custom.state.pixi.dropTargets.forEach(t => {
      const x = t.x - e.currentTarget.position.x;
      const y = t.y - e.currentTarget.position.y;
      const d2 = x * x + y * y;
      if (d2 < DROP_RADIUS * DROP_RADIUS) {
        dropped = true;
        drop(id, t);
      }
    });
    e.currentTarget.position = dropped ? e.data.getLocalPosition(e.currentTarget.parent) : { ...e.currentTarget.custom.startPosition };
  }

  e.currentTarget.custom.state.pixi.viewport.plugins.resume("drag");
  e.currentTarget.off("mousemove", entityMouseMove);
  e.currentTarget.off("touchmove", entityMouseMove);
  delete e.currentTarget.custom;
  state.redraws.push(id);
};

const knownIds = (ecs, playerId) => {
  var result = [];
  for (const id in ecs.spatial) {
    for (const tile of ecs.playable[playerId].known) {
      if (ecs.spatial[id].x == tile.x && ecs.spatial[id].y == tile.y) {
        result.push(id);
        break;
      }
    }
  }
  return result;
};

const terrainColours = {
  "mountain": 0x3C3A44,
  "deep water": 0x2F4999,
  "shallow water": 0x3F6FAE,
  "grassland": 0x80C05D,
  "ploughed": 0x6C4332,
  "sown": 0x6C4332,
  "forest": 0x30512F,
  "stone": 0x5D7084,
};

const renderTile = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  const hex = Hex(ecs.spatial[id].x, ecs.spatial[id].y);
  const point = hex.toPoint();
  graphics.position.set(point.x, point.y);

  graphics.beginFill(terrainColours[ecs.mappable[id].terrain]);
  graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
  graphics.drawPolygon(...hex.corners());
  graphics.endFill();
  graphics.beginFill(0xe2c879);
  if (ecs.mappable[id].terrain == "sown") {
    for(var i = 0; i < 20; i++) {
      graphics.drawCircle(-HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, -HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, 3);
    }
  }
  graphics.endFill();
  //graphics.addChild(new PIXI.Text(ecs.spatial[id].x + "," + ecs.spatial[id].y, 0, 0));
  return graphics;
};

const renderBuilding = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  const hex = Hex(ecs.spatial[id].x, ecs.spatial[id].y);
  const point = hex.toPoint();
  graphics.position.set(point.x, point.y);

  graphics.beginFill(0x6C4332);
  graphics.lineStyle({color: "black", width: 2, alpha: 1});
  graphics.drawRect(-25, -30, 50, 35);
  graphics.endFill();
  return graphics;
};

const renderPerson = (ecs, id, fn) => {
  const personable = ecs.personable[id];
  const graphics = new PIXI.Graphics();
  const hex = Hex(ecs.spatial[id].x, ecs.spatial[id].y);
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

  if (ecs.assignable[id] && ecs.assignable[id].task) {
    person.beginFill(0x333333);
    person.drawRoundedRect(-30, 20, 60, 15, 5);
    person.endFill();
    var text = new PIXI.Text(ecs.assignable[id].task.action.name, {fontFamily: "Alegreya", fontSize: 10, fill: "white"});
    text.position.set(0, 27.5);
    text.anchor = { x: 0.5, y: 0.5 };
    person.addChild(text);
  }

  fn(person, graphics);

  graphics.addChild(person);
  return graphics;
};

const generateActions = async (state, known, playerId) => {
  if (state.pixi.highlight) {
    state.pixi.highlight.destroy({children: true});
  }

  const possibleActions = {};
  const tiles = known.reduce((o, id) => {
    if (state.ecs.spatial[id]) {
      const key = state.ecs.spatial[id].x + "," + state.ecs.spatial[id].y;
      if (!(key in o)) {
        o[key] = [];
      }
      o[key].push(fullEntity(state.ecs, id));
    }
    return o;
  }, {});

  const player = fullEntity(state.ecs, playerId);

  for (const coord in tiles) {
    for (const target of tiles[coord]) {
      if (target.workable) {
        const other = tiles[coord].filter(e => e.id != target.id);
        const season = time.season(state.clock);
        const events = await engine.run({ season, target, me: player, other });
        possibleActions[coord] = [...(possibleActions[coord] || []), ...events.map(action => ({
          id: target.id, action, hex: Hex(target.spatial.x, target.spatial.y)
        }))];
      }
    }
  }

  state.pixi.dropTargets = [];

  state.pixi.highlight = new PIXI.Container();

  const keys = Object.keys(possibleActions);
  for (var i = 0; i < keys.length; i++) {
    const record = possibleActions[keys[i]];
    record.forEach((r, index) => {
      const angle = (index / record.length) * Math.PI * 2 - (Math.PI * 0.25);
      const point = r.hex.toPoint();
      const graphics = new PIXI.Graphics();
      graphics.position.set(point.x - Math.sin(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1), point.y + Math.cos(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1));
      graphics.lineStyle({color: 0xffffff, width: 8, alpha: 0.5});
      graphics.drawCircle(0, 0, 15);
      graphics.endFill();
      var text = new PIXI.Text(r.action.name, {fontFamily: "Alegreya", fontSize: 12, fill: "white"});
      text.position.set(0, 30);
      text.anchor = { x: 0.5, y: 0.5 };
      graphics.addChild(text);
      state.pixi.highlight.addChild(graphics);
      state.pixi.dropTargets.push({
        x: graphics.position.x,
        y: graphics.position.y,
        id: r.id,
        action: r.action,
        hex: { x: r.hex.x, y: r.hex.y },
      });
    });
  }

  state.pixi.highlight.visible = false;
  state.pixi.viewport.addChild(state.pixi.highlight);
};

const renderMap = async (app, state, popupOver, setPopupEntity) => {
  app.stage.destroy({children: true});
  app.stage = new PIXI.Container();

  state.pixi = {};
  state.redraws = [];

  const width = state.map.pointWidth;
  const height = state.map.pointHeight;
  const playerStart = state.map.playerStart;

  const { ui, ecs, pixi } = state;

  pixi.viewport = new Viewport({
    screenWidth: app.view.offsetWidth,
    screenHeight: app.view.offsetHeight,
    worldWidth: width,
    worldHeight: height,
    passiveWheel: false,
    disableOnContextMenu: true
  });

  app.stage.addChild(pixi.viewport);

  const point = Hex(playerStart.x, playerStart.y).toPoint();

  pixi.viewport.
    drag().
    wheel().
    pinch().
    clampZoom({minScale: 0.1, maxScale: 10}).
    clamp({direction: "all"}).
    zoomPercent(-0.5).
    moveCenter(point.x, point.y);

  var layer = {
    tiles: new PIXI.Container(),
    buildings: new PIXI.Container(),
    people: new PIXI.Container(),
  };

  const known = knownIds(ecs, ui.playerId);

  var base = new PIXI.Container();

  state.redraws = [ ...known ];

  Object.values(layer).forEach(l => base.addChild(l));

  pixi.viewport.addChild(base);

  await generateActions(state, known, ui.playerId);

  app.ticker.add(() => {
    for (const id of state.redraws) {
      if (id in pixi) {
        pixi[id].destroy();
        delete pixi[id];
      }
      if (ecs.mappable[id]) {
        pixi[id] = renderTile(ecs, id);
        layer.tiles.addChild(pixi[id]);
      } else if (ecs.habitable[id]) {
        pixi[id] = renderBuilding(ecs, id);
        layer.buildings.addChild(pixi[id]);
      } else if (ecs.personable[id]) {
        pixi[id] = renderPerson(ecs, id, (person, parent) => {
          if (ecs.assignable[id]) {
            person.interactive = true;
            person.on("mousedown", entityMouseDown(state, base, parent, setPopupEntity));
            person.on("touchstart", entityMouseDown(state, base, parent, setPopupEntity));
            person.on("mouseup", entityMouseUp(id, ui.actions.click, ui.actions.drop, state));
            person.on("mouseupoutside", entityMouseUp(id, ui.actions.click, ui.actions.drop, state));
            person.on("touchend", entityMouseUp(id, ui.actions.click, ui.actions.drop, state));
            person.on("touchendoutside", entityMouseUp(id, ui.actions.click, ui.actions.drop, state));
          }
        });
        layer.people.addChild(pixi[id]);
      }
      pixi[id].entityId = id;
      pixi[id].interactive = true;
      pixi[id].on("mouseover", popupOver);
      pixi[id].on("touchstart", popupOver);
    }
    state.redraws = [];
  });
};

const virtualPosition = {
  x: 100,
  y: 100,
  getBoundingClientRect: function() {
    return { top: this.y, left: this.x, bottom: this.y, right: this.x, width: 0, height: 0 };
  },
  set: function(x, y) {
    this.x = x;
    this.y = y;
  }
};

export function World() {
  const stateContainer = React.useRef({});
  const state = stateContainer.current;

  // I'm aware you shouldn't render components imperatively, but because the
  // React code is a declarative shell around an imperative core, this is the
  // best way I can find to sync the UI.
  const [, render] = React.useState();
  const renderUI = React.useCallback(() => render({}), []);

  const containingDiv = React.useRef(null);

  const [popupEntity, setPopupEntity] = React.useState(null);
  const virtualReference = React.useRef(virtualPosition);
  const popperElement = React.useRef(null);
  const arrowElement = React.useRef(null);
  const popper = React.useRef(null);

  const popupOver = React.useCallback(event => {
    if (event.currentTarget.entityId) {
      setPopupEntity({info: event.currentTarget.entityId});

      const point = event.data.global;

      popper.current = createPopper(virtualReference.current, popperElement.current, {
        placement: (event.data.pointerType == "touch" ? "top" : "bottom-start"),
        modifiers: [
          { name: "arrow", options: { element: arrowElement.current } },
          { name: "offset", options: { offset: [-15, 20] } },
          { name: "preventOverflow" },
        ]
      });

      virtualReference.current.set(point.x, point.y);
      event.currentTarget.on("mousemove", popupMove);
      event.currentTarget.on("touchmove", popupMove);
      event.currentTarget.on("mouseout", popupOut);
      event.currentTarget.on("touchend", popupOut);
      event.currentTarget.on("touchendoutside", popupOut);
    }
  }, [popupMove, popupOut]);

  const popupMove = React.useCallback(event => {
    if (popper.current) {
      const point = event.data.global;
      virtualReference.current.set(point.x, point.y);
      popper.current.update();
    }
  }, []);

  const popupOut = React.useCallback(event => {
    if (event.currentTarget.entityId) {
      setPopupEntity(null);
      event.currentTarget.off("mousemove", popupMove);
      event.currentTarget.off("touchmove", popupMove);
      event.currentTarget.off("mouseout", popupOut);
      event.currentTarget.off("touchend", popupOut);
      event.currentTarget.off("touchendoutside", popupOut);
      popper.current = null;
    }
  }, [popupMove]);

  React.useEffect(() => {
    let app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      antialias: true,
      transparent: true,
      resolution: window.devicePixelRatio || 1,
      autoResize: true
    });

    state.ui = { ...state.ui, show: { main_menu: true }, actions: {
      drop: async (id, target) => {
        state.ecs.assignable[id].task = target;
        state.ecs.spatial[id].x = target.hex.x;
        state.ecs.spatial[id].y = target.hex.y;
        renderUI();
      },
      end_turn: async () => {
        endTurn(state);
        const known = knownIds(state.ecs, state.ui.playerId);
        await generateActions(state, known, state.ui.playerId);
        renderUI();
      },
      click: () => {
        // NOTE: For now we don't need clicking on entities - we show everything in the popup
        //state.ui.show.info = id;
        //renderUI();
      },
      change_visibility: action => {
        state.ui.show = { ...state.ui.show, ...action };
        renderUI();
      },
      close_window: (id) => {
        if (id == "mapgen") {
          state.ui.actions.start_game();
        }
        delete state.ui.show[id];
        renderUI();
      },
      custom_game: () => {
        state.ui.show.main_menu = false;
        state.ui.show.mapgen = true;
        renderUI();
      },
      start_game: () => {
        state.ui.show.main_menu = false;
        state.ui.show.tutorial = true;
        state.clock = 0;
        renderUI();
      },
      generate_map: async (seed) => {
        state.ecs = { nextId: 1 };
        state.pixi = {};
        state.ui.progress = { count: 0 };

        const results = await generateMap(state.ecs, seed, state.ui.actions.progress_update);
        state.map = results.map;
        state.ui.playerId = results.playerId;

        if (app.stage.children.length > 0) {
          app.stage.removeChildren();
        }

        await renderMap(app, state, popupOver, setPopupEntity);

        renderUI();
      },
      progress_update: async (label) => {
        state.ui.progress.label = label;
        state.ui.progress.count++;
        renderUI();
        return new Promise(resolve => setTimeout(resolve, 10));
      }
    } };

    containingDiv.current.appendChild(app.view);

    window.onresize = () => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    };

    (async () => {
      const seed =  Math.round(Math.random() * 10000000);
      await state.ui.actions.generate_map(seed);
    })();
  }, [renderUI, state, popupOver]);

  return (
    <div id="game">
      <div id="world" ref={containingDiv}></div>
      <GameState.Provider value={state}>
        <UserInterface/>
        <div className="popper" ref={popperElement} style={{...popper.styles, visibility: popupEntity ? "visible" : "hidden" }} {...popper.attributes}>
          {popupEntity && popupEntity.info &&
            (<Info entityId={popupEntity.info}/>)}
          {popupEntity && popupEntity.possibleAction &&
            (<PossibleAction actorId={popupEntity.possibleAction.actorId} targetId={popupEntity.possibleAction.targetId} action={popupEntity.possibleAction.action}/>) }
          <div className="arrow" ref={arrowElement}/>
        </div>
      </GameState.Provider>
    </div>
  );
}

World.propTypes = {
  playerId: PropTypes.number
};
