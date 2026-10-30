import { initialiseTravel, acceptTravel } from "game/travel";
import { acceptFavour } from "game/favours";
import { name } from "game/name";
import * as React from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import { createPopper } from "@popperjs/core";
import TWEEN from "@tweenjs/tween.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import * as THREE from "three";

import { useTranslate } from "react-polyglot";

import { generateMap } from "game/map";
import { anyControlledAlive } from "game/playable";
import { startIntro, skipIntro, introActive } from "game/intro";
import { createSimulation } from "game/simulation";
import { createTicker } from "game/ticker";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { DebugWorldgen } from "components/debug_worldgen";
import { Info } from "components/info";
import { enqueueTask, reorderTask, cancelTask, cancelJob } from "game/manager";

import { placeShelter } from "game/construction";
import { applyWeatherPreview } from "render/weather_preview";
import { createWorldView } from "render/world_view";

const renderMap = (webgl, state, selectEntity, renderUI, t) => {
  state.ticker?.destroy();
  state.ticker = createTicker();
  state.ticker.start();
  if (state.renderer) {
    state.renderer.dispose();
  }

  // NOTE: draw everything on the first frame
  state.redraws = Object.keys(state.ecs.spatial);

  state.personName = id => name(state.ecs.nameable[id]);
  state.renderer = createWorldView(webgl, state, { t, onSelect: selectEntity });
  state.renderer.resize(window.innerWidth, window.innerHeight);

  const simulation = createSimulation(state, { onHour: renderUI, onTravel: () => { state.ui.actions.dismiss_travel(); renderMap(webgl,state,selectEntity,renderUI,t); }, onError: error => { console.error(error); renderUI(); } });
  let uiTime = 0;
  state.ticker.add(() => {
    if (performance.now() - uiTime > 250) { uiTime = performance.now(); renderUI(); }
  });

  state.ticker.add(() => {
    TWEEN.update();
  });

  let simulationTime = performance.now();
  state.ticker.add(frameMod => {
    const now = performance.now();
    simulation.step(frameMod, (now - simulationTime) / 1000);
    simulationTime = now;
  });

  state.ticker.add(() => state.renderer.frame());
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

  const [popupInfo, setPopupInfo] = React.useState({});
  const virtualReference = React.useRef(virtualPosition);
  const popperElement = React.useRef(null);
  const arrowElement = React.useRef(null);
  const popper = React.useRef(null);
  const t = useTranslate();

  const selectEntity = React.useCallback((id, touch) => {
    if (!introActive(state) && !state.worldBusy && !state.ui.show.main_menu) {
      if (state.ecs.personable[id] && id != state.ui.playerId) {
        setPopupInfo({});
        state.ui.show.selected_person = id;
        state.ui.selected = id;
        renderUI();
        return;
      }
      state.ui.show.selected_person = null;
      setPopupInfo(s => (s.id != id) ? { id, touch } : {});
    }
  }, [state, setPopupInfo, renderUI]);

  React.useEffect(() => {
    if (popupInfo.id) {
      if (popper.current) popper.current.destroy();
      popper.current = createPopper(virtualReference.current, popperElement.current, {
        placement: (popupInfo.touch ? "top" : "bottom-start"),
        modifiers: [
          { name: "arrow", options: { element: arrowElement.current } },
          { name: "offset", options: { offset: [-15, 20] } },
          { name: "preventOverflow" },
        ]
      });

      const point = state.renderer.screenPosition(popupInfo.id);
      virtualReference.current.set(point.x, point.y);
    } else {
      if (popper.current) popper.current.destroy();
      popper.current = null;
    }
    // NOTE: the renderer highlights whatever the popup is showing
    if (state.ui) {
      state.ui.selected = popupInfo.id || state.ui.show.selected_person;
    }
  }, [state, popupInfo]);

  React.useEffect(() => {
    const webgl = new THREE.WebGLRenderer({ antialias: true });
    webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    webgl.setSize(window.innerWidth, window.innerHeight);

    state.ui = { ...state.ui, show: { clock: true, main_menu: true }, actions: {
      end_turn: async () => {
        // TODO: move to realtime check
        if (!anyControlledAlive(state.ecs, state.ui.playerId)) {
          state.ui.show.game_over = true;
          const value = { s: 0 };
          new TWEEN.Tween(value)
            .to({ s: -1 }, 2500)
            .onUpdate(() => state.renderer.setDesaturation(-value.s))
            .start();
        }
        renderUI();
      },
      change_visibility: action => {
        state.ui.show = { ...state.ui.show, ...action };
        if ("selected_person" in action) state.ui.selected = action.selected_person;
        renderUI();
      },
      set_speed: (speedClass) => {
        if (introActive(state)||state.worldBusy) return;
        state.game_speed = speedClass;
        renderUI();
      },
      close_window: (id) => {
        if (id == "mapgen") {
          state.game_speed = "normal";
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
        state.game_speed = "normal";
        setPopupInfo({});
        startIntro(state, { skip: new URLSearchParams(window.location.search).get("intro") == "skip" });
        renderUI();
      },
      travel: tileId => {
        if (introActive(state)||state.worldBusy) return;
        if (acceptTravel(state,tileId)) { setPopupInfo({}); state.ui.show.world_overview=false; }
        renderUI();
      },
      dismiss_travel: () => { setPopupInfo({}); renderUI(); },
      skip_intro: () => {
        skipIntro(state);
        renderUI();
      },
      choose_job: (playerId, job, targetId) => {
        if (introActive(state)||state.worldBusy) return;
        if (job.key == "build_shelter") {
          targetId = state.ecs.construction?.[targetId] ? targetId : placeShelter(state, targetId);
          if (!targetId) return;
        }
        enqueueTask(state, job, targetId);
        setPopupInfo({});
        renderUI();
      },
      accept_favour: id => { if (introActive(state)||state.worldBusy) return; acceptFavour(state, id); renderUI(); },
      talk_to: (personId, key, metadata) => {
        if (introActive(state)||state.worldBusy) return;
        enqueueTask(state, { key }, personId, metadata);
        renderUI();
      },
      reorder_task: (id, index) => { if (introActive(state)||state.worldBusy) return; reorderTask(state, id, index); renderUI(); },
      cancel_task: id => { if (introActive(state)||state.worldBusy) return; cancelTask(state, id); renderUI(); },
      cancel_job: (managerId, key, targetId) => {
        if (introActive(state)||state.worldBusy) return;
        cancelJob(state, managerId, key, targetId);
        setPopupInfo({});
        renderUI();
      },
      select_entity: (id, touch) => {
        selectEntity(id, touch);
      },
      generate_map: async (seed) => {
        state.ecs = { nextId: 1 };
        state.travel=null;state.residents=null;state.worldBusy=false;state.travelError=null;state.transition=null;state.pendingPlayerTravel=null;state.pendingNpcDepartures=[];
        state.knowledge = {};
        state.talking = {};
        state.ui.talkResult = null;
        state.ui.show.selected_person = null;
        state.intro = null;
        if (state.ticker) {
          state.ticker.destroy();
        }
        state.ticker = createTicker();
        state.ticker.start();

        state.ui.progress = { count: 0 };
        state.game_speed = "normal";
        state.days = 0.375;

        const results = await generateMap(state, seed, state.ui.actions.progress_update);
        state.map = results.map;
        state.ui.playerId = results.playerId;
        initialiseTravel(state,seed);
        if (process.env.NODE_ENV !== "production") applyWeatherPreview(state, window.location.search);

        // Hold the new world still while the player chooses their character.
        if (state.ui.show.main_menu || state.ui.show.mapgen) state.game_speed = "paused";
        renderMap(webgl, state, selectEntity, renderUI, t);

        renderUI();
      },
      progress_update: async (label) => {
        state.ui.progress.label = label;
        state.ui.progress.count++;
        renderUI();
        return new Promise(resolve => setTimeout(resolve, 10));
      }
    } };

    containingDiv.current.appendChild(webgl.domElement);

    window.onresize = () => {
      if (state.renderer) {
        state.renderer.resize(window.innerWidth, window.innerHeight);
      } else {
        webgl.setSize(window.innerWidth, window.innerHeight);
      }
    };

    if (process.env.NODE_ENV !== "production") {
      // NOTE: lets scripts/playtest.js look inside the running game
      window.tinyking = state;
    }

    (async () => {
      // NOTE: ?seed=1234 in the address plays that seed, to look at a world again
      const requested = new URLSearchParams(window.location.search).get("seed");
      const seed = requested ? (isNaN(+requested) ? requested : +requested) : Math.round(Math.random() * 10000000);
      await state.ui.actions.generate_map(seed);
    })();
  }, [renderUI, state, selectEntity, t]);

  return (
    <div id="game">
      <div id="world" ref={containingDiv}></div>
      <GameState.Provider value={state}>
        <Switch>
          <Route exact strict path="/debug/worldgen">
            <DebugWorldgen/>
        </Route>
          <Route path="/">
            <UserInterface/>
          </Route>
          <Route>
            <Redirect to="/"/>
        </Route>
        </Switch>
        <div className="popper" ref={popperElement} style={{...popper.styles, visibility: popupInfo.id ? "visible" : "hidden" }} {...popper.attributes}>
          <button aria-label="Close menu" onClick={() => setPopupInfo({})} className='close'><FontAwesomeIcon icon="times"/></button>
          {popupInfo.id && (<Info entityId={popupInfo.id}/>)}
          <div className="arrow" ref={arrowElement}/>
        </div>
      </GameState.Provider>
    </div>
  );
}
