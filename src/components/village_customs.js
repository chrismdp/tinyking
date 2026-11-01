import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { patience } from "game/chat_patience";
import { visibleFavours } from "game/favours";
import { displayName } from "game/knowledge";
import { resourcePermission, villageElder, membership, oathEligibility, oathReadiness, OATH_RIGHTS } from "game/village_customs";

export function ResourceRights({ entityId }) {
  const s=React.useContext(GameState),e=s.ecs;
  if(!e.tree?.[entityId] && !(e.good?.[entityId]?.type=="wood" && !e.haulable?.[entityId]))return null;
  const p=resourcePermission(s,s.ui.playerId,entityId);
  const elder=p.kind=="common" && villageElder(s,p.villageId);
  return <aside className="resource-rights" aria-label="Resource rights">
    <strong>{p.kind=="common" ? `${s.villages[p.villageId]?.name} · Common woodland` : p.kind=="private" ? "Private household tree" : "Unclaimed woodland"}</strong>
    <p>{p.permitted ? "You may cut this tree." : p.kind=="common" ? "You need the village’s leave to cut here. Cutting without it can cost goodwill." : "You do not have this household's permission."}</p>
    {p.kind=="common" && <><small>Gold lines mark the village commons. Household plots and owned trees stay private. Unclaimed woodland is free to use.</small>{!p.permitted && <p>Speak with the elder about joining this village.</p>}{elder && <button onClick={()=>s.ui.actions.select_entity(elder,false)}>Meet the elder</button>}</>}
  </aside>;
}
ResourceRights.propTypes={entityId:PropTypes.string.isRequired};

export function VillageMembership({ personId }) {
  const s=React.useContext(GameState),player=s.ui.playerId,villageId=s.ecs.village?.[personId]?.villageId;
  if(personId==player) {
    const records=s.ecs.village[player]?.memberships || {};
    return <div className="membership-info">{Object.entries(records).map(([id,r])=><p key={id}>{s.villages[id]?.name || id}: {r.left?"Left · no common gathering rights":"Local oath · common gathering rights"}</p>)}</div>;
  }
  if(!villageId || villageElder(s,villageId)!=personId)return null;
  const member=membership(s,player,villageId),eligible=oathEligibility(s,player,villageId);
  const readiness=oathReadiness(s,player,personId);
  const slots=patience(s,player,personId);
  const offered=visibleFavours(s,personId).filter(r=>r.status=="offered").length;
  return <section className="membership-info" aria-label="Village membership"><strong>Elder of {s.villages[villageId]?.name}</strong>
    <p>{member ? "You are recognised here. You may gather the commons." : "You are a stranger here. Common woodland needs a local oath."}</p>
    <details><summary>Rights and obligations</summary><p>{OATH_RIGHTS}</p><p>Gold lines mark the commons. Household plots and owned trees stay private.</p></details>
    {!member && <><p>{eligible.reason || "The elder knows you and will receive your oath."}</p>
      <p>Patience: {slots.free} / {slots.max} slots free{slots.free<slots.minimum ? ` · ready in ${Math.ceil(slots.readyIn)} game hours` : ". Choose Chat to spend time together."}</p>
      <p>{offered ? "Open Offer help to see the household’s current requests." : "This household offers no favours just now."}</p></>}
    {member && !readiness.ok && <p>{readiness.reason}</p>}
    <button disabled={member ? !readiness.ok : !eligible.ok} onClick={()=>s.ui.actions.talk_to(personId,"chat",{chatIntent:member?"leave":"oath"})}>{member?"Chat about leaving the village":"Chat about the local oath"}</button>
  </section>;
}
VillageMembership.propTypes={personId:PropTypes.string.isRequired};

// Tree order confirmation and delivered village news remain world notices.
export function ResourceNotice() {
  const s=React.useContext(GameState),order=s.ui?.resourceOrder,result=s.ui?.customsResult;
  if(!order&&!result)return null;
  if(!order)return <aside id="village-news" role="status"><p>{displayName(s,result.speakerId)}: {result.message}</p><button aria-label="Dismiss village news" onClick={()=>s.ui.actions.dismiss_customs()}>×</button></aside>;
  return <section id="resource-confirmation" role="dialog" aria-label="Cutting warning">
    <strong>{s.villages[order.villageId]?.name} · Common woodland</strong><h3>Cut without permission?</h3>
    <p>You have no gathering rights here. If a villager sees you cutting, they may approach and warn you. You will lose goodwill with them and, after a report, the elder.</p>
    <div className="resource-choices"><button onClick={()=>s.ui.actions.confirm_resource_order()}>Cut without permission</button><button onClick={()=>s.ui.actions.dismiss_resource_order()}>Keep the tree</button></div>
  </section>;
}
