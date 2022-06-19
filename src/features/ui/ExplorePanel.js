import { useState } from 'react';

import TileSelectionPanel from "./TileSelectionPanel.js"

import tiles from "../../data/tiles.json"

export default function ExplorePanel() {
  const lut = "Neon 770";

  const [ selection, setSelection ] = useState();
  return (
    <>
    <div className="absolute bottom-0 bg-neutral-800 p-4 inset-x-0 md:bottom-10 md:inset-x-10">
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
        <TileSelectionPanel lut={lut} type="forest" selected={selection === "forest"} callback={setSelection}/>
        <TileSelectionPanel lut={lut} type="coast" selected={selection === "coast"} callback={setSelection}/>
      </div>
    </div>
    </>
  );
}
