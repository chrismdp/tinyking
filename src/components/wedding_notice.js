import React from "react";
import { GameState } from "components/contexts";

export function WeddingNotice() {
  const state = React.useContext(GameState);
  const wedding = state.wedding;
  if (!wedding || wedding.until <= state.days || state.ui.dismissedWeddingEvent == wedding.eventId) return null;
  return <aside className="succession-message wedding-message" role="status"><button aria-label="Dismiss wedding notice" onClick={() => {state.ui.dismissedWeddingEvent=wedding.eventId;state.ui.actions.end_turn();}}>×</button>A wedding! The couple celebrates with their families.</aside>;
}
