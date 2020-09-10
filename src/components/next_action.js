import React from "react";
import { GameState } from "components/contexts";

import { useTranslate } from "react-polyglot";

export function NextAction() {
  const state = React.useContext(GameState);
  const toAssign = state.ecs.playable[state.ui.playerId].controls.reduce((total, id) => state.ecs.assignable[id].task ? 0 : 1, 0);

  const t = useTranslate();

  return (
    <div id="next-action">
      <button onClick={state.ui.actions.end_turn}>{t(toAssign > 0 ? "next_action.left" : "next_action.end_turn", { to_assign: toAssign})}</button>
    </div>
  );
}
