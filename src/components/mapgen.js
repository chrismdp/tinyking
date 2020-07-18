import React from "react";
import PropTypes from "prop-types";

export function MapGenParams(props) {
  const [seed, setSeed] = React.useState("");
  const handleInputChange = (e) => {
    e.persist();
    setSeed(e.target.value);
  };

  React.useLayoutEffect(() => {
    console.log("MAPGEN: set seed to ", props.seed);
    setSeed(props.seed);
  }, [props.seed]);

  return (
    <div className='panel'>
      <label>Random seed:
        <input type='text' value={seed} onChange={handleInputChange}/></label>
      <button onClick={() => props.onChange(seed)}>Regenerate</button>
    </div>
  );
}

MapGenParams.propTypes = {
  seed: PropTypes.string,
  onChange: PropTypes.func
};
