import React from "react";
import { GameState } from "components/contexts";

const TIME = ["morning", "afternoon", "evening"];
const SEASON = ["Spring", "Summer", "Autumn", "Winter"];

export function Clock() {
  const state = React.useContext(GameState);
  const clock = state.clock || 0;
  const year = Math.floor(clock / 12) + 1;
  const time = TIME[clock % 3];
  const season = SEASON[Math.floor(clock / 3) % 4];
  return (<div id="clock">{season} {time}, year {year}</div>);
}
