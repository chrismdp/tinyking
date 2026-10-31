import { playerOrderAllowed } from "game/manager";
import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { displayName } from "game/knowledge";
import { name } from "game/name";
import { Hex } from "game/hex";
import { visibleFavours, favourTitle, favourQuantity, householdStore } from "game/favours";
import { harvestCounts } from "game/harvest_task";

export function RequestCard({ request: r }) {
  const s = React.useContext(GameState);
  const giver = displayName(s, r.giverId, id => name(s.ecs.nameable[id]));
  const point = s.ecs.spatial[r.targetId], at = point && Hex().fromPoint(point);
  const home = s.ecs.spatial[householdStore(s, r.householdId)], destination = home && Hex().fromPoint(home);
  return <article className={"favour-request " + r.status} data-favour-id={r.id}>
    <strong>{giver}</strong><h4>{favourTitle(r)} · {favourQuantity(r)}</h4>
    <p>{r.reason}</p><small>{r.kind == "harvest" ? "Family field" : "Household stores"}{at && ` · tile ${at.x}, ${at.y}`}</small>
    {r.kind == "harvest" && destination && <small>Deliver to household · tile {destination.x}, {destination.y}</small>}
    <div className="request-bottom"><span className="reward">+{r.goodwill} goodwill</span>
      {r.status == "offered" ? <button disabled={!playerOrderAllowed(s,"favour")} aria-label={"Accept favour: " + favourTitle(r) + " for " + giver} onClick={() => s.ui.actions.accept_favour(r.id)}>Accept</button> : <strong className="request-state">{r.status[0].toUpperCase() + r.status.slice(1)}</strong>}
    </div>
    {r.kind == "harvest" && ["accepted", "completed"].includes(r.status) ? <small>{harvestCounts(s, r)}</small> :
      r.status == "accepted" && <small>{r.progress}/{r.quantity} delivered · {r.delivered} carried home</small>}
    {!playerOrderAllowed(s,"favour") && <small>Adult work. Children can help at home when crops need care.</small>}
    {r.outcome && <p role="status">{r.outcome}</p>}
  </article>;
}
RequestCard.propTypes = { request: PropTypes.object.isRequired };

function Requests({ requests }) {
  return <div className="request-content">{requests.length ? requests.map(r => <RequestCard key={r.id} request={r}/>) : <p className="request-note">No requests just now. Meet people nearby.</p>}
    <p className="request-note">Accept adds a favour to your queue. Goodwill comes when the work is done.</p></div>;
}
Requests.propTypes = { requests: PropTypes.array.isRequired };
export function RequestList() {
  const s = React.useContext(GameState), all = visibleFavours(s);
  const active = all.filter(r => ["offered", "accepted"].includes(r.status));
  const requests = [...active, ...all.filter(r => !active.includes(r)).slice(-3).reverse()];
  return <details className="favour-list"><summary>Favours · {active.length} requests</summary><Requests requests={requests}/></details>;
}
export function PersonRequests({ personId }) {
  const s = React.useContext(GameState), all = visibleFavours(s, personId);
  return <details className="person-requests"><summary>Offer help · {all.filter(r => r.status == "offered").length} requests</summary><Requests requests={all.filter(r => ["offered", "accepted"].includes(r.status)).concat(all.filter(r => !["offered", "accepted"].includes(r.status)).slice(-2).reverse())}/></details>;
}
PersonRequests.propTypes = { personId: PropTypes.string.isRequired };
