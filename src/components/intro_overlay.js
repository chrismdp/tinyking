import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";

export function IntroOverlay({ touch = typeof navigator != "undefined" && navigator.maxTouchPoints > 0 }) {
  const state = React.useContext(GameState);
  const skip = state.ui.actions.skip_intro;
  React.useEffect(() => {
    const key = e => {
      if (e.code == "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        skip();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [skip]);
  return <button id="intro-skip" onClick={e => { e.stopPropagation(); skip(); }}><span>{touch ? "Tap to skip" : "Click to skip"}</span></button>;
}

IntroOverlay.propTypes = { touch: PropTypes.bool };
