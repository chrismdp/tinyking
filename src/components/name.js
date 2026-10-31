import React from "react";
import PropTypes from "prop-types";

import { name } from "game/name";
import { displayName } from "game/knowledge";

import { GameState } from "components/contexts";

export function Name({ nameable, clickable }) {
  const state = React.useContext(GameState);

  const click = React.useCallback(() => state.ui.actions.select_entity(nameable.id, false),
    [nameable, state]);

  const text = state.ecs.personable?.[nameable.id] ?
    displayName(state, nameable.id, () => name(nameable)) : name(nameable);
  return clickable ?
    (<a onClick={click}>{text}</a>) :
    (<span>{text}</span>);
}

Name.propTypes = {
  nameable: PropTypes.any.isRequired,
  clickable: PropTypes.bool
};
