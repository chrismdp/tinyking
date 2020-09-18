import * as React from "react";
import PropTypes from "prop-types";

import { createPopper } from "@popperjs/core";
import TWEEN from "@tweenjs/tween.js";

import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

import Engine from "json-rules-engine-simplified";

import { useTranslate } from "react-polyglot";

import { Grid, Hex, HEX_SIZE, generateMap } from "game/map";
import { fullEntity } from "game/entities";
import { topController, anyControlledAlive } from "game/playable";
import { startJob, endTurn } from "game/turn";
import * as time from "game/time";
import { entitiesAtLocations } from "game/spatial";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { Info } from "components/info";
import { PossibleAction } from "components/possible_action";

import actions from "data/actions.json";

const engine = new Engine(actions);

const HIT_RADIUS = 22.5;

const selectEntity = (state, id, renderUI, t, setPopupEntity) => () => {
  if (!state.ecs.personable[id]) {
    return;
  }

  if (state.ui.show.main_menu) {
    state.ui.actions.start_game();
  }
  if (state.ui.show.selected_person) {
    state.redraws.push(state.ui.show.selected_person); // NOTE: Remove the selection indicators
  }
  state.ui.show.selected_person = id;
  renderUI();

  const entity = fullEntity(state.ecs, id);
  state.pixi.uiOverlay.removeChildren();

  var person = renderPerson(entity, null, t);
  person.scale.set(2.5, 2.5);
  person.position.set(175, state.pixi.viewport.screenHeight - 20);
  state.pixi.uiOverlay.addChild(person);
  state.redraws.push(id);

  // TODO: Assumes a hardcoded player
  const known = entitiesAtLocations(state.ecs, state.ecs.playable[state.ui.playerId].known);
  generateActions(state, known, id, t, setPopupEntity);
};

const terrainColours = {
  "mountain": 0x3C3A44,
  "deep water": 0x2F4999,
  "shallow water": 0x3F6FAE,
  "grassland": 0x80C05D,
  "ploughed": 0x6C4332,
  "sown": 0x6C4332,
  "growing": 0x6C4332,
  "harvestable": 0xE2C879,
  "dirt": 0x6C4332,
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
  graphics.beginFill(0xE2C879);
  if (ecs.mappable[id].terrain == "sown" || ecs.mappable[id].terrain == "growing") {
    for(var i = 0; i < (ecs.mappable[id].terrain == "sown" ? 20 : 80); i++) {
      graphics.drawCircle(-HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, -HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, 3);
    }
  }
  if (ecs.mappable[id].terrain == "dirt") {
    graphics.beginFill(0x000000);
    for(i = 0; i < 20; i++) {
      graphics.drawCircle(-HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, -HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, Math.random() * 7);
    }
    graphics.endFill();
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

const renderPerson = (entity, fn, t) => {
  const graphics = new PIXI.Graphics();
  const hex = Hex(entity.spatial.x, entity.spatial.y);
  const point = hex.toPoint();
  graphics.position.set(point.x, point.y);

  const person = new PIXI.Graphics();

  if (entity.personable.dead) {
    person.angle = 90;
  }
  person.hitArea = new PIXI.Circle(0, 0, HIT_RADIUS);
  person.position.set(entity.spatial.dx, entity.spatial.dy);
  person.lineStyle({color: "black", width: 2, alpha: 1});
  person.beginFill(entity.personable.body);
  person.drawEllipse(0, 0, entity.personable.size * 0.55, entity.personable.size * 0.65);
  person.endFill();
  person.beginFill(entity.personable.hair);
  person.drawCircle(0, -entity.personable.size * 0.6, entity.personable.size * 0.5);
  person.endFill();

  person.lineStyle(null);
  person.beginFill(0xEACAAA);
  person.drawCircle(0, -entity.personable.size * 0.48, entity.personable.size * 0.35);
  person.endFill();

  if (entity.assignable && entity.assignable.task) {
    person.beginFill(0x333333);
    person.drawRoundedRect(-30, 20, 60, 15, 5);
    person.endFill();
    var text = new PIXI.Text(t("action." + entity.assignable.task.action.key + ".name"), {fontFamily: "Alegreya", fontSize: 10, fill: "white"});
    text.position.set(0, 27.5);
    text.anchor = { x: 0.5, y: 0.5 };
    person.addChild(text);
  }

  if (fn) { fn(person, graphics); }

  graphics.addChild(person);
  return graphics;
};

const generateActions = async (state, known, actorId, t, setPopupEntity) => {
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

  const actor = fullEntity(state.ecs, actorId);
  const actorHex = Hex(actor.spatial.x, actor.spatial.y);
  const topId = topController(state.ecs, actor.id);
  const controller = topId && fullEntity(state.ecs, topId);

  const knownTiles = Object.keys(tiles);
  for (const coord in tiles) {
    const assignables = tiles[coord]
      .filter(e => e.assignable && e.assignable.task)
      .map(e => e.assignable);
    possibleActions[coord] = [];
    for (const target of tiles[coord]) {
      if (target.workable) {
        const other = tiles[coord].filter(e => e.id != target.id);
        const hex = Hex(target.spatial.x, target.spatial.y);

        const neighbours = Grid.hexagon({ radius: 1, center: hex })
          .map(n => n.x + "," + n.y);

        const payload = {
          season: time.season(state.clock),
          time_of_day: time.time(state.clock),
          distance: hex.distance(actorHex),
          neighbour_count: neighbours.filter(t => knownTiles.includes(t)).length - 1,
          me: actor,
          target,
          other,
          controller
        };

        const events = await engine.run(payload);
        const free = events.filter(action =>
          assignables
            .filter(a => a.id != actor.id && a.task.action.key == action.key)
            .length < (action.max || 1));
        possibleActions[coord] = [
          ...possibleActions[coord],
          ...free.map(action => ({ id: target.id, action, hex }))
        ];
      }
    }
  }

  state.pixi.highlight = new PIXI.Container();

  const keys = Object.keys(possibleActions);
  for (var i = 0; i < keys.length; i++) {
    const record = possibleActions[keys[i]];
    record.forEach((r, index) => {
      const angle = (index / record.length) * Math.PI * 2 - (Math.PI * 0.25);
      const point = r.hex.toPoint();
      const graphics = new PIXI.Graphics();
      graphics.position.set(point.x - Math.sin(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1), point.y + Math.cos(angle) * HEX_SIZE * 0.4 * Math.sign(record.length - 1));

      var text;
      graphics.hitArea = new PIXI.Circle(0, 0, HIT_RADIUS);
      graphics.interactive = true;

      if (actor.assignable.task && actor.assignable.task.action.key == r.action.key) {
        graphics.beginFill(0xDEF0A5, 0.5);
        graphics.drawCircle(0, 0, 15);
        graphics.endFill();
        text = new PIXI.Text(t("action.cancel"), {fontFamily: "Alegreya", fontSize: 12, fill: 0xDEF0A5});
        text.position.set(0, 30);
        text.anchor = { x: 0.5, y: 0.5 };

        graphics.addChild(text);
        graphics.hitArea = new PIXI.Circle(0, 0, HIT_RADIUS);

        graphics.on("click", () => { state.ui.actions.cancel_action(actorId); });
        graphics.on("tap", () => { state.ui.actions.cancel_action(actorId); });
      } else {
        graphics.beginFill(0xffffff, r.action.turns > 0 ? 0.5 : 0.75);
        graphics.drawCircle(0, 0, 15);
        graphics.endFill();

        if (r.action.turns > 0) {
          var turns = new PIXI.Text(r.action.turns, {fontFamily: "Alegreya", fontSize: 18, fill: "black", fontWeight: "bold"});
          turns.position.set(0, 0);
          turns.anchor = { x: 0.5, y: 0.5 };
          graphics.addChild(turns);
        }

        text = new PIXI.Text(t("action." + r.action.key + ".name"), {fontFamily: "Alegreya", fontSize: 12, fill: "white"});
        text.position.set(0, 30);
        text.anchor = { x: 0.5, y: 0.5 };
        graphics.addChild(text);

        const action = {
          x: graphics.position.x,
          y: graphics.position.y,
          id: r.id,
          action: r.action,
          hex: { x: r.hex.x, y: r.hex.y },
        };

        graphics.on("mouseover", () => setPopupEntity({
          possibleAction: { actorId, action: r.action, targetId: r.id }
        }));

        graphics.on("click", () => { state.ui.actions.drop(actorId, action); });
        graphics.on("tap", () => { state.ui.actions.drop(actorId, action); });
      }

      state.pixi.highlight.addChild(graphics);
    });
  }

  state.pixi.viewport.addChild(state.pixi.highlight);
};

const renderMap = async (app, state, popupOver, setPopupEntity, renderUI, t) => {
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
  pixi.uiOverlay = new PIXI.Container();
  app.stage.addChild(pixi.uiOverlay);

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

  const known = entitiesAtLocations(ecs, ecs.playable[ui.playerId].known);
  state.redraws = [ ...known ];

  pixi.base = new PIXI.Container();

  Object.values(layer).forEach(l => pixi.base.addChild(l));

  pixi.viewport.addChild(pixi.base);

  pixi.filters = {
    sunset: new PIXI.filters.ColorMatrixFilter(),
    night: new PIXI.filters.ColorMatrixFilter(),
    game_over: new PIXI.filters.ColorMatrixFilter()
  };
  pixi.base.filters = Object.values(pixi.filters);

  // See: https://github.com/pixijs/pixi.js/issues/4607
  const tint = 0xFFBA86;
  const r = tint >> 16 & 0xFF;
  const g = tint >> 8 & 0xFF;
  const b = tint & 0xFF;
  pixi.filters.sunset.matrix[0] = r / 255;
  pixi.filters.sunset.matrix[6] = g / 255;
  pixi.filters.sunset.matrix[12] = b / 255;
  pixi.filters.night.night(0.75);

  startTimeFilter(state.pixi, time.time(state.clock));

  app.ticker.add(() => {
    TWEEN.update();
  });

  app.ticker.add(() => {
    if (state.redraws.length > 0) {
      const known = entitiesAtLocations(state.ecs, state.ecs.playable[state.ui.playerId].known);
      for (const id of state.redraws) {
        if (!known.includes(id)) {
          continue;
        }
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
          const entity = fullEntity(ecs, id);
          const controlled = entity.personable.controller == state.ui.playerId;
          pixi[id] = renderPerson(entity, (person) => {
            if (state.ui.show.selected_person == id) {
              person.lineStyle({color: 0xff0000, width: 2, alpha: 1});
              person.moveTo(-25, -25);
              person.lineTo(-25, -30);
              person.lineTo(-20, -30);

              person.moveTo(20, -30);
              person.lineTo(25, -30);
              person.lineTo(25, -25);

              person.moveTo(25, 15);
              person.lineTo(25, 20);
              person.lineTo(20, 20);

              person.moveTo(-20, 20);
              person.lineTo(-25, 20);
              person.lineTo(-25, 15);
            }
            if (controlled && entity.assignable) {
              person.interactive = true;
              person.on("click", selectEntity(state, id, renderUI, t, setPopupEntity));
              person.on("tap", selectEntity(state, id, renderUI, t, setPopupEntity));
              if (!entity.assignable.task) {
                person.beginFill(0x990000, 0.75);
                person.drawCircle(15, -20, 4);
                person.endFill();
              }
            }
          }, t);
          layer.people.addChild(pixi[id]);
        }
        pixi[id].entityId = id;
        pixi[id].interactive = true;
        pixi[id].on("mouseover", popupOver);
        pixi[id].on("touchstart", popupOver);
      }
      state.redraws = [];
    }
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

function startTimeFilter(pixi, time_of_day) {
  const effect = {
    "morning": ({ sunset, night }, t) => {
      night.alpha = 0.5 - 0.5 * t;
      sunset.alpha = t * 0.5;
    },
    "afternoon": ({ sunset }, t) => {
      sunset.alpha = 0.5 - 0.5 * t;
    },
    "evening": ({ sunset }, t) => {
      sunset.alpha = t;
    },
    "night": ({ sunset, night }, t) => {
      sunset.alpha = 1 - t;
      night.alpha = 0.5 * t;
    }
  };
  const tweenValue = { time: 0 };
  new TWEEN.Tween(tweenValue)
    .to({ time: 1 }, 1500)
    .onUpdate(() => effect[time_of_day](pixi.filters, tweenValue.time))
    .start();
}

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
  const t = useTranslate();

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

    state.ui = { ...state.ui, show: { clock: true, main_menu: true }, actions: {
      drop: async (id, task) => {
        await startJob(state, id, task);
        const known = entitiesAtLocations(state.ecs, state.ecs.playable[state.ui.playerId].known);
        generateActions(state, known, id, t, setPopupEntity);
        renderUI();
      },
      cancel_action: (id) => {
        delete state.ecs.assignable[id].task;
        state.redraws.push(id);
        const known = entitiesAtLocations(state.ecs, state.ecs.playable[state.ui.playerId].known);
        generateActions(state, known, id, t, setPopupEntity);
        renderUI();
      },
      end_turn: async () => {
        await endTurn(state);
        if (anyControlledAlive(state.ecs, state.ui.playerId)) {
          startTimeFilter(state.pixi, time.time(state.clock));
          if (state.ui.show.selected_person) {
            const known = entitiesAtLocations(state.ecs, state.ecs.playable[state.ui.playerId].known);
            generateActions(state, known, state.ui.show.selected_person, t, setPopupEntity);
          }
        } else {
          state.ui.show.game_over = true;
          delete state.ui.show.next_action;
          const value = { s: 0 };
          new TWEEN.Tween(value)
            .to({ s: -1 }, 2500)
            .onUpdate(() => state.pixi.filters.game_over.saturate(value.s))
            .start();
        }
        renderUI();
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

        await renderMap(app, state, popupOver, setPopupEntity, renderUI, t);

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
  }, [renderUI, state, popupOver, t]);

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
