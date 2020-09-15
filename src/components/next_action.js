import React from "react";
import { GameState } from "components/contexts";

import { useTranslate } from "react-polyglot";
import { directlyControlledBy } from "game/playable";

export function NextAction() {
  const state = React.useContext(GameState);
  const toAssign = directlyControlledBy(state.ecs, state.ui.playerId).reduce((total, e) => total + (state.ecs.assignable[e.id].task ? 0 : 1), 0);

  const t = useTranslate();

  return (
    <div id="next-action">
      <button onClick={state.ui.actions.end_turn}>{t(toAssign > 0 ? "next_action.left" : "next_action.end_turn", { to_assign: toAssign})}</button>
    </div>
  );
}
