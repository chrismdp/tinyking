import { updateRoadWear } from "game/road_wear";
import { HOUR } from "game/time";
import { updateCrops } from "game/climate";
import { updateEcology } from "game/ecology";
import { updateWeather } from "game/weather";

export function updateEnvironment(state, seed) {
  updateRoadWear(state);
  updateCrops(state);
  updateEcology(state);
  updateWeather(state,1,seed);
  state.environmentUpdatedAt = state.days;
}

// Offscreen snapshots catch up on the same calendar, after their one social step.
// This cursor records applied environment hours, not a second world clock.
export function advanceEnvironment(state, end, seed) {
  const from = state.environmentUpdatedAt ?? state.days;
  const day = state.days;
  for (let at = from + HOUR; at <= end + 1e-9; at += HOUR) {
    state.days = at;
    updateEnvironment(state,seed);
  }
  state.days = day;
}
