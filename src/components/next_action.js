import React from "react";
import { GameState } from "components/contexts";

export function NextAction() {
  const state = React.useContext(GameState);
  const toAssign = state.ecs.playable[state.ui.playerId].controls.reduce((total, id) => state.ecs.assignable[id].task ? 0 : 1, 0);

  return (
    <div id="next-action">
      {toAssign > 0 &&
        <button disabled="disabled">{toAssign} left to assign</button>
        || <button onClick={state.ui.actions.end_turn}>End Turn</button>}
    </div>
  );
}
