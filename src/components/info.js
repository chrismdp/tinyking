import React from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { closeWindow } from "features/ui_slice"; 

import Draggable from "react-draggable";

export function Info({ windowId, entity, x, y }) {
  const dispatch = useDispatch();
  const close = React.useCallback(() =>
    dispatch(closeWindow(windowId)), [dispatch]);

  return (
    <Draggable handle=".handle" bounds="parent" defaultPosition={{ x, y }}>
      <div className='panel'>
        <div onClick={close} className='close'><FontAwesomeIcon icon="times"/></div>
        <h1 className="handle">Info for {entity}</h1>
        <p>info here</p>
      </div>
    </Draggable>
  );
}

Info.propTypes = {
  windowId: PropTypes.number.isRequired,
  entity: PropTypes.number.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired
};
