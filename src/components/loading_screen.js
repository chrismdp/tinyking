import React from "react";
import PropTypes from "prop-types";

export function LoadingScreen({ progress = {} }) {
  const { label = "Preparing your world", value = 0 } = progress;
  return <div id="loading-screen" aria-busy="true">
    <div className="loading-card">
      <div className="loading-kicker">A life among people</div>
      <h1>Tiny King</h1>
      <p role="status" aria-live="polite">{label}</p>
      <progress aria-label="World loading progress" max="1" value={value}/>
      <span className="loading-amount">{Math.floor(value * 100)}%</span>
    </div>
  </div>;
}
LoadingScreen.propTypes = { progress: PropTypes.shape({ label: PropTypes.string, value: PropTypes.number }) };
