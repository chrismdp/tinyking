import React from "react";
import { GameState } from "components/contexts";

export function DebugWorldgen() {
  const state = React.useContext(GameState);

  // TODO: This isn't right - we should have the different main menu states
  // managed through different components

  if (state.ui) {
    state.ui.show.main_menu = false;
  }

  if (state.pixi && state.pixi.base) {
    state.pixi.base.getChildByName("fog").visible = false;
    state.pixi.viewport.setZoom(0.2);
    console.log("FOG");
  }

  return (
    <div id="ui">
      Debug worldgen
    </div>
  );
}
