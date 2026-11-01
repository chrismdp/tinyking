import React from "react";
import PropTypes from "prop-types";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { GameState } from "components/contexts";
import { handleSpaceKey } from "game/speed_keys";

function SpeedButton({ icon, game_speed, click }) {
  const state = React.useContext(GameState);
  return (<button aria-label={{ paused: "Pause", normal: "Normal speed" }[game_speed]} onClick={click(game_speed)} disabled={state.game_speed == game_speed}>
    <FontAwesomeIcon icon={icon}/>
  </button>);
}

SpeedButton.propTypes = {
  icon: PropTypes.string.isRequired,
  game_speed: PropTypes.string.isRequired,
  click: PropTypes.func.isRequired
};

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
  </div>);
}
