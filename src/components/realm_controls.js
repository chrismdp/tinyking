import React from "react";
import { GameState } from "./contexts";
import { toggleWorldMap, handleWorldMapKey } from "game/realm_map";

export function RealmControls() {
  const s = React.useContext(GameState);
  React.useEffect(() => {
    const key = event => handleWorldMapKey(event, s);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [s]);
  return <div id="realm-controls"><div id="camera-actions">
    <button aria-label="World map" aria-pressed={!!s.ui.show.world_overview} onClick={() => { toggleWorldMap(s); s.ui.actions.end_turn(); }}>◇ World map · M</button>
    <button aria-label="Recenter on you" onClick={() => s.renderer?.recenter()}>◎ You</button>
  </div></div>;
}
