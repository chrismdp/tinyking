import { useState } from 'react';

import './App.css';

import DebugGraphicsInterface from "./DebugGraphicsInterface.js"

import Map from "./Map.js"

import TileSelectionPanel from "./TileSelectionPanel.js"

function App() {
  // const dispatch = useDispatch();

  const [ lut, setLut ] = useState("Bourbon 64");

  const [ tileChoices, setTileChoices ] = useState([]);

  return (
    <div className="h-screen">
      <Map lut={lut} setTileChoices={setTileChoices} />
      <DebugGraphicsInterface lut={lut} setLut={setLut}/>

      {
        (tileChoices.length > 0) && (
          <div className="absolute top-10 bottom-10 left-10 right-10">
            <TileSelectionPanel lut={lut} type="grass"/>
          {
            // TODO: use this when clicking on a tile
            // onClick={() => dispatch(addTile({...selectableTiles[key], type: "grass"}))}/>
          }
          </div>
        )
      }
    </div>
  );
}

export default App;
