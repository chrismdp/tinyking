import { useState } from 'react';

import TileSelectionPanel from "./TileSelectionPanel.js"

export default function ExplorePanel() {
  const lut = "Neon 770";

  const [ selection, setSelection ] = useState();
  return (
    <>
    <div className="absolute bottom-0 bg-neutral-800 p-4 inset-x-0 md:bottom-10 md:inset-x-10">
      { selection && (
        <>
          <h1 className="font-title text-2xl">{selection}:</h1>
          <p>Foo bar haz</p>
        </>
      ) }
      { !selection && (<h1 className="font-title text-2xl">Choose a tile</h1>) }
      <div className="flex overflow-auto max-w-full pt-4">
        <TileSelectionPanel lut={lut} type="forest" selected={selection === "forest"} callback={setSelection}/>
        <TileSelectionPanel lut={lut} type="coast" selected={selection === "coast"} callback={setSelection}/>
      </div>
    </div>
    </>
  );
}
