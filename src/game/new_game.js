import { repairHouseholds } from "game/possessions";
import { seedMotherFamily } from "game/mother_family";
import { startIntro } from "game/intro";

export function openCharacter(state) {
  if (state.generating) return;
  state.game_speed = "paused";
  state.ui.show.main_menu = false;
  state.ui.show.mapgen = true;
}

export function closeCharacter(state) {
  if (state.generating) return;
  state.ui.show.mapgen = false;
  state.ui.show.main_menu = true;
  state.game_speed = "paused";
}

export function startGame(state, options = {}) {
  if (state.generating || !state.ecs.personable?.[state.ui.playerId]) return false;
  Object.assign(state.ui.show, { main_menu: false, mapgen: false, tutorial: false, clock: true, speed_controls: true });
  seedMotherFamily(state,state.ui.playerId,state.map?.seed);
  repairHouseholds(state);
  state.game_speed = "normal";
  startIntro(state, options);
  return true;
}
