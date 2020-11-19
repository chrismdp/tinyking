import * as React from "react";

import { createPopper } from "@popperjs/core";
import TWEEN from "@tweenjs/tween.js";

import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

import { useTranslate } from "react-polyglot";

import { Hex, generateMap } from "game/map";
import { topController, anyControlledAlive } from "game/playable";
import * as time from "game/time";
import * as htn from "game/htn";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { Info } from "components/info";
import { pushJob, removeJob, jobQueueFor } from "game/manager";

import * as render from "pixi/render";

import fogSprite from "assets/fogSprite.png";
import crops from "data/crops.json";

const SPEED = {
  paused: 0,
  normal: 360,
  fast: 3600
};

const renderMap = (app, state, popupOver, setPopupInfo, renderUI, t) => {
  app.stage.destroy({children: true});
  app.stage = new PIXI.Container();

  state.fog = {};
  state.fogTexture = PIXI.Texture.from(fogSprite);
  state.redraws = [];

  const { width, height, playerStartTile } = state.map;

  const { pixi } = state;

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

  let layer = {
    tiles: new PIXI.Container(),
    stockpiles: new PIXI.Container(),
    haulable: new PIXI.Container(),
    people: new PIXI.Container(),
    buildings: new PIXI.Container(),
    fog: new PIXI.Container(),
  };

  state.redraws = Array.from({length: state.ecs.nextId - 1}, (v, i) => "" + (i + 1));

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

  state.pixi.ticker.add(() => {
    TWEEN.update();
  });

  state.pixi.ticker.add(frameMod => {
    if (SPEED[state.game_speed] == 0) {
      return;
    }

    for (const id in state.ecs.planner) {
      const planner = state.ecs.planner[id];

      // Update sensors
      if (state.ecs.personable[id]) {
        const person = state.ecs.personable[id];
        if (!planner.world.feeling.tired && person.tiredness > 0.9) {
          planner.world.feeling.tired = true;
          htn.replan(planner);
        }
        if (!planner.world.feeling.hungry && person.hunger > 0.9) {
          planner.world.feeling.hungry = true;
          htn.replan(planner);
        }
      }

      // Re-plan
      if (!planner.plan) {
        if (planner.task) {
          htn.finishTask(planner, planner.task);
        }
        const jobs = jobQueueFor(state.ecs, planner.id);
        const [ plan ] = htn.solve(planner.world, jobs, [ [ "person" ] ]);
        planner.plan = plan;
        if (topController(state.ecs, planner.id) == state.ui.playerId) {
          console.log("PLANNER:" , planner.id, JSON.stringify(planner.plan));
          if (!planner.plan) {
            throw "no plan";
          }
        }
      }
      // Process tasks
      const dt = deltaTime(frameMod, SPEED[state.game_speed]);
      if (planner.task) {
        htn.runTask(state, planner, dt, false);
      }
      while (!planner.task && planner.plan) {
        if (planner.plan.length > 0) {
          planner.task = planner.plan.shift();
          if (topController(state.ecs, planner.id) == state.ui.playerId) {
            console.log("NEW TASK", planner.id, planner.task);
          }
          htn.runTask(state, planner, dt, true);
          // TODO: Make sure this happens only once
          state.redraws.push(planner.id);
        } else {
          htn.replan(planner);
        }
      }
    }
  });

  const SECONDS_PER_FRAME = 1 / 60;
  const DAYS = 86400;

  const deltaTime = (frameMod, speed) => frameMod * SECONDS_PER_FRAME * (speed || 0) / DAYS;

  let hour = 0;
  state.pixi.ticker.add((frameMod) => {
    if (SPEED[state.game_speed]) {
      const toAdd = deltaTime(frameMod, SPEED[state.game_speed]);
      state.days += toAdd;
      hour += toAdd;
      if (hour > time.HOUR) {
        hour -= time.HOUR;

        // FIXME: This potentially leads to frame spikes each hour
        for (const id in state.ecs.planner) {
          const planner = state.ecs.planner[id];
          planner.world.days = state.days;
        }

        for (const id in state.ecs.personable) {
          const person = state.ecs.personable[id];
          person.tiredness += time.HOUR;
          person.hunger += time.HOUR;
        }

        if (state.ecs.farmable) {
          for (const id in state.ecs.farmable) {
            for (const slot of state.ecs.farmable[id].slots) {
              if (slot.content) {
                state.redraws.push(id);

                const age = state.days - slot.updated;
                if (age > crops[slot.content].growingTime) {
                  slot.state = "harvestable";
                  slot.amount = crops[slot.content].harvestableAmount;
                }
              }
            }
          }
        }
        renderUI();
      }
    }
    timeFilter(state.pixi, state.days);
  });

  state.pixi.ticker.add(() => {
    if (state.redraws.length > 0) {
      const known = state.ecs.playable[state.ui.playerId].known.map(k => state.space[Hex(k)]).flat().filter(e => state.ecs.mappable[e]);
      for (const id of state.redraws) {
        if (pixi[id]) {
          for (const displayObject of pixi[id]) {
            displayObject.destroy();
          }
          pixi[id] = [];
        }
        let result = render.entity(state, id, t, false);
        if (!Array.isArray(result[0])) {
          result = [ result ];
        }
        result.forEach(([chosenLayer, displayObject]) => {
          if (chosenLayer && displayObject) {
            if (!pixi[id]) {
              pixi[id] = [];
            }

            pixi[id].push(displayObject);
            layer[chosenLayer].addChild(displayObject);

            if (state.ecs.mappable[id] && !known.includes(id)) {
              if (!state.fog[id]) {
                state.fog[id] = new PIXI.Sprite(state.fogTexture);
                state.fog[id].position.set(state.ecs.spatial[id].x, state.ecs.spatial[id].y);
                state.fog[id].anchor.set(0.5, 0.5);
                layer.fog.addChild(state.fog[id]);
              }
            } else if (state.fog[id]) {
              layer.fog.removeChild(state.fog[id]);
              delete state.fog[id];
            }
          }

          if (displayObject && !state.fog[id]) {
            displayObject.entityId = id;
            displayObject.interactive = true;
            displayObject.on("click", popupOver);
            displayObject.on("touchstart", () => displayObject.maybeSelect = true);
            displayObject.on("touchmove", () => displayObject.maybeSelect = false);
            displayObject.on("touchend", e => displayObject.maybeSelect && popupOver(e));
          }
        });
        state.redraws = [];
      }
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

const MAX_NIGHT = 0.5;
function timeFilter(pixi, days) {
  const hour = time.hour_of_day(days);
  if (hour > 22 || hour <= 5) {
    pixi.filters.night.alpha = MAX_NIGHT;
    pixi.filters.sunset.alpha = 0;
  } else if (hour <= 7) {
    const t = (hour - 5) / 2;
    pixi.filters.night.alpha = MAX_NIGHT - MAX_NIGHT * t;
    pixi.filters.sunset.alpha = t * 0.5;
  } else if (hour <= 10) {
    const t = (hour - 7) / 3;
    pixi.filters.night.alpha = 0;
    pixi.filters.sunset.alpha = 0.5 - 0.5 * t;
  } else if (hour <= 18) {
    pixi.filters.night.alpha = 0;
    pixi.filters.sunset.alpha = 0;
  } else if (hour <= 20) {
    const t = (hour - 18) / 2;
    pixi.filters.night.alpha = 0;
    pixi.filters.sunset.alpha = t;
  } else if (hour <= 22) {
    const t = (hour - 20) / 2;
    pixi.filters.sunset.alpha = 1 - t;
    pixi.filters.night.alpha = MAX_NIGHT * t;
  }
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

  const selectEntity = React.useCallback((id, touch) => {
    setPopupInfo(s => (s.id != id) ? { id, touch } : {});
  }, [setPopupInfo]);

  const popupOver = React.useCallback(event => {
    selectEntity(event.currentTarget.entityId, event.data.pointerType == "touch");
  }, [selectEntity]);

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

      // NOTE: we use the first display object associated with this entity
      const point = state.pixi[popupInfo.id][0].getGlobalPosition();
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
        // TODO: move to realtime check
        if (!anyControlledAlive(state.ecs, state.ui.playerId)) {
          state.ui.show.game_over = true;
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
      set_speed: (speedClass) => {
        state.game_speed = speedClass;
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
        state.game_speed = "paused";
        state.ui.show.main_menu = false;
        state.ui.show.mapgen = true;
        renderUI();
      },
      start_game: () => {
        state.ui.show.main_menu = false;
        // TODO: Re-do the tutorial when there's more to show
        state.ui.show.tutorial = false;
        state.ui.show.clock = true;
        state.ui.show.speed_controls = true;
        renderUI();
      },
      choose_job: (playerId, job, targetId) => {
        pushJob(state.ecs, playerId, { job, targetId });
        // NOTE: For now, we replan anyone in our team who is not in a job
        for (const id in state.ecs.planner) {
          const planner = state.ecs.planner[id];
          if (!planner.world.currentJob && topController(state.ecs, id) == playerId) {
            htn.replan(planner);
          }
        }
        setPopupInfo({});
      },
      cancel_job: (managerId, key, targetId) => {
        const assignedId = removeJob(state.ecs, managerId, key, targetId);
        const planner = state.ecs.planner[assignedId];
        if (planner) {
          planner.world.currentJob = null;
          htn.replan(planner);
        }
        setPopupInfo({});
      },
      select_entity: (id, touch) => {
        selectEntity(id, touch);
      },
      generate_map: async (seed) => {
        state.ecs = { nextId: 1 };
        if (state.pixi && state.pixi.ticker) {
          state.pixi.ticker.stop();
          state.pixi.ticker.destroy();
        }
        state.pixi = {};
        state.pixi.ticker = new PIXI.Ticker();
        state.pixi.ticker.start();

        state.ui.progress = { count: 0 };
        state.game_speed = "normal";
        state.days = 0.375;

        const results = await generateMap(state, seed, state.ui.actions.progress_update);
        state.map = results.map;
        state.ui.playerId = results.playerId;

        if (app.stage.children.length > 0) {
          app.stage.removeChildren();
        }

        renderMap(app, state, popupOver, setPopupInfo, renderUI, t);

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
  }, [renderUI, state, selectEntity, popupOver, t]);

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
