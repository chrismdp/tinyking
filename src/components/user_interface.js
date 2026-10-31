import { openingGuidance, dismissGuidance } from "game/guidance";
import { EventFeed } from "./event_feed";
import React from "react";

import { introActive } from "game/intro";
import { IntroOverlay } from "components/intro_overlay";

import { TaskPanel } from "components/task_panel";
import { CustomGame } from "components/custom_game";
import { Info } from "components/info";
import { Window } from "components/window";
import { MainMenu } from "components/main_menu";
import { GameOver } from "components/game_over";
import { Tutorial } from "components/tutorial";
import { Clock } from "components/clock";
import { GameState } from "components/contexts";
import { SelectedPerson } from "components/selected_person";
import { SpeedControls } from "components/speed_controls";

const FamilyTree = React.lazy(()=>import("./person_panel").then(module=>({default:module.FamilyTree})));
const TravelOverview = React.lazy(() => import("./travel"));

function OpeningGuidance() {
  const state = React.useContext(GameState);
  const [, refresh] = React.useState(0);
  const hint = openingGuidance(state);
  if (!hint) return null;
  return <aside id="opening-guidance" aria-label="Getting started"><span>{hint.text}</span><button aria-label="Dismiss getting started hint" onClick={() => { dismissGuidance(state); refresh(n => n + 1); }}>×</button></aside>;
}

export function UserInterface() {
  const state = React.useContext(GameState);
  const show = state.ui && state.ui.show || {};
  if (state.transition || state.worldBusy) return <div id="ui"><div className="travel-loading" role="status">{state.transition?.label || "News from the neighbouring communities…"}<small>Time and needs are paused while the world is prepared.</small></div></div>;
  if (introActive(state)) return <div id="ui"><IntroOverlay/></div>;
  return (
    <div id="ui">
      {show.clock && <Clock/>}
      {state.ui?.successionMessage && <aside className="succession-message" role="status"><button aria-label="Dismiss succession message" onClick={()=>{state.ui.successionMessage=null;state.ui.actions.end_turn();}}>×</button>{state.ui.successionMessage}</aside>}
      {state.wedding?.until > state.days && <aside className="succession-message" role="status">A wedding! The couple celebrates with their families.</aside>}
      {state.travelError && <div className="travel-loading" role="alert">Travel stopped: {state.travelError}</div>}
      {show.world_overview && <React.Suspense fallback={null}><TravelOverview/></React.Suspense>}
      {("main_menu" in show) && <MainMenu show={show.main_menu}/>}
      {show.game_over && <GameOver/>}
      {show.tutorial && <Tutorial/>}
      {show.info && <Window windowId="info" x={30} y={30}><Info entityId={show.info}/></Window>}
      {show.mapgen && <Window windowId="mapgen" x={60} y={70}><CustomGame/></Window>}
      {state.ui?.familyPersonId ? <React.Suspense fallback={null}><FamilyTree entityId={state.ui.familyPersonId} onClose={()=>{state.ui.familyPersonId=null;state.ui.actions.end_turn();}} onSelect={id=>{state.ui.familyPersonId=null;state.ui.actions.select_entity(id,false);}}/></React.Suspense> : show.selected_person && <SelectedPerson entityId={show.selected_person}/>}
      {show.speed_controls && <><OpeningGuidance/><div id="camera-actions"><button onClick={() => state.renderer?.recenter()} aria-label="Recenter on you">◎ You</button><small>Drag to pan · Pinch & twist to zoom / turn</small></div><TaskPanel/><SpeedControls/><EventFeed/></>}
    </div>
  );
}
