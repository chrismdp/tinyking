import { useSelector, useDispatch } from 'react-redux';

import { hide, setExploreSelection } from "./uiSlice.js";

import TileSelectionPanel from "./TileSelectionPanel.js"

import tiles from "../../data/tiles.json"

import { XIcon } from "@heroicons/react/outline";

export default function ExplorePanel({ visible }) {
  const dispatch = useDispatch();

  const lut = "Neon 770";
  const selection = useSelector(state => state.ui.explore.selection)

  let classes = "absolute bottom-0 bg-neutral-800 p-4 inset-x-0 md:bottom-10 md:inset-x-10";
  if (!visible) {
    classes += " hidden";
  }

  return (
    <div className={classes}>
      { selection && (
        <>
          <h1 className="font-title text-2xl">{tiles[selection].name}</h1>
          <p>{tiles[selection].description}</p>
        </>
      ) }
      { !selection && (
        <>
          <h1 className="font-title text-2xl">What will you discover?</h1>
          <p>Choose a tile to place.</p>
        </>
      ) }
      <div className="flex overflow-auto max-w-full pt-4">
        <TileSelectionPanel lut={lut} type="forest" selected={selection === "forest"} callback={() => dispatch(setExploreSelection("forest"))}/>
        <TileSelectionPanel lut={lut} type="coast" selected={selection === "coast"} callback={() => dispatch(setExploreSelection("coast"))}/>
      </div>
      <div className="absolute top-2 right-2"><XIcon class="h-5 w-5" onClick={() => dispatch(hide())}/></div>
    </div>
  );
}
