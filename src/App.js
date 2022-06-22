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

  const year = new Date().getFullYear();

  return (
    <div className="h-screen text-neutral-100">
      <Map lut={lut} />
      <div className="absolute top-0 left-0 p-5">
        <h1 className="font-title text-3xl">Tiny King</h1>
        <p className="text-xs opacity-50 w-60">Relaxed kingdom building and defence</p>
      </div>
      <div className="absolute bottom-0 left-0 p-5">
        <p className="text-xs opacity-50">
          Gameplay prototype {process.env.REACT_APP_GIT_SHA}
          <br/>
          Copyright &copy; {year} Think Code Learn Ltd t/a Revelation Games
        </p>
      </div>
      <div className="absolute bottom-0 right-0 p-5">
        <div className="flex opacity-50">
          <a href="https://discord.gg/ZgXcVyn" target="_blank" rel="noreferrer"><img src="https://img.shields.io/discord/731912590489288795?color=417154&label=discord"/></a>
          <a className="pl-2" href="https://github.com/chrismdp/tinyking/" target="_blank" rel="noreferrer"><img src="https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1"/></a>
        </div>
      </div>
      <ExplorePanel visible={!!explore}/>
    </div>
  );
}

export default App;
