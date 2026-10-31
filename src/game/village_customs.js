import { Hex } from "game/hex";
import { isResident } from "game/residents";
import { householdAccess } from "game/playable";
import { beginInteraction, completeConversation, addGoodwill, ADULT_AGE } from "game/people";
import { recordEvent, learnEvent } from "game/events";
import { cancelTask } from "game/manager";
import { SPEECH_REACH } from "game/conversation";

export const OBSERVATION_REACH = 300;
export const WARNING_LOSS = 3, REPEAT_LOSS = 6, ELDER_LOSS = 2, REPEAT_ELDER_LOSS = 4;
export const OATH_TRUST = 10;
export const COMMONS_RULE = "The commons follow walkable land up to two hex steps beyond household plots and shared places. Household plots stay private. Distant unclaimed woodland is free.";
export const OATH_RIGHTS = "You can gather this village's common woodland. In return, help neighbours through favours and keep your social ties. Household stores, crops and belongings keep their existing permissions. This promise is yours alone and grants no rights in other villages. Speak with the elder to leave. Your common gathering rights then end.";
const keyAt = (s,p) => p && (s.space?.[Hex().fromPoint(p)] || []).find(id=>s.ecs.walkable?.[id]);
const distance = (s,a,b) => {
  const p=s.ecs.spatial?.[a],q=s.ecs.spatial?.[b];
  return p && q ? Math.hypot(p.x-q.x,p.y-q.y) : Infinity;
};
const alive = (s,id) => !!s.ecs.personable?.[id] && !s.ecs.personable[id].dead && isResident(s,id) && !!s.ecs.spatial?.[id];
const localAdult = (s,id,v) => alive(s,id) && s.ecs.personable[id].age>=ADULT_AGE && s.ecs.village?.[id]?.villageId==v;

// The one derivation boundary for later settlement growth: use real plots,
// buildings and venues, then flood only their connected walkable fringe.
export function commonLand(s) {
  const claims=new Map(), scores=new Map();
  const tileByHex=new Map(Object.keys(s.ecs.walkable || {}).map(id=>[Hex().fromPoint(s.ecs.spatial[id]).toString(),id]));
  for(const v of Object.values(s.villages || {}).sort((a,b)=>String(a.id).localeCompare(String(b.id)))) {
    const seeds=new Set();
    for(const house of v.houses || []) {
      for(const hex of s.ecs.household?.[house]?.plot?.hexes || []) if(tileByHex.has(hex))seeds.add(tileByHex.get(hex));
      const tile=keyAt(s,s.ecs.spatial?.[house]);if(tile)seeds.add(tile);
    }
    for(const place of v.sharedPlaces || []) {const tile=keyAt(s,s.ecs.spatial?.[place]);if(tile)seeds.add(tile);}
    const seen=new Set(),queue=[...seeds].map(id=>[id,0]);
    for(let i=0;i<queue.length;i++) {
      const [id,depth]=queue[i];if(seen.has(id))continue;seen.add(id);
      if(!scores.has(id)||depth<scores.get(id)){claims.set(id,v.id);scores.set(id,depth);}
      if(depth<2)for(const n of Object.values(s.ecs.walkable[id]?.neighbours || {}))if(!seen.has(n))queue.push([n,depth+1]);
    }
  }
  return claims;
}
const claimCache=new WeakMap();
function claimsFor(s) {
  const signature=JSON.stringify([s.landUseRevision,Object.values(s.villages || {}).map(v=>[v.id,v.houses,v.sharedPlaces,(v.houses || []).map(h=>s.ecs.household?.[h]?.plot?.hexes)])]);
  let cache=claimCache.get(s);
  if(!cache || cache.ecs!=s.ecs || cache.signature!=signature) {cache={ecs:s.ecs,signature,claims:commonLand(s)};claimCache.set(s,cache);}
  return cache.claims;
}
export function membership(s,id,villageId) {
  const v=s.ecs.village?.[id];
  // An explicit departure also overrides a native household's recognition.
  if(v?.memberships?.[villageId]?.left)return null;
  if(v?.memberships?.[villageId])return "oath";
  const house=s.ecs.household?.[id]?.houseId;
  return !s.ecs.guest?.[id] && v?.villageId==villageId && house && s.ecs.village?.[house]?.villageId==villageId && s.ecs.building?.[house] ? "household" : null;
}
export function resourcePermission(s,actorId,targetId) {
  const e=s.ecs,tile=keyAt(s,e.spatial?.[targetId]);
  let privateId=e.controllable?.[targetId] ? targetId : null;
  if(!privateId && tile) {
    const hex=Hex().fromPoint(e.spatial[tile]).toString();
    privateId=Object.keys(e.household || {}).find(id=>e.building?.[id] && e.household[id].plot?.hexes?.includes(hex));
  }
  if(privateId)return {kind:"private",ownerId:e.controllable?.[privateId]?.controllerId,permitted:!!e.controllable?.[privateId] && householdAccess(e,actorId,privateId)};
  const villageId=tile && claimsFor(s).get(tile);
  return villageId ? {kind:"common",villageId,permitted:!!membership(s,actorId,villageId)} : {kind:"unclaimed",permitted:true};
}
export function villageElder(s,villageId) {
  const v=s.villages?.[villageId];if(!v)return null;
  const eligible=id=>localAdult(s,id,villageId) && membership(s,id,villageId)=="household" && !s.ecs.playable?.[id];
  if(v.elderId && eligible(v.elderId))return v.elderId;
  return Object.keys(s.ecs.personable || {}).filter(eligible).sort((a,b)=>s.ecs.personable[b].age-s.ecs.personable[a].age || a.localeCompare(b))[0] || null;
}
export function oathEligibility(s,actorId,villageId) {
  const elder=villageElder(s,villageId),house=s.ecs.household?.[actorId]?.houseId;
  let reason;
  if(!alive(s,actorId)||s.ecs.personable[actorId].age<ADULT_AGE)reason="Only a living adult may take the oath.";
  else if(!elder)reason="There is no resident elder to receive the oath.";
  else if(house && s.ecs.village?.[house]?.villageId && s.ecs.village[house].villageId!=villageId)reason="Your household belongs to another village. Make your own home here first.";
  else if(!s.knowledge?.[actorId]?.people?.[elder]?.conversation || (s.ecs.relationships[elder]?.known[actorId]?.goodwill || 0)<OATH_TRUST) {
    const goodwill=s.ecs.relationships[elder]?.known[actorId]?.goodwill || 0;
    reason=`${(Math.floor(goodwill*10)/10).toFixed(1)} / ${OATH_TRUST} goodwill with the elder. Complete a Chat and earn their trust. Chat has a daily limit. Gifts help according to their tastes. Do favours when offered. Unclaimed woodland is free to use.`;
  }
  return {ok:!reason,reason,elderId:elder};
}
const customs = s => s.customs ||= {incidents:[],next:0};
export function observeChop(s,actorId,targetId,order) {
  if(s.generatingHistory || actorId!=s.ui.playerId || !order || order.commonsIncident)return;
  const permission=resourcePermission(s,actorId,targetId);
  if(permission.kind!="common" || permission.permitted)return;
  const observers=Object.keys(s.ecs.personable || {}).filter(id=>id!=actorId && localAdult(s,id,permission.villageId) &&
    membership(s,id,permission.villageId) && !s.ecs.interior?.[id]?.buildingId && distance(s,id,actorId)<=OBSERVATION_REACH && distance(s,id,targetId)<=OBSERVATION_REACH && s.ecs.planner?.[id]);
  if(!observers.length)return;
  const c=customs(s);
  const pending=c.incidents.find(i=>i.actorId==actorId && i.villageId==permission.villageId && i.warnedDay==null && i.status!="done");
  if(pending) {
    order.commonsIncident=pending.id;
    pending.observers=[...new Set([...pending.observers,...observers])];
    pending.targets=[...new Set([...(pending.targets || [pending.targetId]),targetId])];
    return;
  }
  const incident={id:++c.next,actorId,targetId,villageId:permission.villageId,observers,day:s.days,status:"queued"};
  c.incidents.push(incident);order.commonsIncident=incident.id;
  incident.eventId=recordEvent(s,"commons_cut",[actorId],[],{villageId:permission.villageId,targetId,audienceIds:observers}).id;
}
function available(s,id) {
  const p=s.ecs.planner?.[id],w=p?.world;
  return p && !w.ordered && !w.capturedBy && !w.customsHold && !w.customsVisit && !w.feeling.hungry && !w.feeling.tired && !w.currentJob && !w.claimedFarmable &&
    !w.helpingFriend && !w.social && !w.worldJourney && !w.worldArrival && !(s.ecs.holder?.[id]?.held || []).length &&
    (!p.task || ["wait_for","home_downtime","socialise"].includes(p.task[0]) || p.task[0]=="walk_to" && p.task[1]=="meet");
}
function release(s,id) {
  const p=s.ecs.planner?.[id];if(!p)return;
  delete p.world.customsVisit;delete p.world.customsHold;p.task=null;p.plan=null;
}
function closeDialogue(s) {
  const d=s.customs?.dialogue;if(!d)return;
  if(d.kind!="warning") {
    const job=s.ecs.manager[d.actorId]?.jobs.find(j=>j.assignedId==d.actorId && ["village_oath","village_leave"].includes(j.job.key));
    if(job)cancelTask(s,job.id);
  }
  release(s,d.speakerId);release(s,d.actorId);delete s.customs.dialogue;
}
export function dialogueValid(s,d=s.customs?.dialogue) {
  return !!d && alive(s,d.actorId) && localAdult(s,d.speakerId,d.villageId) && distance(s,d.actorId,d.speakerId)<=SPEECH_REACH &&
    !s.ecs.planner[d.speakerId]?.world.feeling.hungry && !s.ecs.planner[d.speakerId]?.world.feeling.tired &&
    !s.ecs.planner[d.actorId]?.world.feeling.hungry && !s.ecs.planner[d.actorId]?.world.feeling.tired &&
    (d.kind=="warning" || villageElder(s,d.villageId)==d.speakerId);
}
function holdDialogue(s,d) {
  customs(s).dialogue=d;
  beginInteraction(s,d.actorId,d.speakerId);
  for(const id of [d.actorId,d.speakerId]) {const p=s.ecs.planner[id];p.world.customsHold=true;p.task=null;p.plan=null;}
}
export function openOath(s,actorId,speakerId,leave=false) {
  const villageId=s.ecs.village?.[speakerId]?.villageId;
  if(villageElder(s,villageId)!=speakerId || distance(s,actorId,speakerId)>SPEECH_REACH)return {ok:false,message:"Speak with the current elder in person."};
  const eligibility=leave ? {ok:!!membership(s,actorId,villageId),reason:"You are not a member here."} : oathEligibility(s,actorId,villageId);
  if(!eligibility.ok)return {ok:false,message:eligibility.reason};
  if(s.customs?.dialogue)return {ok:false,message:"Finish the current conversation first."};
  holdDialogue(s,{kind:leave?"leave":"oath",actorId,speakerId,villageId});
  return {ok:true,message:"The elder explains your rights and obligations."};
}
export function warningConsequences(s,incident) {
  const repeat=s.customs.incidents.some(other=>other!=incident && other.actorId==incident.actorId && other.villageId==incident.villageId && other.warnedDay!=null && other.warnedDay<=incident.day);
  return {witness:repeat?REPEAT_LOSS:WARNING_LOSS,elder:repeat?REPEAT_ELDER_LOSS:ELDER_LOSS};
}
export function answerCustoms(s,choice) {
  const d=s.customs?.dialogue;if(!dialogueValid(s,d)){closeDialogue(s);return false;}
  if(!["acknowledge","refuse","accept","decline","leave"].includes(choice))return false;
  const c=customs(s),i=c.incidents.find(i=>i.id==d.incidentId);
  if(d.kind=="warning") {
    if(!["acknowledge","refuse"].includes(choice))return false;
    const losses=warningConsequences(s,i);
    i.loss=losses.witness;i.elderLoss=losses.elder;
    addGoodwill(s,d.actorId,d.speakerId,-i.loss);
    i.warnedDay=s.days;i.status="report";i.witnessId=d.speakerId;
    stopForbiddenCutting(s,d.actorId);
    recordEvent(s,"commons_warning",[d.speakerId,d.actorId],[],{villageId:d.villageId,loss:i.loss,response:choice,audienceIds:[d.speakerId,d.actorId]});
    s.ui.customsResult={speakerId:d.speakerId,message:`Goodwill −${i.loss} with the witness. The elder will hear when they meet. Rebuild trust with each person through Chats, gifts and favours when offered. They will remember what happened.`};
    if(villageElder(s,i.villageId)==d.speakerId){
      i.status="done";i.reportedTo=d.speakerId;
      s.ui.customsResult.message=`Goodwill −${i.loss} with the elder, who witnessed your cutting. Rebuild trust through Chats, gifts and favours when offered. They will remember what happened.`;
    }
  } else {
    if(!["accept","decline","leave"].includes(choice))return false;
    if(d.kind=="oath" && choice=="leave" || d.kind=="leave" && choice=="accept")return false;
    if(choice=="accept" && !oathEligibility(s,d.actorId,d.villageId).ok)return false;
    if(choice!="decline") {
      const record=(s.ecs.village[d.actorId].memberships ||= {});
      record[d.villageId]={day:s.days,elderId:d.speakerId,...(choice=="leave"?{left:true}:{})};
      recordEvent(s,choice=="leave"?"village_leave":"village_oath",[d.actorId,d.speakerId],[],{villageId:d.villageId,audienceIds:[d.actorId,d.speakerId]});
      s.ui.customsResult={speakerId:d.speakerId,message:choice=="leave"?"You left the village. Common gathering rights have ended; private permissions stay as before.":"Your oath is recognised. You may gather this village's commons. Private permissions stay as before."};
    }
  }
  for(const [a,b] of [[d.actorId,d.speakerId],[d.speakerId,d.actorId]]) {beginInteraction(s,a,b);completeConversation(s,a,b);}
  closeDialogue(s);return true;
}
export function updateCustoms(s) {
  if(!s.customs)return;
  const c=s.customs;
  if(c.dialogue && !dialogueValid(s)) {
    const i=c.incidents.find(i=>i.id==c.dialogue.incidentId);
    if(i)i.status="queued";
    closeDialogue(s);
  }
  for(const i of c.incidents) {
    if(i.status=="done" || i.status=="dialogue")continue;
    if(!alive(s,i.actorId)){if(i.witnessId)release(s,i.witnessId);i.status="done";continue;}
    if(i.status=="approach" && !localAdult(s,i.witnessId,i.villageId)) {release(s,i.witnessId);i.witnessId=null;i.status="queued";}
    if(i.status=="queued") {
      const witness=i.observers.filter(id=>localAdult(s,id,i.villageId) && available(s,id)).sort((a,b)=>distance(s,a,i.actorId)-distance(s,b,i.actorId))[0];
      if(witness) {i.witnessId=witness;i.status="approach";assign(s,witness,i,"warning");}
    }
    if(i.status=="report") {
      if(!localAdult(s,i.witnessId,i.villageId)){i.status="done";continue;}
      const elder=villageElder(s,i.villageId);
      if(elder==i.witnessId){i.reportedTo=elder;i.status="done";continue;}
      if(elder && !s.ecs.interior?.[elder]?.buildingId && available(s,i.witnessId) && available(s,elder)) {i.reportTarget=elder;assign(s,i.witnessId,i,"report");}
    }
  }
}
function assign(s,id,i,kind) {
  const p=s.ecs.planner[id];p.world.customsVisit={incidentId:i.id,kind};p.task=null;p.plan=null;
}
export function customsVisitTarget(s,id) {
  const visit=s.ecs.planner[id]?.world.customsVisit,i=s.customs?.incidents.find(i=>i.id==visit?.incidentId);
  if(!i)return null;
  const target=visit.kind=="warning"?i.actorId:i.reportTarget;
  const valid=localAdult(s,id,i.villageId) && alive(s,target) && (visit.kind=="warning" || villageElder(s,i.villageId)==target);
  if(!valid || s.ecs.planner[id].world.feeling.hungry || s.ecs.planner[id].world.feeling.tired) {release(s,id);if(i.status=="approach")i.status="queued";return null;}
  return {target,incident:i,kind:visit.kind};
}
function applyReport(s,i,elder) {
  if(i.reportedTo)return;
  addGoodwill(s,i.actorId,elder,-i.elderLoss);i.reportedTo=elder;i.status="done";
  const actual=s.events.find(e=>e.id==i.eventId);if(actual)learnEvent(s,elder,actual);
  recordEvent(s,"commons_report",[i.witnessId,elder,i.actorId],[],{villageId:i.villageId,loss:i.elderLoss,audienceIds:[i.witnessId,elder,i.actorId]});
  s.ui.customsResult={speakerId:elder,message:`The witness reported your cutting to the elder. Elder's goodwill −${i.elderLoss}. Favours for the elder rebuild that relationship.`};
}
export function arriveCustoms(s,id,dt) {
  const v=customsVisitTarget(s,id);if(!v)return false;
  const {target,incident:i,kind}=v;
  if(distance(s,id,target)>SPEECH_REACH || s.ecs.interior?.[id]?.buildingId!=s.ecs.interior?.[target]?.buildingId)return false;
  if(kind=="warning") {
    if(s.customs.dialogue)return false;
    // Remove every still-forbidden common cutting order, including queued repeats.
    stopForbiddenCutting(s,i.actorId);
    i.status="dialogue";
    holdDialogue(s,{kind:"warning",actorId:i.actorId,speakerId:id,villageId:i.villageId,incidentId:i.id});
    return true;
  }
  const targetPlanner=s.ecs.planner[target];
  if(!available(s,target)){s.ecs.planner[id].world.customsReportTime=0;return false;}
  const w=s.ecs.planner[id].world;
  w.customsReportTime=(w.customsReportTime || 0)+dt;
  if(w.customsReportTime<5/1440)return false;
  // No contact is published until the five-minute proximate exchange completes.
  for(const [a,b] of [[id,target],[target,id]]){beginInteraction(s,a,b);completeConversation(s,a,b);}
  applyReport(s,i,target);delete w.customsReportTime;delete w.customsVisit;
  targetPlanner.plan=null;
  return true;
}
export function customsVisitFailed(s,id) {
  const v=customsVisitTarget(s,id);if(!v)return;
  if(v.kind=="warning")v.incident.status="queued";
  release(s,id);
}

function stopForbiddenCutting(s,actorId) {
  for(const job of [...s.ecs.manager[actorId].jobs])if(job.job.key=="cut_tree_down" && !job.gatheredDone && !resourcePermission(s,actorId,job.targetId).permitted)cancelTask(s,job.id);
}
