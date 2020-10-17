import * as React from "react";

import { createPopper } from "@popperjs/core";
import TWEEN from "@tweenjs/tween.js";

import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";

import { useTranslate } from "react-polyglot";

import { Hex, InnerHex, HEX_SIZE, generateMap, triangleCenters, TRIANGLE_INTERIOR_RADIUS } from "game/map";
import { fullEntity } from "game/entities";
import { topController, anyControlledAlive } from "game/playable";
import * as time from "game/time";
import * as math from "game/math";
import * as htn from "game/htn";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { Info } from "components/info";
import { jobQueueFor } from "game/manager";

import fogSprite from "assets/fogSprite.png";

const ROUTES_TO_FULL_PATH = 100;

const HIT_RADIUS = 22.5;

const SPEED = {
  paused: 0,
  normal: 360,
  fast: 3600
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
  "forest": 0x80C05D,
  "stone": 0x5D7084,
};

const itemColours = {
  "wood": terrainColours.dirt,
  "grain": terrainColours.harvestable
};

const renderItem = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);
  graphics.beginFill(itemColours[ecs.good[id].type]);
  graphics.drawCircle(0, 0, 10);
  graphics.endFill();
  return graphics;
};

const renderStockpile = (state, id, t) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(state.ecs.spatial[id].x, state.ecs.spatial[id].y);
  graphics.beginFill(terrainColours.stone, 0.25);
  graphics.drawPolygon(InnerHex().corners());
  graphics.endFill();
  let text = new PIXI.Text(state.ecs.holder[id].capacity, {fontFamily: "Alegreya", fontSize: 20, fill: "white"});
  text.anchor = { x: 0.5, y: 0.5 };
  graphics.addChild(text);

  const space = state.space[Hex().fromPoint(state.ecs.spatial[id])];
  const drawDebug = false;
  if (drawDebug) {
    triangleCenters({x: 0, y: 0}).forEach(p => {
      const occupied = space.some(e =>
        state.ecs.haulable && state.ecs.haulable[e] &&
        e != id &&
        math.squaredDistance({x: p.x + state.ecs.spatial[id].x, y: p.y + state.ecs.spatial[id].y}, state.ecs.spatial[e]) <
        TRIANGLE_INTERIOR_RADIUS * TRIANGLE_INTERIOR_RADIUS);
      graphics.beginFill(occupied ? 0xff0000 : 0x00ff00);
      graphics.drawCircle(p.x, p.y, TRIANGLE_INTERIOR_RADIUS * 1.25);
    });
  }

  if (state.ecs.holder[id]) {
    state.ecs.holder[id].held.forEach(itemId => {
      const [, item] = renderEntity(state, itemId, t, true);
      item.position.set(
        item.position.x - state.ecs.spatial[id].x,
        item.position.y - state.ecs.spatial[id].y
      );
      graphics.addChild(item);
    });
  }

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
    for(let i = 0; i < (ecs.mappable[id].terrain == "sown" ? 20 : 80); i++) {
      graphics.drawCircle(-HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, -HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, 3);
    }
  }
  if (ecs.mappable[id].terrain == "dirt") {
    graphics.beginFill(0x000000);
    for(let i = 0; i < 20; i++) {
      graphics.drawCircle(-HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, -HEX_SIZE * 0.5 + Math.random() * HEX_SIZE, Math.random() * 7);
    }
    graphics.endFill();
  }
  graphics.endFill();
  graphics.lineStyle();
  for (const key in ecs.mappable[id].worn) {
    const [ entrance, exit ] = key.split(",").map(i => i == "C" ? "C" : +i);
    graphics.beginFill(terrainColours.dirt, Math.min(1.0, ecs.mappable[id].worn[key] / ROUTES_TO_FULL_PATH));
    const center = { x: 0, y: 0 };
    const line = {
      entrance: [
        entrance != "C" ? corners[entrance] : center,
        entrance != "C" ? corners[(entrance + 1) % 6] : center
      ],
      exit: [
        exit != "C" ? corners[exit] : center,
        exit != "C" ? corners[(exit + 1) % 6] : center
      ]
    };
    graphics.drawPolygon([
      math.lerp(...line.entrance, 0.25),
      math.lerp(...line.entrance, 0.75),
      math.lerp(...line.exit, 0.25),
      math.lerp(...line.exit, 0.75),
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
  graphics.rotation = 2 * Math.PI * (ecs.building[id].entrance - 1) / 6;

  return graphics;
};

const renderPerson = (state, entity, fn, t) => {
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

  if (entity.planner) {
    if (topController(state.ecs, entity.id) == state.ui.playerId) {
      person.beginFill(0x993333);
      person.drawCircle(18, -20, 5);
    } else {
      person.beginFill(0x333333);
    }

    if (entity.planner.world.label) {
      person.drawRoundedRect(-30, 20, 60, 15, 5);
      person.endFill();
      let text = new PIXI.Text(t("tasks." + entity.planner.world.label), {fontFamily: "Alegreya", fontSize: 10, fill: "white"});
      text.position.set(0, 27.5);
      text.anchor = { x: 0.5, y: 0.5 };
      person.addChild(text);
    }
  }

  if (fn) { fn(person, graphics); }

  if (entity.holder) {
    entity.holder.held.forEach((id, idx) => {
      const [, item] = renderEntity(state, id, t, true);
      item.position.set(-5 + idx * 10, 0);
      person.addChild(item);
    });
  }

  graphics.addChild(person);
  return graphics;
};

const renderEntity = (state, id, t, heldObjects) => {
  // NOTE: Do nothing - we don't render these yet.
  if (state.ecs.interior[id]) {
    return [];
  }

  if (state.ecs.mappable[id]) {
    return ["tiles", renderTile(state.ecs, id)];
  }

  if (state.ecs.workable[id] && state.ecs.workable[id].jobs && state.ecs.workable[id].jobs.some(a => a.yield == "wood")) {
    return ["buildings", renderTree(state.ecs, id)];
  }

  if (state.ecs.haulable && state.ecs.haulable[id]) {
    if (heldObjects || !state.ecs.haulable[id].heldBy) {
      return ["stockpiles", renderItem(state.ecs, id)];
    } else {
      return [];
    }
  }

  if (state.ecs.building[id]) {
    return ["buildings", renderBuilding(state.ecs, id)];
  }

  if (state.ecs.personable[id]) {
    const entity = fullEntity(state.ecs, id);
    return ["people", renderPerson(state, entity, (person) => {
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
    }, t)];
  }

  if (state.ecs.stockpile[id]) {
    return ["stockpiles", renderStockpile(state, id, t)];
  }

  const entity = fullEntity(state.ecs, id);
  throw "Cannot render entity heldObjects is " + heldObjects + ":" + JSON.stringify(entity);
};

const renderMap = async (app, state, popupOver, setPopupInfo, renderUI, t) => {
  app.stage.destroy({children: true});
  app.stage = new PIXI.Container();

  state.pixi = {};
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

  app.ticker.add(() => {
    TWEEN.update();
  });

  app.ticker.add(frameMod => {
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
        planner.plan = htn.solve(planner.world, jobs, [ [ "person" ] ]);
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
  app.ticker.add((frameMod) => {
    if (SPEED[state.game_speed]) {
      const toAdd = deltaTime(frameMod, SPEED[state.game_speed]);
      state.days += toAdd;
      hour += toAdd;
      if (hour > time.HOUR) {
        hour -= time.HOUR;

        // FIXME: This potentially leads to frame spikes each hour
        for (const id in state.ecs.planner) {
          const planner = state.ecs.planner[id];
          planner.world.hour = time.hour_of_day(state.days);
          planner.world.time_of_day = time.time(state.days);
        }

        for (const id in state.ecs.personable) {
          const person = state.ecs.personable[id];
          person.tiredness += time.HOUR;
          person.hunger += time.HOUR;
        }
        renderUI();
      }
    }
    timeFilter(state.pixi, state.days);
  });

  app.ticker.add(() => {
    if (state.redraws.length > 0) {
      const known = state.ecs.playable[state.ui.playerId].known.map(k => state.space[Hex(k)]).flat().filter(e => state.ecs.mappable[e]);
      for (const id of state.redraws) {
        if (id in pixi) {
          pixi[id].destroy();
          delete pixi[id];
        }
        const [chosenLayer, displayObject] = renderEntity(state, id, t, false);
        if (chosenLayer && displayObject) {
          pixi[id] = displayObject;
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

        if (pixi[id] && !state.fog[id]) {
          pixi[id].entityId = id;
          pixi[id].interactive = true;
          pixi[id].on("click", popupOver);
          pixi[id].on("touchstart", () => pixi[id].maybeSelect = true);
          pixi[id].on("touchmove", () => pixi[id].maybeSelect = false);
          pixi[id].on("touchend", e => pixi[id].maybeSelect && popupOver(e));
        }
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
        const jobs = jobQueueFor(state.ecs, playerId);
        jobs.push({ job, targetId });
        // NOTE: For now, we replan anyone in our team who is not in a job
        for (const id in state.ecs.planner) {
          const planner = state.ecs.planner[id];
          if (!planner.world.currentJob && topController(state.ecs, id) == playerId) {
            htn.replan(planner);
          }
        }
        setPopupInfo({});
      },
      select_entity: (id, touch) => {
        selectEntity(id, touch);
      },
      generate_map: async (seed) => {
        state.ecs = { nextId: 1 };
        state.pixi = {};
        state.ui.progress = { count: 0 };
        state.game_speed = "normal";
        state.days = 0.375;

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
