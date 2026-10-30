import React from "react";
import { GameState } from "components/contexts";
import { displayName } from "game/knowledge";
import { knownEvents, eventSentence } from "game/events";

export function EventFeed() {
  const state = React.useContext(GameState);
  const display = id => displayName(state, id);
  const events = knownEvents(state, state.ui.playerId).filter(e => ["marriage", "birth", "death", "quarrel", "reconciliation", "inheritance", "gift", "visit", "move"].includes(e.type)).slice(-12).reverse();
  return <details className="event-feed"><summary>Village news <span>{events.length || ""}</span></summary>
    <div className="event-entries">{events.length ? events.map(e => <button key={e.id} aria-label={"Select " + display(e.people[0])} onClick={() => state.ui.actions.select_entity(e.people[0], false)}>{eventSentence(state, e, display)}</button>) : <p>Village life is quiet. News will appear here.</p>}</div>
  </details>;
}
