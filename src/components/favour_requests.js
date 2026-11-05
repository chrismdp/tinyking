import { playerOrderAllowed } from "game/manager";
import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { displayName } from "game/knowledge";
import { name } from "game/name";
import { taskPlace } from "game/task_places";
import { ASKS, harvestApproach, favourWaiting, canRequestForHousehold, visibleFavours, favourTitle, favourQuantity, householdStore, favourReceiver, FUEL_TRADES } from "game/favours";
import { asksJournal, knownPersonName } from "game/day_view";
import { harvestCounts } from "game/harvest_task";
import { patience } from "game/chat_patience";

function AskCard({ request: r }) {
  const s=React.useContext(GameState),entry=asksJournal(s,[r])[0],giver=knownPersonName(s,entry.giverId);
  return <article className={"favour-request " + entry.status} data-favour-id={r.id}>
    <strong>{giver}</strong><h4>{entry.title}</h4>
    {entry.words && <blockquote>{entry.words}</blockquote>}
    <p>About {entry.targetName}</p>
    {!entry.words && <p>{entry.context}</p>}
    <p role="status">{entry.outcome}</p>
    {!!entry.learned.length && <div><strong>What you learned</strong>{entry.learned.map((text,i)=><p key={i}>{text}</p>)}</div>}
    <div className="request-bottom"><strong className="request-state">{entry.status[0].toUpperCase()+entry.status.slice(1)}</strong></div>
    {r.status=="offered"&&s.ecs.planner?.[entry.giverId]&&<button disabled={patience(s,s.ui.playerId,entry.giverId).free<patience(s,s.ui.playerId,entry.giverId).minimum} onClick={()=>s.ui.actions.talk_to(entry.giverId,"chat")}>Chat with {giver}</button>}
  </article>;
}
AskCard.propTypes={request:PropTypes.object.isRequired};

export function RequestCard({ request: r, personId }) {
  const s = React.useContext(GameState);
  if(ASKS.includes(r.kind))return <AskCard request={r}/>;
  const giverId = r.status == "offered" && personId && canRequestForHousehold(s, r, personId) ? personId : r.giverId;
  const giver = displayName(s, giverId, id => name(s.ecs.nameable[id]));
  const approach=r.kind=="harvest" && r.status=="accepted" && harvestApproach(s,r);
  const receipt = r.receipts?.[r.receipts.length - 1];
  const receiver = r.kind == "wood" ? receipt?.targetId || favourReceiver(s, r) : r.targetId;
  const fuelDelivery = r.kind == "wood" && receiver == r.workplaceId;
  const point = s.ecs.spatial[receiver];
  const destination = householdStore(s, r.householdId);
  return <article className={"favour-request " + r.status} data-favour-id={r.id}>
    <strong>{giver}</strong><h4>{favourTitle(r)} · {favourQuantity(r)}</h4>
    <p>{r.status=="accepted" ? favourWaiting(s,{favourId:r.id}) || s.ecs.manager[s.ui.playerId].jobs.find(j=>j.favourId==r.id)?.waiting || r.reason : r.reason}</p><small>{r.kind == "harvest" ? "Family field" : fuelDelivery ? "Workshop fuel" : "Household stores"}{point && " · " + taskPlace(s,receiver)}</small>
    {fuelDelivery && ["offered", "accepted"].includes(r.status) && <small>Household store is full · bring the log to the {FUEL_TRADES[s.ecs.workplace?.[r.workplaceId]?.trade]}.</small>}
    {r.kind == "harvest" && point && <button onClick={()=>{s.ui.actions.select_entity(r.targetId,false);s.renderer?.focusOn(point);}}>Show field</button>}
    {approach && <button onClick={()=>s.ui.actions.choose_job(s.ui.playerId,{key:"move_to_here"},approach.id)}>Move to field approach</button>}
    {r.kind == "harvest" && destination && <small>Deliver to household · {taskPlace(s,destination)}</small>}
    {r.kind == "harvest" && <small>Keep a small share as seed grain. Carry the rest home.</small>}
    <div className="request-bottom"><span className="reward">+{r.goodwill} goodwill</span>
      {r.status == "offered" ? <span>Discuss this in Chat</span> : <strong className="request-state">{r.status[0].toUpperCase() + r.status.slice(1)}</strong>}
    </div>
    {r.status=="offered"&&s.ecs.planner?.[giverId]&&<button disabled={patience(s,s.ui.playerId,giverId).free<patience(s,s.ui.playerId,giverId).minimum} onClick={()=>s.ui.actions.talk_to(giverId,"chat")}>Chat with {giver}</button>}
    {r.kind == "harvest" && ["accepted", "completed"].includes(r.status) ? <small>{harvestCounts(s, r)}</small> :
      r.status == "accepted" && <small>{r.progress}/{r.quantity} delivered · {r.delivered} carried home</small>}
    {!playerOrderAllowed(s,"favour") && <small>Adult work. Children can help at home when crops need care.</small>}
    {r.outcome && <p role="status">{r.outcome}</p>}
  </article>;
}
RequestCard.propTypes = { request: PropTypes.object.isRequired, personId: PropTypes.string };

function Requests({ requests, personId }) {
  return <div className="request-content">{requests.length ? requests.map(r => <RequestCard key={r.id} request={r} personId={personId}/>) : <p className="request-note">No requests just now. Meet people nearby.</p>}
    <p className="request-note">Answer requests in Chat. A delivery starts when you agree. Other promises stay here as events unfold.</p></div>;
}
Requests.propTypes = { requests: PropTypes.array.isRequired, personId: PropTypes.string };
export function RequestList() {
  const s = React.useContext(GameState), all = visibleFavours(s);
  const active = all.filter(r => ["offered", "accepted"].includes(r.status));
  const requests = [...active, ...all.filter(r => !active.includes(r)).slice(-3).reverse()];
  return <details className="favour-list"><summary>Favours · {active.length} requests</summary><Requests requests={requests}/></details>;
}
export function PersonRequests({ personId }) {
  const s = React.useContext(GameState), all = visibleFavours(s, personId);
  return <details className="person-requests"><summary>Offer help · {all.filter(r => r.status == "offered").length} requests</summary><Requests personId={personId} requests={all.filter(r => ["offered", "accepted"].includes(r.status)).concat(all.filter(r => !["offered", "accepted"].includes(r.status)).slice(-2).reverse())}/></details>;
}
PersonRequests.propTypes = { personId: PropTypes.string.isRequired };
