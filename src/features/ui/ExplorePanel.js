import { useSelector, useDispatch } from 'react-redux';

import { animated, useSpring, config } from '@react-spring/web';
import { hide, setExploreSelection } from "./uiSlice.js";
import { addTile } from "../map/mapSlice.js";

import TileSelectionPanel from "./TileSelectionPanel.js"

import tiles from "../../data/tiles.json"

import { XIcon } from "@heroicons/react/outline";

export default function ExplorePanel({ visible }) {
  const dispatch = useDispatch();

  const lut = "Neon 770";
  const { hex, availableTiles, selection } = useSelector(state => state.ui.explore);
  const paddedTiles = Array.from({ ...availableTiles, length: 3 });

  const styles = useSpring({
    to: { transform: `translateY(${visible ? 0 : 300 }px)` },
    config: config.stiff
  });

  let classes = "z-top absolute bg-neutral-800 p-4 inset-x-0 bottom-0 md:bottom-10 md:inset-x-10";

  return (
    <animated.div style={styles} className={classes}>
      { selection && (
        <>
          <h1 className="font-title text-2xl">{tiles[selection].name}</h1>
          <p>{tiles[selection].description}</p>
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
          paddedTiles.map((type, index) => <TileSelectionPanel key={index} lut={lut} type={type} selected={selection === type} callback={() => dispatch(
            selection === type ?
              addTile({ ...hex, type: selection }) :
              setExploreSelection(type)
          )}/>)
        }
      </div>
      <div className="absolute top-2 right-2"><XIcon className="h-5 w-5" onClick={() => dispatch(hide())}/></div>
    </animated.div>
  );
}
