import React from "react";
import PropTypes from "prop-types";

import { useSelector } from "react-redux";

import { getEntity } from "features/entities_slice";
import { Name } from "components/name";

export function Info({ entityId }) {
  const entity = useSelector(getEntity(entityId));
  const title = entity.nameable ? (<Name nameable={entity.nameable}/>) : "Information";

  return (
    <div>
      <h1 className="handle">{title}</h1>
      { entity.mappable && (<div>Terrain type: <strong>{entity.mappable.terrain}</strong></div>) }
      <div>More description goes here</div>
      <div className='debug' style={{color: "red"}}>
        {
          Object.keys(entity).filter(k => entity[k]).map(k => (<div key={k}>{k} = {JSON.stringify(entity[k])}</div>))
        }
      </div>
    </div>
  );
}

Info.propTypes = {
  entityId: PropTypes.number.isRequired,
};
