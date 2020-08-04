import React from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { closeWindow } from "features/ui_slice"; 

import Draggable from "react-draggable";

export function Window({ windowId, x, y, onclose, children }) {
  const dispatch = useDispatch();
  const close = React.useCallback(() => {
    dispatch(closeWindow(windowId));
    if (onclose) {
      onclose();
    }
  }, [dispatch]);

  const fixed = window.innerWidth < 500;

  var attrs = { disabled: !!fixed };
  if (!fixed) {
    attrs.defaultPosition = { x, y };
  }

  return (
    <Draggable handle=".handle" bounds="parent" {...attrs}>
      <div className='panel'>
        <div onClick={close} className='close'><FontAwesomeIcon icon="times"/></div>
        {children}
      </div>
    </Draggable>
  );
}

Window.propTypes = {
  windowId: PropTypes.string.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  children: PropTypes.object,
  onclose: PropTypes.func
};
