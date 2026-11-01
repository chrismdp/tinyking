// Space toggles pause, resuming at normal speed. Typing is left alone.
export function handleSpaceKey(e, state) {
  const target = e.target;
  if (e.code != "Space" || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName) || target?.isContentEditable) return false;
  e.preventDefault();
  state.ui.actions.set_speed(state.game_speed == "paused" ? "normal" : "paused");
  return true;
}
