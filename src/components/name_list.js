import React from "react";
import PropTypes from "prop-types";

import { GameState } from "components/contexts";
import { Name } from "components/name";

export function NameList({ ids }) {
  const state = React.useContext(GameState);
  // TODO

  return (<span>
    {ids.map((id, idx) => (<span key={idx}>
      <Name nameable={state.ecs.nameable[id]} clickable={true}/>
      {(idx < ids.length - 1) && ", "}
    </span>))}
  </span>);
}

NameList.propTypes = {
  ids: PropTypes.arrayOf(PropTypes.string).isRequired
};
