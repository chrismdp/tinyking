import React from "react";
import { GameState } from "components/contexts";
import { localWeather } from "game/weather";
import * as time from "game/time";

export function Clock() {
  const state = React.useContext(GameState);
  const days = state.days || 0;
  const weather = localWeather(state);
  return (<div id="clock">{time.full(days)}{weather && " · " + weather.type[0].toUpperCase() + weather.type.slice(1)}</div>);
}
