import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { Name } from "components/name";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const title = state.ecs.nameable[entityId] ? (<Name nameable={state.ecs.nameable[entityId]}/>) : "Information";

  return (
    <div>
      <h1 className="handle">{title}</h1>
      { state.ecs.mappable[entityId] && (<div>Terrain type: <strong>{state.ecs.mappable[entityId].terrain}</strong></div>) }
      <div>More description goes here</div>
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.number.isRequired,
};
