import React from "react";

import { GameState } from "components/contexts";

export function Supplies() {
  const state = React.useContext(GameState);
  const supplies = state.ecs.supplies[state.ui.playerId];

  return (<div id="supplies" className="capitalise">{
    Object.keys(supplies)
      .filter(k => k != "id")
      .map(k => k + ": " + supplies[k]).join(", ")
  }</div>);
}
