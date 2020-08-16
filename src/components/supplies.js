import React from "react";

import { GameState } from "components/contexts";

export function Supplies() {
  const state = React.useContext(GameState);
  const supplies = state.ecs.supplies[state.ui.playerId];

  return (<div id="supplies">{JSON.stringify(supplies)}</div>);
}
