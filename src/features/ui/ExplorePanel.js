import { useSelector, useDispatch } from 'react-redux';

import { animated, useSpring, config } from '@react-spring/web';
import { hide, setExploreSelection } from "./uiSlice.js";
import { chooseTerrain } from "../map/mapSlice.js";

import TileSelectionPanel from "./TileSelectionPanel.js"

import TERRAINS from "../../data/terrains.json"

import { XIcon } from "@heroicons/react/outline";

export default function ExplorePanel({ visible }) {
  const dispatch = useDispatch();

  const lut = "Neon 770";
  const { hex, availableTerrains, selection } = useSelector(state => state.ui.explore);

  const styles = useSpring({
    to: { transform: `translateY(${visible ? 0 : 300 }px)` },
    config: config.stiff
  });

  let classes = "z-top absolute bg-neutral-800 p-4 inset-x-0 bottom-0 md:bottom-10 md:inset-x-10";

  return (
    <animated.div style={styles} className={classes}>
      { selection && (
        <>
          <h1 className="font-title text-2xl">{TERRAINS[selection].name}</h1>
          <p>{TERRAINS[selection].description}</p>
        </>
      ) }
      { !selection && (
        <>
          <h1 className="font-title text-2xl">What will you discover?</h1>
          <p>Choose what you find as you explore...</p>
        </>
      ) }
      <div className="flex overflow-auto max-w-full pt-4">
        {
          availableTerrains.map((terrain, index) => <TileSelectionPanel key={index} lut={lut} terrain={terrain} selected={selection === terrain} callback={() => dispatch(
            selection === terrain ?
              chooseTerrain({ ...hex, terrain: selection }) :
              setExploreSelection(terrain)
          )}/>)
        }
      </div>
      <div className="absolute top-2 right-2"><XIcon className="h-5 w-5" onClick={() => dispatch(hide())}/></div>
    </animated.div>
  );
}
