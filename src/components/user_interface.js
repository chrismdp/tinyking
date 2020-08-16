import React from "react";

import { MapGenParams } from "components/mapgen";
import { Info } from "components/info";
import { Window } from "components/window";
import { MainMenu } from "components/main_menu";
import { Tutorial } from "components/tutorial";
import { Clock } from "components/clock";
import { Supplies } from "components/supplies";
import { NextAction } from "components/next_action";
import { GameState } from "components/contexts";

export function UserInterface() {
  const state = React.useContext(GameState);
  const show = state.ui && state.ui.show || {};
  return (
    <div id="ui">
      {show.clock && <Clock/>}
      {show.supplies && <Supplies/>}
      {show.next_action && <NextAction/>}
      {("main_menu" in show) && <MainMenu show={show.main_menu}/>}
      {show.tutorial && <Tutorial/>}
      {show.info && <Window windowId="info" x={30} y={30}><Info entityId={show.info}/></Window>}
      {show.mapgen && <Window windowId="mapgen" x={60} y={70}><MapGenParams/></Window>}
    </div>
  );
}
