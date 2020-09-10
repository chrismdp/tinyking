import React from "react";
import { GameState } from "components/contexts";
import * as time from "game/time";

export function Clock() {
  const state = React.useContext(GameState);
  const clock = state.clock || 0;
  return (<div id="clock">{time.full(clock)}</div>);
}
