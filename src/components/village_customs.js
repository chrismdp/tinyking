import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { patienceLeft } from "game/people";
import { visibleFavours } from "game/favours";
import { displayName } from "game/knowledge";
import { resourcePermission, villageElder, membership, oathEligibility, oathReadiness, warningConsequences, OATH_RIGHTS } from "game/village_customs";

export function ResourceRights({ entityId }) {
  const s=React.useContext(GameState),e=s.ecs;
  if(!e.tree?.[entityId] && !(e.good?.[entityId]?.type=="wood" && !e.haulable?.[entityId]))return null;
  const p=resourcePermission(s,s.ui.playerId,entityId);
  const elder=p.kind=="common" && villageElder(s,p.villageId);
  return <aside className="resource-rights" aria-label="Resource rights">
    <strong>{p.kind=="common" ? `${s.villages[p.villageId]?.name} · Common woodland` : p.kind=="private" ? "Private household tree" : "Unclaimed woodland"}</strong>
    <p>{p.permitted ? "You may cut this tree." : p.kind=="common" ? "You need the village’s leave to cut here. Cutting without it can cost goodwill." : "You do not have this household's permission."}</p>
    {p.kind=="common" && <><small>Gold lines mark the village commons. Household plots and owned trees stay private. Unclaimed woodland is free to use.</small>{!p.permitted && <><p>Speak with the elder about joining this village.</p>{elder && <button onClick={()=>s.ui.actions.select_entity(elder,false)}>Meet the elder</button>}</>}</>}
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
  const chats=patienceLeft(s,player,personId);
  const offered=visibleFavours(s,personId).filter(r=>r.status=="offered").length;
  return <section className="membership-info" aria-label="Village membership"><strong>Elder of {s.villages[villageId]?.name}</strong>
    <p>{member ? "You are recognised here. You may gather the commons." : "You are a stranger here. Common woodland needs a local oath."}</p>
    <details><summary>Rights and obligations</summary><p>{OATH_RIGHTS}</p><p>Gold lines mark the commons. Household plots and owned trees stay private.</p></details>
    {!member && <><p>{eligible.reason || "The elder knows you and will receive your oath."}</p>
      <p>{chats ? `${chats} conversations left today. Choose Chat to spend time together.` : "No conversations left today. Return tomorrow for another Chat."}</p>
      <p>{offered ? "Open Offer help to see the household’s current requests." : "This household offers no favours just now."}</p></>}
    {member && !readiness.ok && <p>{readiness.reason}</p>}
    <button disabled={member ? !readiness.ok : !eligible.ok} onClick={()=>s.ui.actions.talk_to(personId,member?"village_leave":"village_oath")}>{member?"Discuss leaving the village":"Discuss the local oath"}</button>
  </section>;
}
VillageMembership.propTypes={personId:PropTypes.string.isRequired};

export function CustomsEncounter() {
  const s=React.useContext(GameState),d=s.customs?.dialogue,order=s.ui?.resourceOrder,result=s.ui?.customsResult;
  if(!d && !order && !result)return null;
  if(!d && !order)return <aside id="customs-result" role="status"><p>{displayName(s,result.speakerId)}: {result.message}</p><button aria-label="Dismiss village news" onClick={()=>s.ui.actions.dismiss_customs()}>×</button></aside>;
  const village=s.villages[d?.villageId || order?.villageId]?.name;
  const answer=choice=>s.ui.actions.answer_customs(choice);
  const warning=d?.kind=="warning";
  const incident=warning && s.customs.incidents.find(i=>i.id==d.incidentId);
  const losses=warning && warningConsequences(s,incident);
  const elderWitness=warning && villageElder(s,d.villageId)==d.speakerId;
  return <section id="customs-encounter" role="dialog" aria-label={order && !d?"Cutting warning":warning?"Village warning":"Local oath"}>
    <strong>{d ? `${displayName(s,d.speakerId)} · ${warning?"Village witness":"Village elder"}` : `${village} · Common woodland`}</strong>
    <h3>{order && !d ? "Cut without permission?" : warning ? "Please leave our woodland alone." : d.kind=="leave" ? "Leave the village?" : `Join ${village}?`}</h3>
    {order && !d ? <><p>You have no gathering rights here. If a villager sees you cutting, they may approach and warn you. You will lose goodwill with them and, after a report, the elder.</p><div className="customs-choices"><button onClick={()=>s.ui.actions.confirm_resource_order()}>Cut without permission</button><button onClick={()=>s.ui.actions.dismiss_resource_order()}>Keep the tree</button></div></> : warning ? <><p>“These trees belong to our village. You need our leave to cut them. Speak to our elder if you want to settle here.”</p><p>Goodwill −{losses.witness} with {elderWitness ? "the elder, who saw you cutting" : "this villager"}{!elderWitness && <>; −{losses.elder} with the elder when told</>}. Cutting again after a warning costs more.</p><div className="customs-choices"><button onClick={()=>answer("acknowledge")}>Fair enough. I’ll stop.</button><button onClick={()=>answer("refuse")}>I don’t agree.</button></div><small>Your cutting has stopped. Rebuild trust with this villager and the elder through Chats, gifts and favours when offered. Unclaimed woodland is free to use.</small></> : <><p>{OATH_RIGHTS}</p><p>{d.kind=="leave"?"Leaving ends your common gathering rights here. Your past help and offences stay in people's memories.":"A camp or a home of your own is enough. A household from another village needs its own home here first."}</p><div className="customs-choices"><button onClick={()=>answer(d.kind=="leave"?"leave":"accept")}>{d.kind=="leave"?"Leave · end common rights":"Swear the local oath"}</button><button onClick={()=>answer("decline")}>Decline</button></div></>}
  </section>;
}
