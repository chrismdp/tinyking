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

const TravelOverview = React.lazy(() => import("./travel"));

export function UserInterface() {
  const state = React.useContext(GameState);
  const show = state.ui && state.ui.show || {};
  if (state.transition || state.worldBusy) return <div id="ui"><div className="travel-loading" role="status">{state.transition?.label || "News from the neighbouring communities…"}<small>Time and needs are paused while the world is prepared.</small></div></div>;
  if (introActive(state)) return <div id="ui"><IntroOverlay/></div>;
  return (
    <div id="ui">
      {show.clock && <Clock/>}
      {state.travelError && <div className="travel-loading" role="alert">Travel stopped: {state.travelError}</div>}
      {show.world_overview && <React.Suspense fallback={null}><TravelOverview/></React.Suspense>}
      {("main_menu" in show) && <MainMenu show={show.main_menu}/>}
      {show.game_over && <GameOver/>}
      {show.tutorial && <Tutorial/>}
      {show.info && <Window windowId="info" x={30} y={30}><Info entityId={show.info}/></Window>}
      {show.mapgen && <Window windowId="mapgen" x={60} y={70}><CustomGame/></Window>}
      {show.selected_person && <SelectedPerson entityId={show.selected_person}/>}
      {show.speed_controls && <><TaskPanel/><SpeedControls/><EventFeed/></>}
    </div>
  );
}
