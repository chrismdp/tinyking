import React from "react";
import { GameState } from "components/contexts";
import { Overworld, BiomeKey } from "components/overworld";
import { homeOf } from "game/overworld";

export function DebugWorldgen() {
  const state = React.useContext(GameState);

  // TODO: This isn't right - we should have the different main menu states
  // managed through different components

  if (state.ui) {
    state.ui.show.main_menu = false;
  }

  if (state.renderer) {
    state.renderer.showWholeMap({ besidePanel: true });
  }

  const home = state.world && state.map && homeOf(state.world);

  return (
    <div id="ui">
      <div className="worldgen">
        <h2>Debug worldgen</h2>
        { home && <>
          <p>Seed {String(state.map.seed)}: playing a {home.biome} world hex
            ({home.morality}, {home.temperature}, {home.moisture}), outlined in red.</p>
          <Overworld world={state.world} size={36} labels={true}/>
          <BiomeKey/>
          <p className="knockedback">Gold dot: good. Purple dot: evil. Neighbouring world hexes
            differ by one step at most on each axis.</p>
        </> }
      </div>
    </div>
  );
}
