import React from "react";
import PropTypes from "prop-types";
import { GameState } from "./contexts";
import { destinationFor, SIDE_NAMES, DEPARTURE_POLICY, TRANSITION_NEEDS } from "game/travel";
import { canReachTask } from "game/manager";
export function TravelOffer({
  entityId
}) {
  const s = React.useContext(GameState),
    d = s.world && s.map && destinationFor(s, entityId);
  if (!d) return null;
  const reachable = canReachTask(s, s.ui.playerId, entityId);
  return <section className="travel-offer" aria-label="Travel to a neighbouring world hex">
    <h3>{d.name} · {d.hex?.ocean ? "ocean" : d.hex?.biome || "world boundary"}</h3>
    <p>{SIDE_NAMES[d.side]} edge → arrive at the {SIDE_NAMES[d.arrivalSide]} edge.</p>
    {d.blocked ? <p role="status">{d.blocked}</p> : <>
      <p>{TRANSITION_NEEDS}</p><p>{DEPARTURE_POLICY}</p>
      {!reachable && <p role="status">There is no walkable path to this edge.</p>}
      <button disabled={!reachable || s.worldBusy} onClick={() => s.ui.actions.travel(entityId)}>Travel</button>
    </>}
    <button onClick={() => s.ui.actions.dismiss_travel()}>Stay here</button>
  </section>;
}
TravelOffer.propTypes = {
  entityId: PropTypes.string.isRequired
};
