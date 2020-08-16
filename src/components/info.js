import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { Name } from "components/name";
import { fullEntity } from "game/entities";

export function Info({ entityId }) {
  const state = React.useContext(GameState);
  const entity = React.useMemo(() => fullEntity(state.ecs, entityId), [entityId]);
  const title = entity.nameable ? (<Name nameable={entity.nameable}/>) : "Information";

  return (
    <div>
      <h1 className="handle">{title}</h1>
      { entity.mappable && (<div>Terrain type: <strong>{entity.mappable.terrain}</strong></div>) }
      { entity.traits && entity.traits.values.length > 0 && (<div>Traits: <strong>{ entity.traits.values.join(", ") }</strong></div>) }
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.string.isRequired,
};
