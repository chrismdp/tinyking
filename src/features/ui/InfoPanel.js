import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { animated, useSpring, config } from '@react-spring/web';
import { chooseTerrain, hide } from "./uiSlice.js";
import { areaEffects } from "../map/mapSlice.js";

import TileSelectionPanel from "./TileSelectionPanel.js"
import Tags from "./Tags.js"

import { XIcon } from "@heroicons/react/outline";

import Engine from "json-rules-engine-simplified"

import EFFECTS from "../../data/effects.json";
import BUILDINGS from "../../data/buildings.json";
import TILES from "../../data/tiles.json";

const rules = Object.keys(EFFECTS).flatMap(effect =>
  Object.keys(EFFECTS[effect]).map(option => ({
    event: { effect, option },
    conditions:  {
      [effect]: { greaterEq: EFFECTS[effect][option].min }
    }
  }))
);

const engine = new Engine(rules);

export default function InfoPanel({ visible }) {
  const dispatch = useDispatch();

  const { hex, availableTerrains, display, type } = useSelector(state => state.ui.panel);
  const tiles = useSelector(state => state.map.tiles);

  const [ effects, setEffects ] = useState({});
  const [ effectTags, setEffectTags ] = useState([]);

  useEffect(() => {
    setEffects(areaEffects(tiles, hex));
  }, [tiles, hex]);

  useEffect(() => {
    (async () => {
      const events = await engine.run(effects);
      const last = events.reduce((memo, event) => (
        { ...memo, [event.effect]: event.option }
      ), {})
      const tags = Object.keys(last).map(effect =>
        EFFECTS[effect][last[effect]].label || "").filter(x => x).map(t => t + " area");
      setEffectTags(tags);
    })();
  }, [effects]);

  const styles = useSpring({
    to: { transform: `translateY(${visible ? 0 : 300 }px)` },
    config: config.stiff
  });

  let classes = "z-top absolute bg-neutral-800 p-4 inset-x-0 bottom-0 md:bottom-10 md:inset-x-10";

  return (
    <animated.div style={styles} className={classes}>
      { display === "selection" && <h1 className="font-title text-2xl">What will you discover?</h1> }
      { display === "building" && <>
          <h1 className="font-title text-2xl">{BUILDINGS[type].name}</h1>
          <p>{BUILDINGS[type].description}</p>
        </>
      }
      { display === "tile" && <>
          <h1 className="font-title text-2xl">{TILES[type].name}</h1>
          <p>{TILES[type].description}</p>
        </>
      }

      {effectTags && <div className="mt-2">
        <Tags tags={effectTags}/>
      </div>}
      <div className="flex overflow-auto max-w-full pt-4">
        { availableTerrains &&
          availableTerrains.map((terrain, index) =>
            <TileSelectionPanel
              key={index}
              terrain={terrain}
              callback={() => dispatch(chooseTerrain({ ...hex, effects, terrain })) }/>)
        }
      </div>
      <div className="absolute top-2 right-2"><XIcon className="h-5 w-5" onClick={() => dispatch(hide())}/></div>
    </animated.div>
  );
}
