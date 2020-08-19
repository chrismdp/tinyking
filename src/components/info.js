import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { Name } from "components/name";
import { fullEntity } from "game/entities";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [state.ecs, entityId]);
  const title = entity.mappable ? (entity.mappable.terrain) : (entity.nameable ? (<Name nameable={entity.nameable}/>) : "Information");
  const iControl = state.ecs.playable[state.ui.playerId].controls.includes(entityId);

  return (
    <div>
      {title && (<h1 className="capitalise handle">{title}</h1>)}
      { entity.traits && entity.traits.values.length > 0 && (<div>Traits: <strong>{ entity.traits.values.join(", ") }</strong></div>) }
      { entity.habitable && entity.habitable.owners.map({o => state.ecs.nameable[o].name}
      { iControl && (<p>You control this character. Click and drag to assign to a job.</p>) }
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
