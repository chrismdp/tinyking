import React from "react";
import PropTypes from "prop-types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function MapGenParams({ seed, onChange }) {
  const input = React.useRef();

  return (
    <div className='panel'>
      <h1>Map generation</h1>
      <div className='row'>
        <label htmlFor='seed'>Random seed:</label>
        <input id='seed' type='text' ref={input} defaultValue={seed}/>
        <button onClick={() => input.current.value = Math.round(Math.random() * 10000000)}><FontAwesomeIcon icon="dice"/></button>
      </div>
      <button onClick={() => onChange(input.current.value)}>Generate map</button>
    </div>
  );
}

MapGenParams.propTypes = {
  seed: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};
