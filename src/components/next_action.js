import React from "react";
import { GameState } from "components/contexts";

import { useTranslate } from "react-polyglot";
import { directlyControlledBy } from "game/playable";

export function NextAction() {
  const state = React.useContext(GameState);
  const haveMovesOrActions = [
    state.ui.playerId,
    ...directlyControlledBy(state.ecs, state.ui.playerId).map(p => p.id)
  ].filter(id => state.ecs.attributes[id].moves > 0 || !state.ecs.assignable.task)
    .length;

  const t = useTranslate();

  return (
    <div id="next-action">
      <button onClick={state.ui.actions.end_turn}>
        {t(haveMovesOrActions > 0 ? "next_action.left" : "next_action.end_turn",
          { to_assign: haveMovesOrActions})}
      </button>
    </div>
  );
}
