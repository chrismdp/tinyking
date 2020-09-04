import React from "react";

import { GameState } from "components/contexts";

export function GameOver() {
  return (
    <div id="game-over">
      <div className="header">
        <div className="main">Game Over</div>
        <div className="strapline">All your characters have died.</div>
      </div>
      <menu>
        <li><a onClick={() => window.location.reload(false)}>Return to Main Menu</a></li>
      </menu>
    </div>);
}
