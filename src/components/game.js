import React from "react";
import { useSelector } from "react-redux";

import { World } from "components/world";
import { UserInterface } from "components/user_interface";
import { MainMenu } from "components/main_menu";
import { getPlayerId } from "features/entities_slice";

export function Game() {
  const playerId = useSelector(getPlayerId);
  return (
    <div id="game">
      <World playerId={playerId}/>
      <UserInterface/>
      <MainMenu/>
    </div>
  );
}
