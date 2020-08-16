import React from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GameState } from "components/contexts";

export function MapGenParams() {
  const input = React.useRef();
  const state = React.useContext(GameState);

  const seed = state.map.seed;
  const progress = state.ui.progress || {};

  const randomiseSeed = React.useCallback(() => input.current.value = Math.round(Math.random() * 10000000), []);

  return (
    <div>
      <h1 className="handle">Custom game</h1>
      <div className='row'>
        <label htmlFor='seed'>Random seed:</label>
        <input id='seed' type='text' ref={input} defaultValue={seed}/>
        <button onClick={randomiseSeed}><FontAwesomeIcon icon="dice"/></button>
      </div>
      <div className='row'>
        <button onClick={() => state.ui.actions.generate_map(input.current.value)}>Generate map</button>
        { progress.label && <div className='progress'>{progress.label}</div> }
      </div>
    </div>
  );
}
