// Space toggles pause, resuming at the speed the game had. Typing is left alone.
export function handleSpaceKey(e, state) {
  const target = e.target;
  if (e.code != "Space" || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName) || target?.isContentEditable) return false;
  e.preventDefault();
  if (state.game_speed != "paused") state.ui.lastSpeed = state.game_speed;
  state.ui.actions.set_speed(state.game_speed == "paused" ? state.ui.lastSpeed || "normal" : "paused");
  return true;
}
