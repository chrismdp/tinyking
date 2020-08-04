import React from "react";
import { useSelector, useDispatch } from "react-redux";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { toggleDebugMapLayer } from "features/ui_slice";
import { getMapSeed, generate } from "features/map_slice";

export function MapGenParams() {
  const input = React.useRef();
  const mapLayer = useSelector(state => state.ui.debug.mapLayer);
  const seed = useSelector(getMapSeed);
  const progress = useSelector(state => state.map.progress);

  const dispatch = useDispatch();
  const clickedMapLayer = React.useCallback(() =>
    dispatch(toggleDebugMapLayer()), [dispatch]);
  const clickedGenerate = React.useCallback((seed) =>
    dispatch(generate({ seed })), [dispatch]);

  return (
    <div>
      <h1 className="handle">Custom game</h1>
      <div className='row'>
        <label htmlFor='seed'>Random seed:</label>
        <input id='seed' type='text' ref={input} defaultValue={seed}/>
        <button onClick={() => input.current.value = Math.round(Math.random() * 10000000)}><FontAwesomeIcon icon="dice"/></button>
      </div>
      <div className='row'>
        <label htmlFor='mapLayer'>Show debug map layer:</label>
        <input id='mapLayer' type='checkbox' defaultValue={mapLayer} onChange={clickedMapLayer}/>
      </div>
      <div className='row'>
        <button onClick={() => clickedGenerate(input.current.value)}>Generate map</button>
        { progress.label && <div className='progress'>{progress.label}</div> }
      </div>
    </div>
  );
}
