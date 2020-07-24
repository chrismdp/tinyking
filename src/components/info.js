import React from "react";
import PropTypes from "prop-types";
import { useSelector, useDispatch } from "react-redux";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { closeWindow } from "features/ui_slice"; 
import { getEntity } from "features/entities_slice";

import Draggable from "react-draggable";
import { Name } from "components/name";

export function Info({ windowId, entityId, x, y }) {
  const dispatch = useDispatch();
  const close = React.useCallback(() =>
    dispatch(closeWindow(windowId)), [dispatch]);

  const entity = useSelector(getEntity(entityId));

  return (
    <Draggable handle=".handle" bounds="parent" defaultPosition={{ x, y }}>
      <div className='panel'>
        <div onClick={close} className='close'><FontAwesomeIcon icon="times"/></div>
        <h1 className="handle">{entity.nameable ? <Name nameable={entity.nameable}/> : "Information" }</h1>
        { entity.mappable && (<div>Terrain type: <strong>{entity.mappable.terrain}</strong></div>) }
        <div>More description goes here</div>
        <div className='debug' style={{color: "red"}}>
          {
            Object.keys(entity).filter(k => entity[k]).map(k => (<div key={k}>{k} = {JSON.stringify(entity[k])}</div>))
          }
        </div>
      </div>
    </Draggable>
  );
}

Info.propTypes = {
  windowId: PropTypes.string.isRequired,
  entityId: PropTypes.number.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired
};
