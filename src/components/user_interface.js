import React from "react";

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

export function UserInterface() {
  const state = React.useContext(GameState);
  const show = state.ui && state.ui.show || {};
  return (
    <div id="ui">
      {show.clock && <Clock/>}
      {("main_menu" in show) && <MainMenu show={show.main_menu}/>}
      {show.game_over && <GameOver/>}
      {show.tutorial && <Tutorial/>}
      {show.info && <Window windowId="info" x={30} y={30}><Info entityId={show.info}/></Window>}
      {show.mapgen && <Window windowId="mapgen" x={60} y={70}><CustomGame/></Window>}
      {show.selected_person && <SelectedPerson entityId={show.selected_person}/>}
      {show.speed_controls && <SpeedControls/>}
    </div>
  );
}
