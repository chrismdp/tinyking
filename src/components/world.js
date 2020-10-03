import * as React from "react";
import PropTypes from "prop-types";

import { createPopper } from "@popperjs/core";
import TWEEN from "@tweenjs/tween.js";

import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

import { useTranslate } from "react-polyglot";

import { Hex, HEX_SIZE, generateMap } from "game/map";
import { fullEntity } from "game/entities";
import { anyControlledAlive } from "game/playable";
import { endTurn } from "game/turn";
import * as time from "game/time";
import * as math from "game/math";
import * as htn from "game/htn";
import * as tasks from "game/tasks";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { Info } from "components/info";

const ROUTES_TO_FULL_PATH = 100;

const HIT_RADIUS = 22.5;

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
  "forest": 0x80C05D,
  "stone": 0x5D7084,
};

const renderLog = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);
  graphics.beginFill(0x6C4332);
  graphics.drawCircle(0, 0, 10);
  graphics.endFill();
  return graphics;
};

const renderTree = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);
  graphics.beginFill(0x30512F);
  const amount = ecs.workable[id].jobs
    .filter(a => a.yield == "wood")
    .reduce((total, a) => total + a.amount, 0);
  graphics.drawCircle(0, 0, HEX_SIZE * (0.1 + amount * 0.1));
  graphics.endFill();
  return graphics;
};

const renderTile = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);

  graphics.beginFill(terrainColours[ecs.mappable[id].terrain]);
  graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
  const corners = Hex().corners();
  graphics.drawPolygon(...corners);
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
  graphics.lineStyle();
  for (const key in ecs.mappable[id].worn) {
    const [ entrance, exit ] = key.split(",").map(i => +i);
    graphics.beginFill(terrainColours.dirt, Math.min(1.0, ecs.mappable[id].worn[key] / ROUTES_TO_FULL_PATH));
    graphics.drawPolygon([
      math.lerp(corners[entrance], corners[(entrance + 1) % 6], 0.25),
      math.lerp(corners[entrance], corners[(entrance + 1) % 6], 0.75),
      math.lerp(corners[exit], corners[(exit + 1) % 6], 0.25),
      math.lerp(corners[exit], corners[(exit + 1) % 6], 0.75)
    ]);
  }
  // NOTE: Debug for showing paths between hexes
  // if (ecs.walkable[id]) {
  //   graphics.beginFill(0xFF0000);
  //   Object.keys(ecs.walkable[id].neighbours).forEach(side => graphics.drawCircle(
  //     Math.sin(2 * Math.PI * ((+side + 2) % 6) / 6) * HEX_SIZE * 0.8,
  //     -Math.cos(2 * Math.PI * ((+side + 2) % 6) / 6) * HEX_SIZE * 0.8,
  //     5)
  //   );
  // }
  return graphics;
};

const GOLDEN_RATIO = 1.618034;

const renderBuilding = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);

  graphics.beginFill(0x6C4332);
  graphics.lineStyle({color: "black", width: 2, alpha: 1});
  const w = HEX_SIZE * 1.35;
  const h = w / GOLDEN_RATIO;
  graphics.drawRect(-w * 0.5, -h * 0.5, w, h);
  graphics.beginFill(0x000000);
  graphics.drawRect(-w * 0.15, h * 0.5 - 2, w * 0.3, 5);
  graphics.rotation = 2 * Math.PI * (ecs.habitable[id].side - 1) / 6;

  return graphics;
};

const renderPerson = (entity, fn, t) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(entity.spatial.x, entity.spatial.y);

  const person = new PIXI.Graphics();

  if (entity.personable.dead) {
    person.angle = 90;
  }
  person.hitArea = new PIXI.Circle(0, 0, HIT_RADIUS);
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

const renderMap = async (app, state, popupOver, setPopupInfo, renderUI, t) => {
  app.stage.destroy({children: true});
  app.stage = new PIXI.Container();

  state.pixi = {};
  state.redraws = [];

  const { width, height, playerStartTile } = state.map;

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

  const point = Hex(playerStartTile.x, playerStartTile.y).toPoint();

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
    stockpiles: new PIXI.Container(),
    people: new PIXI.Container(),
    buildings: new PIXI.Container(),
  };

  const known = ecs.playable[ui.playerId].known.map(k => state.space[Hex(k)]).flat();
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
    for (const id in state.ecs.planner) {
      const planner = state.ecs.planner[id];

      // Re-plan
      if (!planner.plan) {
        planner.task = null;
        planner.plan = htn.solve(planner.world, [ [ "person" ] ]);
      }
      // Process tasks
      if (planner.task) {
        const [name, ...args] = planner.task;
        if (!tasks[name](state, id, ...args)) {
          planner.task = null;
        }
      }
      while (!planner.task && planner.plan) {
        if (planner.plan.length > 0) {
          const task = planner.plan.shift();
          if (htn.execute(planner.world, task)) {
            planner.task = task;
            const [name, ...args] = task;
            if (!tasks[name]) {
              throw "Cannot find task to run " + name;
            }
            if (!tasks[name](state, id, ...args)) {
              planner.task = null;
            }
          }
        } else {
          planner.plan = null;
        }
      }
    }
  });

  app.ticker.add(() => {
    if (state.redraws.length > 0) {
      const known = state.ecs.playable[state.ui.playerId].known.map(k => state.space[Hex(k)]).flat();
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
        } else if (ecs.workable[id] && ecs.workable[id].jobs && ecs.workable[id].jobs.some(a => a.yield == "wood")) {
          pixi[id] = renderTree(ecs, id);
          layer.buildings.addChild(pixi[id]);
        } else if (ecs.haulable && ecs.haulable[id]) {
          pixi[id] = renderLog(ecs, id);
          layer.stockpiles.addChild(pixi[id]);
        } else if (ecs.habitable[id]) {
          pixi[id] = renderBuilding(ecs, id);
          layer.buildings.addChild(pixi[id]);
        } else if (ecs.personable[id]) {
          const entity = fullEntity(ecs, id);
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

            if (entity.assignable && !entity.assignable.task) {
              const text = new PIXI.Text("Zz", {fontFamily: "Alegreya", fontSize: 14, fill: "red"});
              text.position.set(18, -20);
              text.anchor = { x: 0.5, y: 0.5 };
              person.addChild(text);
            }
          }, t);
          layer.people.addChild(pixi[id]);
        } else {
          const entity = fullEntity(ecs, id);
          throw "Cannot render entity " + JSON.stringify(entity);
        }
        pixi[id].entityId = id;
        pixi[id].interactive = true;
        pixi[id].on("click", popupOver);
        pixi[id].on("tap", popupOver);
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

  const [popupInfo, setPopupInfo] = React.useState({});
  const virtualReference = React.useRef(virtualPosition);
  const popperElement = React.useRef(null);
  const arrowElement = React.useRef(null);
  const popper = React.useRef(null);
  const t = useTranslate();

  const popupOver = React.useCallback(event => {
    setPopupInfo(s => {
      if (s.id != event.currentTarget.entityId) {
        return { id: event.currentTarget.entityId, touch: event.data.pointerType == "touch" };
      } else {
        return {};
      }
    });
  }, [setPopupInfo]);

  React.useEffect(() => {
    if (popupInfo.id) {
      popper.current = createPopper(virtualReference.current, popperElement.current, {
        placement: (popupInfo.touch ? "top" : "bottom-start"),
        modifiers: [
          { name: "arrow", options: { element: arrowElement.current } },
          { name: "offset", options: { offset: [-15, 20] } },
          { name: "preventOverflow" },
        ]
      });

      const point = state.pixi[popupInfo.id].getGlobalPosition();
      virtualReference.current.set(point.x, point.y);
    } else {
      popper.current = null;
    }
  }, [state.pixi, popupInfo]);

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
      end_turn: async () => {
        await endTurn(state);
        if (anyControlledAlive(state.ecs, state.ui.playerId)) {
          startTimeFilter(state.pixi, time.time(state.clock));
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
      choose_job: (playerId, job, targetId) => {
        state.ecs.planner[playerId].world.jobs.push({ job, targetId });
        // NOTE: Force re-plan
        state.ecs.planner[playerId].plan = null;
        setPopupInfo({});
      },
      generate_map: async (seed) => {
        state.ecs = { nextId: 1 };
        state.pixi = {};
        state.ui.progress = { count: 0 };

        const results = await generateMap(state, seed, state.ui.actions.progress_update);
        state.map = results.map;
        state.ui.playerId = results.playerId;

        if (app.stage.children.length > 0) {
          app.stage.removeChildren();
        }

        await renderMap(app, state, popupOver, setPopupInfo, renderUI, t);

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
        <div className="popper" ref={popperElement} style={{...popper.styles, visibility: popupInfo.id ? "visible" : "hidden" }} {...popper.attributes}>
          {popupInfo.id && (<Info entityId={popupInfo.id}/>)}
          <div className="arrow" ref={arrowElement}/>
        </div>
      </GameState.Provider>
    </div>
  );
}

World.propTypes = {
  playerId: PropTypes.number
};
