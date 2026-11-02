import { flushSync } from "react-dom";
import { createLoadingProgress } from "game/loading";
import { toggleWorldMap } from "game/realm_map";
import { chooseLine, closeChat, selectChatSubject } from "game/chat";
import { PanelBoundary } from "./panel_boundary";
import { personComponent } from "game/residents";
import { openCharacter, closeCharacter, startGame } from "game/new_game";
import { connectSaveWorker, createAutosave, bindAutosave } from "game/autosave";
import { replaceGame } from "game/save_game";
import { habitatAt, localHabitat, climateAt } from "game/biome_field";
import { repairHouseholds } from "game/possessions";
import { foundHousehold } from "game/family";
import { expandedFootprint, expansionFits } from "game/settlement_growth";
import { historicalDate, centreHousehold, villageArea } from "game/settlement_details";
import { resourcePermission, commonLand, villageElder, membership, oathEligibility } from "game/village_customs";
import { updateRoadWear, recordRoadUse } from "game/road_wear";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { walk_to } from "game/tasks";
import { updateEnvironment, advanceEnvironment } from "game/environment";
import { canPlaceField, reserveFieldPlot, reserveRoad } from "game/land_use";
import { growingAt, frozenAt } from "game/climate";
import { advanceWorldClock, acceptTravel, planJourney, stopJourney } from "game/travel";
import { name } from "game/name";
import * as React from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import { createPopper } from "@popperjs/core";
import TWEEN from "@tweenjs/tween.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import * as THREE from "three";

import { useTranslate } from "react-polyglot";

import { generateWorldGame } from "game/world_history";

import { skipIntro, introActive } from "game/intro";
import { createSimulation } from "game/simulation";
import { createTicker } from "game/ticker";
import { GameState } from "components/contexts";
import { UserInterface } from "components/user_interface";
import { DebugWorldgen } from "components/debug_worldgen";
import { Info } from "components/info";
import { playerOrderAllowed, enqueueTask, cancelTask, cancelJob } from "game/manager";

import { placeShelter } from "game/construction";
import { applyWeatherPreview } from "render/weather_preview";
import { createWorldView } from "render/world_view";

const releaseMap = state => {
  state.ticker?.destroy();
  state.renderer?.dispose();
  state.renderer = null;
};

const renderMap = (webgl, state, selectEntity, renderUI, t) => {
  releaseMap(state);
  state.ticker = createTicker();
  state.ticker.start();

  // NOTE: draw everything on the first frame
  state.redraws = Object.keys(state.ecs.spatial);

  state.personName = (id, record = personComponent(state, "nameable", id)) => name(record);
  state.renderer = createWorldView(webgl, state, { t, onSelect: selectEntity });
  state.renderer.resize(window.innerWidth, window.innerHeight);

  const simulation = createSimulation(state, { onSleep: renderUI, onHour: renderUI, onDay: () => state.persistence.request(), onTravel: () => { state.ui.actions.dismiss_travel(); renderMap(webgl,state,selectEntity,renderUI,t); }, onError: error => { console.error(error); renderUI(); } });
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
    state.persistence.flush();
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
      if (personComponent(state, "personable", id) && id != state.ui.playerId) {
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
    // NOTE: the renderer highlights whatever the popup is showing
    if (state.ui) {
      state.ui.selected = popupInfo.id || state.ui.show.selected_person;
    }
    if (popupInfo.id) {
      const point = state.renderer.screenPosition(popupInfo.id);
      virtualReference.current.set(point.x, point.y);
      const instance = createPopper(virtualReference.current, popperElement.current, {
        placement: (popupInfo.touch ? "top" : "bottom-start"),
        modifiers: [
          { name: "arrow", options: { element: arrowElement.current } },
          { name: "offset", options: { offset: [-15, 20] } },
          { name: "preventOverflow", options: { altAxis: true, padding: 10 } },
        ]
      });

      popper.current = instance;
      // Info's asynchronous job offers can change the popup's dimensions.
      // Defer Popper's layout writes until ResizeObserver delivery has ended.
      let pendingFrame = null;
      const observer = new ResizeObserver(() => {
        if (pendingFrame !== null) return;
        pendingFrame = requestAnimationFrame(() => {
          pendingFrame = null;
          instance.update();
        });
      });
      observer.observe(popperElement.current);
      return () => {
        if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
        observer.disconnect();
        instance.destroy();
        popper.current = null;
      };
    }
  }, [state, popupInfo]);

  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("seed");
    const initialSeed = requested ? (isNaN(+requested) ? requested : +requested) : Math.round(Math.random() * 10000000);
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
        if (introActive(state)||state.worldBusy||state.chat?.active) return;
        if (!["paused", "normal"].includes(speedClass)) return;
        state.game_speed = speedClass;
        renderUI();
      },
      close_window: (id) => {
        if (id == "mapgen") {
          closeCharacter(state);
          renderUI();
          return;
        }
        delete state.ui.show[id];
        renderUI();
      },
      custom_game: async () => {
        if (state.generating) return;
        openCharacter(state);
        if (!state.map || state.ecs.playable?.[state.ui.playerId]?.arrivedAt != null) await state.ui.actions.generate_map(initialSeed);
        renderUI();
      },
      start_game: () => {
        if (startGame(state, { skip: new URLSearchParams(window.location.search).get("intro") == "skip" })) {
          setPopupInfo({});
          state.persistence.request();
          renderUI();
        }
      },
      continue_game: async () => {
        if (state.generating) return;
        state.generating = true;
        renderUI();
        try {
          await state.ui.actions.progress_update("Reading your saved world", 0);
          const data = await state.persistence.load();
          if (!data) return;
          releaseMap(state);
          replaceGame(state, data);
          await advanceWorldClock(state);
          repairHouseholds(state);
          state.worldBusy = false;
          state.transition = null;
          state.persistence.error = null;
          state.ui.show.main_menu = false;
          state.ui.show.mapgen = false;
          setPopupInfo({});
          await state.ui.actions.progress_update("Waking the villagers", .8);
          renderMap(webgl, state, selectEntity, renderUI, t);
        } catch (error) {
          state.persistence.error = "Could not continue: " + error.message;
        } finally { state.generating = false; }
        renderUI();
      },
      toggle_world_map: () => { toggleWorldMap(state); setPopupInfo({}); renderUI(); },
      plan_journey: key => {
        if (planJourney(state,key)) { state.renderer?.resumeFollow(); setPopupInfo({}); state.ui.show.world_overview=false; }
        renderUI();
      },
      stop_journey: () => { if (!state.worldBusy) stopJourney(state); renderUI(); },
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
        if (!order || state.chat?.active) return;
        const permission = resourcePermission(state, state.ui.playerId, order.targetId);
        if (permission.kind != "private" || permission.permitted) enqueueTask(state, order.job, order.targetId);
        delete state.ui.resourceOrder; renderUI();
      },
      dismiss_resource_order: () => { delete state.ui.resourceOrder; renderUI(); },
      dismiss_customs: () => { delete state.ui.customsResult; renderUI(); },
      choose_chat_line: key => { chooseLine(state,key); renderUI(); },
      close_chat: () => { closeChat(state); renderUI(); },
      chat_focus: focus => { if(state.chat?.active) state.chat.active.focus=focus; renderUI(); },
      chat_subject: id => { selectChatSubject(state,id); renderUI(); },
      talk_to: (personId, key, metadata) => {
        if (introActive(state)||state.worldBusy) return;
        state.renderer?.resumeFollow();
        enqueueTask(state, { key: key == "ask_about" ? "chat" : key }, personId, metadata);
        renderUI();
      },
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
        if (state.generating) return;
        state.generating = true;
        releaseMap(state);
        const show = { clock: true, main_menu: state.ui.show.main_menu, mapgen: state.ui.show.mapgen };
        replaceGame(state, { ecs: { nextId: 1 }, intro: null, days: .375, game_speed: "paused", ui: { show, progress: { count: 0 } } });
        state.worldBusy = false;
        state.transition = null;
        setPopupInfo({});
        state.ticker = createTicker();
        state.ticker.start();

        state.ui.progress = { count: 0 };
        state.game_speed = "normal";
        state.days = 0.375;

        await state.ui.actions.progress_update("Preparing your world", 0);
        const results = await generateWorldGame(state, seed, state.ui.actions.progress_update, { settlementFixture:process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("settlement") : null, geographyFixture: process.env.NODE_ENV !== "production" ? new URLSearchParams(window.location.search).get("geography") : null });
        state.map = results.map;
        state.ui.playerId = results.playerId;
        if (process.env.NODE_ENV !== "production") applyWeatherPreview(state, window.location.search);

        state.generating = false;
        // Hold the new world still while the player chooses their character.
        if (state.ui.show.main_menu || state.ui.show.mapgen) state.game_speed = "paused";
        renderMap(webgl, state, selectEntity, renderUI, t);

        renderUI();
      },
      progress_update: createLoadingProgress(state, () => flushSync(renderUI))
    } };

    let saveClient;
    const connection = Promise.resolve().then(connectSaveWorker).then(client => { saveClient = client; });
    state.persistence = createAutosave(state, (...args) => saveClient ? saveClient(...args) : connection.then(() => saveClient(...args)), renderUI);
    const unbindAutosave = bindAutosave(state.persistence, window, document);
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
      window.tinykingTravel = { createSimulation: () => createSimulation(state, { onDay: () => state.persistence.request(), onTravel: () => { state.ui.actions.dismiss_travel(); renderMap(webgl,state,selectEntity,renderUI,t); } }) };
      window.tinykingSettlement = { historicalDate, centreHousehold, villageArea, expandedFootprint, expansionFits, createSimulation };
      window.tinykingCustoms = { resourcePermission, commonLand, villageElder, membership, oathEligibility };
      window.tinykingGeography = { habitatAt, localHabitat, climateAt, updateRoadWear, recordRoadUse, Hex, path, walk_to, updateEnvironment, advanceEnvironment, canPlaceField, reserveFieldPlot, reserveRoad, growingAt, frozenAt };
    }

    (async () => {
      // NOTE: ?seed=1234 in the address plays that seed, to look at a world again
      await state.persistence.inspect();
      if (!state.persistence.hasSave && !state.persistence.error) await state.ui.actions.generate_map(initialSeed);
    })();
    return () => {
      unbindAutosave();
      releaseMap(state);
      webgl.dispose();
      webgl.domElement.remove();
      window.onresize = null;
    };
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
          {popupInfo.id && <PanelBoundary key={popupInfo.id} onClose={()=>setPopupInfo({})}><Info entityId={popupInfo.id}/></PanelBoundary>}
          <div className="arrow" ref={arrowElement}/>
        </div>
      </GameState.Provider>
    </div>
  );
}
