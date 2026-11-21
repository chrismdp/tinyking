import React from "react";
import PropTypes from "prop-types";
import { GameState } from "./contexts";
import { openingGuidance } from "game/guidance";

export function OpeningGuidance({recoveryOnly=false}) {
  const state=React.useContext(GameState),hint=openingGuidance(state);
  if(!hint || recoveryOnly && hint.key!="move_closer")return null;
  return <aside id={recoveryOnly?undefined:"opening-guidance"} className={recoveryOnly?"chat-recovery":undefined} aria-label={recoveryOnly?"Conversation recovery":"Getting started"}><span>{hint.text}</span>{hint.action && <button onClick={() => hint.selectId ? state.ui.actions.select_entity(hint.selectId,false) : hint.job ? state.ui.actions.choose_job(hint.actorId,{key:hint.job},hint.targetId || hint.actorId) : state.ui.actions.talk_to(hint.targetId,"chat")}>{hint.action}</button>}</aside>;
}
OpeningGuidance.propTypes={recoveryOnly:PropTypes.bool};
