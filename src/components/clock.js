import React from "react";
import { GameState } from "components/contexts";
import * as time from "game/time";

export function Clock() {
  const state = React.useContext(GameState);
  const days = state.days || 0;
  return (<div id="clock">{time.full(days)}</div>);
}
