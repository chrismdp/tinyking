import { useSelector, useDispatch } from 'react-redux';

import { hide, setExploreSelection } from "./uiSlice.js";
import { addTile } from "../map/mapSlice.js";

import TileSelectionPanel from "./TileSelectionPanel.js"

import tiles from "../../data/tiles.json"

import { XIcon } from "@heroicons/react/outline";

export default function ExplorePanel({ visible }) {
  const dispatch = useDispatch();

  const lut = "Neon 770";
  const selection = useSelector(state => state.ui.explore.selection)
  const selectedTile = useSelector(state => state.ui.explore.hex);

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
          <p>Choose what you find as you explore...</p>
        </>
      ) }
      <div className="flex overflow-auto max-w-full pt-4">
        {
          ["quiet-woodland", "coast", "grass"].map((type) => <TileSelectionPanel key={type} lut={lut} type={type} selected={selection === type} callback={() => dispatch(setExploreSelection(type))}/>)
        }
      </div>
      <div className="absolute top-2 right-2"><XIcon className="h-5 w-5" onClick={() => dispatch(hide())}/></div>
      { selection &&
        <div className="absolute bottom-2 right-2">
          <button onClick={() => dispatch(addTile({ ...selectedTile, type: selection }))} className="m-2 px-8 py-2 bg-lime-900 text-neutral-100 font-title text-xl">Confirm</button>
        </div>
      }
    </div>
  );
}
