import React from "react";
import { useSelector } from "react-redux";

import { World } from "components/world";
import { UserInterface } from "components/user_interface";
import { getPlayerId } from "features/entities_slice";
import { PlayerContext } from "components/player_context";

export function Game() {
  const playerId = useSelector(getPlayerId);
  return (
    <div id="game">
      <PlayerContext.Provider value={playerId}>
        <World/>
        <UserInterface/>
      </PlayerContext.Provider>
    </div>
  );
}
