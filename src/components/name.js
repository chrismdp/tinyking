import React from "react";
import PropTypes from "prop-types";

import { name } from "game/name";

import { GameState } from "components/contexts";

export function Name({ nameable, clickable }) {
  const state = React.useContext(GameState);

  const click = React.useCallback(() => state.ui.actions.select_entity(nameable.id, false),
    [nameable, state]);

  return clickable ?
    (<a onClick={click}>{ name(nameable) }</a>) :
    (<span>{ name(nameable) }</span>);
}

Name.propTypes = {
  nameable: PropTypes.any.isRequired,
  clickable: PropTypes.bool
};
