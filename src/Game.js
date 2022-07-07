import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslate } from 'react-polyglot';
import { Stats } from "@react-three/drei";

import { eventPanelVisible, infoPanelVisible } from "./features/ui/uiSlice.js"
import InfoPanel from "./features/ui/InfoPanel.js"
import EventPanel from "./features/ui/EventPanel.js"

import Map from "./features/map/Map.js"
import { removeZeroValues, tileResources } from "./features/map/mapSlice.js"
import { turnData, PHASES } from "./features/time/timeSlice.js"

export default function Game() {
  const [ lut ] = useState("Bourbon 64");

  const info = useSelector(infoPanelVisible);
  const event = useSelector(eventPanelVisible);

  const resources = useSelector(tileResources);

  const year = new Date().getFullYear();

  const [ stats, setStats ] = useState(false);

  const t = useTranslate();
  const turn = useSelector(turnData);
  const skippable = PHASES[turn.phase].skippable;

  return (
    <div className="select-none h-screen text-neutral-100">
      { stats && <Stats/> }
      <Map lut={lut} />
      <div className="absolute top-0 p-5 pointer-events-none">
        <h1 className="font-title text-3xl">Tiny King</h1>
        <p className="text-xs opacity-50 w-60">Relaxed storytelling, map making, kingdom building and defence</p>
        <h2 className="text-xl font-title mt-5">{t(`season.${turn.season}`)} year {turn.year} - {t(`phase.${turn.phase}.name`)}</h2>
        <p className="text-xs">{t(`phase.${turn.phase}.description`)}</p>
        {skippable && <div>skip button here TODO</div>}
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
          Gameplay prototype {process.env.REACT_APP_GIT_SHA}
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
      <InfoPanel visible={!!info}/>
      <EventPanel visible={!!event}/>
    </div>
  );
}
