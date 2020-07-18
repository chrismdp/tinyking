import React from "react";
import PropTypes from "prop-types";

export function MapGenParams({ seed, onChange }) {
  const input = React.useRef();

  return (
    <div className='panel'>
      <h1>Map generation</h1>
      <label>Random seed:
        <input type='text' ref={input} defaultValue={seed}/></label>
      <button onClick={() => onChange(input.current.value)}>Generate map</button>
    </div>
  );
}

MapGenParams.propTypes = {
  seed: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};
