import { habitatAt, localHabitat, climateAt } from "game/biome_field";
import { foundHousehold } from "game/family";
import { expandedFootprint, expansionFits } from "game/settlement_growth";
import { historicalDate, centreHousehold, villageArea } from "game/settlement_details";
import { resourcePermission, answerCustoms, commonLand, villageElder, membership, oathEligibility } from "game/village_customs";
import { updateRoadWear, recordRoadUse } from "game/road_wear";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { walk_to } from "game/tasks";
import { updateEnvironment, advanceEnvironment } from "game/environment";
import { canPlaceField, reserveFieldPlot, reserveRoad } from "game/land_use";
import { growingAt, frozenAt } from "game/climate";
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

import { startIntro, skipIntro, introActive } from "game/intro";
import { createSimulation } from "game/simulation";
import { createTicker } from "game/ticker";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { DebugWorldgen } from "components/debug_worldgen";
import { Info } from "components/info";
import { playerOrderAllowed, enqueueTask, reorderTask, cancelTask, cancelJob } from "game/manager";

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

  state.personName = (id, record = state.ecs.nameable[id]) => name(record);
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
      if (id != state.ui.playerId) state.renderer?.suspendFollow();
      if (state.ecs.personable[id] && id != state.ui.playerId) {
        setPopupInfo({});
        state.ui.show.selected_person = id;
        state.ui.selected = id;
        renderUI();
        return;
      }
      if (id == state.ui.playerId) state.renderer?.recenter();
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
        renderUI();
      },
      change_visibility: action => {
        state.ui.show = { ...state.ui.show, ...action };
        if ("selected_person" in action) {
          state.ui.selected = action.selected_person;
          if (action.selected_person == state.ui.playerId) state.renderer?.recenter();
          else if (action.selected_person) state.renderer?.suspendFollow();
        }
        renderUI();
      },
      toggle_debug: () => {
        state.ui.debug = !state.ui.debug;
        state.redraws.push(...Object.keys(state.ecs.personable || {}));
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
        if (acceptTravel(state,tileId)) { state.renderer?.resumeFollow(); setPopupInfo({}); state.ui.show.world_overview=false; }
        renderUI();
      },
      dismiss_travel: () => { setPopupInfo({}); renderUI(); },
      skip_intro: () => {
        skipIntro(state);
        renderUI();
      },
      choose_job: (playerId, job, targetId) => {
        if (introActive(state)||state.worldBusy || !playerOrderAllowed(state,job.key)) return;
        if (job.key == "cut_tree_down") {
          const permission = resourcePermission(state, playerId, targetId);
          if (permission.kind == "private" && !permission.permitted) return;
          if (!permission.permitted) {
            state.ui.resourceOrder = { job, targetId, villageId: permission.villageId };
            setPopupInfo({}); renderUI(); return;
          }
        }
        if (job.key == "build_shelter") {
          targetId = state.ecs.construction?.[targetId] ? targetId : placeShelter(state, targetId);
          if (!targetId) return;
        }
        state.renderer?.resumeFollow();
        enqueueTask(state, job, targetId);
        setPopupInfo({});
        renderUI();
      },
      show_family: id => {state.ui.familyPersonId=id;renderUI();},
      found_household: () => {if(introActive(state)||state.worldBusy)return;foundHousehold(state);renderUI();},
      confirm_resource_order: () => {
        const order = state.ui.resourceOrder;
        if (!order || state.customs?.dialogue) return;
        const permission = resourcePermission(state, state.ui.playerId, order.targetId);
        if (permission.kind != "private" || permission.permitted) enqueueTask(state, order.job, order.targetId);
        delete state.ui.resourceOrder; renderUI();
      },
      dismiss_resource_order: () => { delete state.ui.resourceOrder; renderUI(); },
      answer_customs: choice => { answerCustoms(state, choice); renderUI(); },
      dismiss_customs: () => { delete state.ui.customsResult; renderUI(); },
      accept_favour: (id, personId) => { if (introActive(state)||state.worldBusy || !playerOrderAllowed(state,"favour")) return; state.renderer?.resumeFollow(); acceptFavour(state, id, personId); renderUI(); },
      talk_to: (personId, key, metadata) => {
        if (introActive(state)||state.worldBusy) return;
        state.renderer?.resumeFollow();
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
        state.customs = null; state.ui.resourceOrder = null; state.ui.customsResult = null;
        state.knowledge = {};
        state.talking = {};
        state.ui.talkResult = null;
        state.ui.familyPersonId = null;
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

        const results = await generateMap(state, seed, state.ui.actions.progress_update, { settlementFixture:process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("settlement") : null, geographyFixture: process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("geography") : null });
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
      window.tinykingSettlement = { historicalDate, centreHousehold, villageArea, expandedFootprint, expansionFits, createSimulation };
      window.tinykingCustoms = { resourcePermission, commonLand, villageElder, membership, oathEligibility };
      window.tinykingGeography = { habitatAt, localHabitat, climateAt, updateRoadWear, recordRoadUse, Hex, path, walk_to, updateEnvironment, advanceEnvironment, canPlaceField, reserveFieldPlot, reserveRoad, growingAt, frozenAt };
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
