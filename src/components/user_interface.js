import { ChatPanel } from "./chat_panel";
import { PanelBoundary } from "./panel_boundary";
import { RealmControls } from "./realm_controls";
import { WeddingNotice } from "./wedding_notice";
import { CustomsEncounter } from "./village_customs";
import { openingGuidance } from "game/guidance";
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


function OpeningGuidance() {
  const state = React.useContext(GameState);
  const hint = openingGuidance(state);
  if (!hint) return null;
  return <aside id="opening-guidance" aria-label="Getting started"><span>{hint.text}</span>{hint.action && <button onClick={() => hint.selectId ? state.ui.actions.select_entity(hint.selectId,false) : hint.speed ? state.ui.actions.set_speed(hint.speed) : hint.job ? state.ui.actions.choose_job(hint.actorId,{key:hint.job},hint.targetId || hint.actorId) : state.ui.actions.talk_to(hint.targetId,"chat")}>{hint.action}</button>}</aside>;
}

export function UserInterface() {
  const state = React.useContext(GameState);
  const show = state.ui && state.ui.show || {};
  if (state.transition) return <div id="ui"><div className="travel-loading" role="status">{state.transition?.label || "News from the neighbouring communities…"}<small>Time and needs are paused while the world is prepared.</small></div></div>;
  if (introActive(state)) return <div id="ui"><IntroOverlay/></div>;
  return (
    <div id="ui" className={state.renderer?.overview ? "realm-inspecting" : ""}>
      {state.chat?.active && <ChatPanel/>}
      {show.clock && <Clock/>}
      {!show.main_menu && state.persistence?.error && <aside id="save-status" role="alert">{state.persistence.error}</aside>}
      {state.ui?.successionMessage && <aside className="succession-message" role="status"><button aria-label="Dismiss succession message" onClick={()=>{state.ui.successionMessage=null;state.ui.actions.end_turn();}}>×</button>{state.ui.successionMessage}</aside>}
      {!state.ui?.familyPersonId && <WeddingNotice/>}
      <PanelBoundary key={state.ui?.resourceOrder?.targetId || "customs"} onClose={()=>{state.ui.resourceOrder=null;state.ui.actions.end_turn();}}><CustomsEncounter/></PanelBoundary>
      {state.travelError && <div className="travel-loading" role="alert">Travel stopped: {state.travelError}</div>}
      {("main_menu" in show) && <MainMenu show={show.main_menu}/>}
      {show.game_over && <GameOver/>}
      {show.tutorial && <Tutorial/>}
      {show.info && <PanelBoundary key={show.info} onClose={()=>state.ui.actions.change_visibility({info:null})}><Window windowId="info" x={30} y={30}><Info entityId={show.info}/></Window></PanelBoundary>}
      {show.mapgen && <PanelBoundary onClose={()=>state.ui.actions.change_visibility({mapgen:false})}><Window windowId="mapgen" x={60} y={70}><CustomGame/></Window></PanelBoundary>}
      <PanelBoundary key={(state.ui?.familyPersonId ? "family:" : "person:") + (state.ui?.familyPersonId || show.selected_person)} onClose={()=>{state.ui.familyPersonId=null;state.ui.actions.change_visibility({selected_person:null});}}>{state.ui?.familyPersonId ? <React.Suspense fallback={null}><FamilyTree entityId={state.ui.familyPersonId} onClose={()=>{state.ui.familyPersonId=null;state.ui.actions.end_turn();}} onSelect={id=>{state.ui.familyPersonId=null;state.ui.actions.select_entity(id,false);}}/></React.Suspense> : show.selected_person && <SelectedPerson entityId={show.selected_person}/>}</PanelBoundary>
      {show.speed_controls && <><OpeningGuidance/><RealmControls/><PanelBoundary><TaskPanel/></PanelBoundary><SpeedControls/><PanelBoundary><EventFeed/></PanelBoundary></>}
    </div>
  );
}
