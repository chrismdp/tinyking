import { useSelector, useDispatch } from 'react-redux';

import { animated, useSpring, config } from '@react-spring/web';
import { chooseTerrain, hide } from "./uiSlice.js";
import { removeZeroValues, areaEffects } from "../map/mapSlice.js";

import TileSelectionPanel from "./TileSelectionPanel.js"

import { XIcon } from "@heroicons/react/outline";

export default function ExplorePanel({ visible }) {
  const dispatch = useDispatch();

  const { hex, availableTerrains } = useSelector(state => state.ui.panel);
  const tiles = useSelector(state => state.map.tiles);
  const effects = areaEffects(tiles, hex);

  const styles = useSpring({
    to: { transform: `translateY(${visible ? 0 : 300 }px)` },
    config: config.stiff
  });

  let classes = "z-top absolute bg-neutral-800 p-4 inset-x-0 bottom-0 md:bottom-10 md:inset-x-10";

  return (
    <animated.div style={styles} className={classes}>
      <>
        <h1 className="font-title text-2xl">What will you discover?</h1>
        <p>{JSON.stringify(removeZeroValues(effects))}</p>
      </>
      <div className="flex overflow-auto max-w-full pt-4">
        { availableTerrains &&
          availableTerrains.map((terrain, index) => 
            <TileSelectionPanel
              key={index}
              terrain={terrain}
              callback={() => dispatch(chooseTerrain({ ...hex, terrain })) }/>)
        }
      </div>
      <div className="absolute top-2 right-2"><XIcon className="h-5 w-5" onClick={() => dispatch(hide())}/></div>
    </animated.div>
  );
}
