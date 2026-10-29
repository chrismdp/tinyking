import React from "react";
import PropTypes from "prop-types";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Draggable from "react-draggable";

import { GameState } from "components/contexts";

export function Window({ windowId, x, y, children }) {
  const state = React.useContext(GameState);
  const close = React.useCallback(() => state.ui.actions.close_window(windowId), [state, windowId]);
  // NOTE: react-draggable finds the panel through this ref; React 19 has no
  // findDOMNode for it to fall back on
  const panel = React.useRef(null);

  const fixed = window.innerWidth < 500;

  let attrs = { disabled: !!fixed };
  if (!fixed) {
    attrs.defaultPosition = { x, y };
  }

  return (
    <div className='desktop'>
      <Draggable nodeRef={panel} handle=".handle" bounds="parent" {...attrs}>
        <div ref={panel} className='panel'>
          <div onClick={close} className='close'><FontAwesomeIcon icon="times"/></div>
          {children}
        </div>
      </Draggable>
    </div>
  );
}

Window.propTypes = {
  windowId: PropTypes.string.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  children: PropTypes.object,
  onclose: PropTypes.func
};
