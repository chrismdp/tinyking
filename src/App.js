import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Stats } from "@react-three/drei";

import { explorePanelVisible } from "./features/ui/uiSlice.js"
import ExplorePanel from "./features/ui/ExplorePanel.js"

import './App.css';

import Map from "./features/map/Map.js"
import { removeZeroValues, tileResources } from "./features/map/mapSlice.js"

function App() {
  // const dispatch = useDispatch();

  const [ lut ] = useState("Bourbon 64");

  const explore = useSelector(explorePanelVisible);
  const resources = useSelector(tileResources);

  const year = new Date().getFullYear();

  const [ stats, setStats ] = useState(false);

  return (
    <div className="h-screen text-neutral-100">
      { stats && <Stats/> }
      <Map lut={lut} />
      <div className="absolute top-0 p-5 pointer-events-none">
        <h1 className="font-title text-3xl">Tiny King</h1>
        <p className="text-xs opacity-50 w-60">Relaxed storytelling, map making, kingdom building and defence</p>
      </div>
      { Object.keys(resources).length > 0 &&
        <div className="absolute top-0 right-0 p-5">
          <ul>
            { Object.keys(removeZeroValues(resources)).map(k => <li key={k} className="font-title text-lg">{k.charAt(0).toUpperCase() + k.slice(1)}: {resources[k]}</li>) }
          </ul>
        </div>
      }
      <div className="absolute bottom-10 sm:bottom-0 p-5">
        <p className="text-xs opacity-50">
          Gameplay prototype {process.env.REACT_APP_GIT_SHA}i
          &nbsp;(<button onClick={() => setStats(!stats)}>debug stats</button>)
          <br/>
          Copyright &copy; {year} Think Code Learn Ltd t/a Revelation Games
        </p>
      </div>
      <div className="absolute bottom-0 sm:right-0 p-5 select-none">
        <div className="flex opacity-50">
          <a href="https://discord.gg/ZgXcVyn" target="_blank" rel="noreferrer"><img src="https://img.shields.io/discord/731912590489288795?color=417154&label=discord" alt="Discord link"/></a>
          <a className="pl-2" href="https://github.com/chrismdp/tinyking/" target="_blank" rel="noreferrer"><img src="https://img.shields.io/github/stars/chrismdp/tinyking?color=417154&label=github&logo=github1" alt="Github link"/></a>
        </div>
      </div>
      <ExplorePanel visible={!!explore}/>
    </div>
  );
}

export default App;
