import { useState } from 'react';
import { useSelector } from 'react-redux';

import { explorePanelVisible } from "./features/ui/uiSlice.js"
import ExplorePanel from "./features/ui/ExplorePanel.js"

import './App.css';

import Map from "./features/map/Map.js"

function App() {
  // const dispatch = useDispatch();

  const [ lut ] = useState("Bourbon 64");

  const explore = useSelector(explorePanelVisible);

  return (
    <div className="h-screen text-white">
      <Map lut={lut} />
      <ExplorePanel visible={!!explore}/>
    </div>
  );
}

export default App;
