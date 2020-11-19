import React from "react";
import PropTypes from "prop-types";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { GameState } from "components/contexts";

function SpeedButton({ icon, game_speed, click }) {
  const state = React.useContext(GameState);
  return (<button onClick={click(game_speed)} disabled={state.game_speed == game_speed}>
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

  const set_speed = React.useCallback(speedClass => () =>
    state.ui.actions.set_speed(speedClass), [state.ui.actions]);

  return (<div id='speed-controls'>
    <SpeedButton icon="pause" game_speed="paused" click={set_speed}/>
    <SpeedButton icon="play" game_speed="normal" click={set_speed}/>
    <SpeedButton icon="fast-forward" game_speed="fast" click={set_speed}/>
  </div>);
}
