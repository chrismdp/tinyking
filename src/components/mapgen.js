import React from "react";
import PropTypes from "prop-types";

export function MapGenParams({ seed, onChange }) {
  const input = React.useRef();

  return (
    <div className='panel'>
      <label>Random seed:
        <input type='text' ref={input} defaultValue={seed}/></label>
      <button onClick={() => onChange(input.current.value)}>Regenerate</button>
    </div>
  );
}

MapGenParams.propTypes = {
  seed: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};
