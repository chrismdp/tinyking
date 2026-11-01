import React from "react";
import PropTypes from "prop-types";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { GameState } from "components/contexts";

function SpeedButton({ icon, game_speed, click }) {
  const state = React.useContext(GameState);
  return (<button aria-label={{ paused: "Pause", normal: "Normal speed", fast: "Fast speed" }[game_speed]} onClick={click(game_speed)} disabled={state.game_speed == game_speed}>
    <FontAwesomeIcon icon={icon}/>
  </button>);
}

SpeedButton.propTypes = {
  icon: PropTypes.string.isRequired,
  game_speed: PropTypes.string.isRequired,
  click: PropTypes.func.isRequired
};

// Space toggles pause, resuming at the speed the game had. Typing is left alone.
export function handleSpaceKey(e, state) {
  const target = e.target;
  if (e.code != "Space" || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName) || target?.isContentEditable) return false;
  e.preventDefault();
  if (state.game_speed != "paused") state.ui.lastSpeed = state.game_speed;
  state.ui.actions.set_speed(state.game_speed == "paused" ? state.ui.lastSpeed || "normal" : "paused");
  return true;
}

export function SpeedControls() {
  const state = React.useContext(GameState);

  React.useEffect(() => {
    const key = e => handleSpaceKey(e, state);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [state]);

  const set_speed = React.useCallback(speedClass => () =>
    state.ui.actions.set_speed(speedClass), [state.ui.actions]);

  return (<div id='speed-controls'>
    <SpeedButton icon="pause" game_speed="paused" click={set_speed}/>
    <button className="debug-toggle" aria-label="Debug activities" aria-pressed={!!state.ui.debug} onClick={() => state.ui.actions.toggle_debug()}>Debug</button>
    <SpeedButton icon="play" game_speed="normal" click={set_speed}/>
    <SpeedButton icon="fast-forward" game_speed="fast" click={set_speed}/>
  </div>);
}
