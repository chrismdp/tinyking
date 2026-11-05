import { eventById } from "game/events";
import EVENT_TYPES from "data/event_types.json";
import { displayName } from "game/knowledge";
import { MOODS, moodScore } from "game/chat_moods";
export { MOODS, moodScore };
import { customsIntentUnavailable, customsChatContext, customsChatValid, applyCustomsResponse, stopForbiddenCutting, membership } from "game/village_customs";
import { recogniseMaternalKin, firstFamilyRequest } from "game/mother_family";
import { completeChatOrder } from "game/manager";
import LINES from "data/conversation_lines.json";
import { addGoodwill, meet, disposition, RINGS, completeConversation, goodwillTowards } from "game/people";
import { learnEvent, recordEvent } from "game/events";
import { recogniseConversation } from "game/guidance";
import { acceptFavour, withFavourQuery } from "game/favours";
import { hashUnit } from "game/math";
import { patience, chatRecord } from "game/chat_patience";
import { baseBindings, sourceValues, predicate, snapshotActivity, heard, personFact, knows } from "game/chat_facts";
import { SPEECH_REACH } from "game/conversation";
export { patience, recoverSlots } from "game/chat_patience";
export const TOPICS={family:"Family",work:"Work",harvest:"Harvest",food:"Food",season:"Season",village:"Village",faith:"Faith",gossip:"Gossip",help:"Help",woodland:"Woodland"};
const mapping={woodland:[["generous","hard-working"],["greedy"]],family:[["generous","humble"],["greedy"]],work:[["hard-working"],["lazy"]],harvest:[["hard-working","generous"],["lazy"]],food:[["cheerful"],["gloomy"]],season:[["brave"],["timid"]],village:[["generous","humble"],["greedy","proud"]],faith:[["pious"],["worldly"]],gossip:[["proud","gloomy"],["humble"]],help:[["generous"],["greedy"]]};
const clamp=(v,n)=>Math.max(-n,Math.min(n,v));
const traitWeight=(s,id,t)=>{const p=s.ecs.personality[id];return Number(p.traits.includes(t))+Number(p.likes.includes(t))-Number(p.dislikes.includes(t));};
export function topicScore(s,id,topic) {const [add,sub]=mapping[topic];return clamp(add.reduce((v,t)=>v+traitWeight(s,id,t),0)-sub.reduce((v,t)=>v+traitWeight(s,id,t),0),2);}
export const iconKey=i=>i.kind=="grievance"?"grievance":i.kind=="person"?"person:"+i.personId:i.kind+":"+i.key;
// Levels refer to the NPC's directional relationship with this player. Standing
// is local to that NPC's village, and an explicit departure revokes it.
function lineRisk(s,c,line) {
  const level=line.level;if(!level)return null;
  const ring=s.ecs.relationships?.[c.npcId]?.known[c.actorId]?.ring||"public";
  const lowRing=RINGS.indexOf(ring)<RINGS.indexOf(level.ring);
  const lowStanding=level.standing=="oath-sworn"&&!membership(s,c.actorId,s.ecs.village?.[c.npcId]?.villageId);
  const introduction=level.introduced&&!knows(s,c.npcId,c.actorId)&&(!level.traits||level.traits.some(t=>s.ecs.personality[c.npcId].traits.includes(t)));
  if(!lowRing&&!lowStanding&&!introduction)return null;
  return {message:introduction?"Introduce yourself first":lowStanding?"Village oath required":"Needs "+level.ring+" closeness",
    cost:level.cost??2,rebuff:(introduction&&level.introRebuff)||level.rebuff||"level_rebuff",grievance:!!level.grievance,reason:level.reason||"intrusion"};
}
function rowAfter(c,line) {
  const row=[...c.row],popped=[];
  for(const icon of line.icons) {
    const at=icon.kind=="grievance"?-1:row.findIndex(x=>x.kind!="grievance"&&iconKey(x)==iconKey(icon));
    if(at<0)row.push({...icon});else {row.splice(at,1);popped.push(icon);}
  }
  if(line.defiant||line.risk?.grievance)row.push({kind:"grievance"});
  return {row,popped};
}
export function iconScore(s,icon,speaker,listener) {
  if(icon.kind=="topic")return topicScore(s,listener,icon.key);
  if(icon.kind=="mood")return moodScore(s,listener,icon.key);
  if(icon.personId==speaker)return -1;
  if(icon.personId==listener)return clamp(traitWeight(s,listener,"proud")-traitWeight(s,listener,"humble"),1);
  const b=s.ecs.relationships[listener]?.known[icon.personId];
  if(disposition(s,listener,icon.personId)=="hate"||goodwillTowards(s,listener,icon.personId)<0)return -2;
  return [0,1,2,2][Math.max(0,RINGS.indexOf(b?.ring))];
}
const knowledge=(s,id)=>{s.knowledge ||= {};return s.knowledge[id] ||= {people:{},feelings:{}};};
function learnIdentity(s,viewer,id) {if(!id)return;const k=knowledge(s,viewer);(k.people ||= {})[id] ||= {traits:[]};delete k.people[id].nameOnly;}
function interpolate(text,b) {
  let missing=false;
  const result=text.replace(/\{([^}|]+)(\|cap)?\}/g,(_,path,cap)=>{let value=path.split(".").reduce((v,k)=>v?.[k],b);if(value==null){missing=true;return "";}value=String(value);return cap?value.charAt(0).toUpperCase()+value.slice(1):value;});
  return missing?null:result;
}
function bindingOrder(bindings) {
  const keys=Object.keys(bindings),out=[],seen=new Set();
  const visit=key=>{if(seen.has(key))return;seen.add(key);for(const v of Object.values(bindings[key]))if(typeof v=="string"&&keys.includes(v.split(".")[0]))visit(v.split(".")[0]);out.push(key);};
  keys.forEach(visit);return out;
}
export function lineCandidates(s,c,family,speaker) {
  return withFavourQuery(s,()=>queryLineCandidates(s,c,family,speaker));
}
function queryLineCandidates(s,c,family,speaker) {
  const pair=chatRecord(s,c.actorId,c.npcId),result=[],trust=Math.max(0,RINGS.indexOf(s.ecs.relationships?.[c.npcId]?.known[c.actorId]?.ring));
  for(const row of LINES) {
    // A question they have no more to say about waits until they trust you more.
    if(row.speaker=="player"&&pair.exhausted?.[row.family+":"+row.situation]>=trust)continue;
    if(row.family!=family||speaker&&row.speaker!=speaker||c.usedIds.includes(row.id)&&!row.answers?.includes(c.expectation)&&!row.situation.startsWith("fallback_")&&family!="referral_reply")continue;
    if(!row.tags.require.every(t=>c.tags.includes(t))||row.tags.forbid.some(t=>c.tags.includes(t)))continue;
    let bound=[baseBindings(s,c)];
    for(const key of bindingOrder(row.bindings))bound=bound.flatMap(b=>sourceValues(s,c,b,{...row.bindings[key],eventType:row.when.all.find(p=>p.test=="event_type_is"&&p.args.event==key)?.args.type,jobKey:row.when.all.find(p=>p.test=="player_has_queued_order")?.args.key}).map(v=>({...b,[key]:v})));
    for(const b of bound) {
      const tests=[...row.when.all,...row.when.none].map(p=>predicate(s,c,b,p));
      if(tests.some(v=>v===undefined)||!row.when.all.every((_,i)=>tests[i])||row.when.none.some((_,i)=>tests[row.when.all.length+i]))continue;
      // Catalogue accounts are one authored template with distinct real facts.
      // Qualify their spoken IDs so telling one harvest does not hide all others.
      const id=row.icons.some(i=>i.kind=="event")?row.id+"@"+b.event.id:row.id;
      if(id!=row.id&&c.usedIds.includes(id))continue;
      const text=interpolate(row.text,b),useKey=interpolate(row.use_key,b);
      if(text==null||useKey==null)continue;
      const reoffer=family=="favour_ask" && c.tags.includes("offered_help") && s.knowledge?.[c.actorId]?.declinedOffers?.[b.request?.id];
      if(pair.used[useKey] && !row.answers?.includes(c.expectation) && !row.situation.startsWith("fallback_") && family!="referral_reply" && !reoffer && !["greeting","leave_taking","introduction_reply","name_answer"].includes(family))continue;
      const icons=row.icons.flatMap(i=>i.kind=="event"?
        [{kind:"topic",key:EVENT_TYPES[b[i.ref]?.type]?.topic},...(b[i.ref]?.people||[]).map(personId=>({kind:"person",personId}))]:
        i.kind=="person"?[{kind:"person",personId:b[i.ref]?.id}]:[{...i}]);
      if(icons.some(i=>i.kind=="person"&&!i.personId))continue;
      const risk=lineRisk(s,c,row);
      if(risk&&row.level.below=="hide")continue;
      result.push({...row,id,text,useKey,key:row.id+"|"+useKey,icons,b,...(risk?{risk}:{})});
    }
  }
  return result;
}
function weighted(s,c,rows,scope) {
  if(!rows.length)return null;
  const pair=chatRecord(s,c.actorId,c.npcId),previous=pair.last[scope];
  let pool=rows.filter(l=>!(previous?.encounter!=c.encounter&&previous?.id==l.id));
  if(!pool.length)pool=rows;
  if(rows[0]?.speaker=="npc") {
    const recent=s.chat?.recentNpc?.[c.actorId]?.[scope]||[];
    const fresh=pool.filter(l=>!recent.includes(l.id));
    if(fresh.length)pool=fresh;
  }
  const total=pool.reduce((n,l)=>n+l.weight,0);
  let roll=hashUnit(`${s.peopleSeed}:chat:${c.actorId}:${c.npcId}:${c.encounter}:${c.transcript.length}:${scope}`)*total;
  return pool.find(l=>(roll-=l.weight)<0)||pool[pool.length-1];
}
function variants(s,c,rows) {
  const groups={};for(const l of rows)(groups[l.family+":"+l.situation+":"+l.useKey] ||= []).push(l);
  return Object.values(groups).map(group=>weighted(s,c,group,group[0].family+":"+group[0].situation));
}
export function previewLine(s,line,c=s.chat?.active) {
  if(!c)return {fits:false,matches:0};
  const {row,popped}=rowAfter(c,line),matchingKeys=popped.map(iconKey),matches=popped.length;
  const p=patience(s,c.actorId,c.npcId);
  const closing=c.closingReply && (c.closingReply=="offer"?["favour_accept","favour_decline"]:["referral_reply"]).includes(line.family);
  return {matches,matchingKeys,remaining:row.length,fits:line.answers?.includes(c.expectation) || closing || line.speaker=="npc"&&c.phase=="reply" || row.length+p.resting<=p.max};
}
function pickNpc(s,c,family,realOnly=false) {
  let rows=variants(s,c,lineCandidates(s,c,family,"npc")).filter(l=>previewLine(s,l,c).fits);
  if(family=="work_talk"&&c.question?.family=="work_question") {
    const trade="trade_"+s.ecs.profession?.[c.npcId]?.trade;
    const preferred=c.question.situation=="workplace_age"?rows.filter(l=>["workplace_age","fallback_workplace_age"].includes(l.situation)):[];
    const relevant=preferred.length?preferred:rows.filter(l=>l.situation==trade);
    if(relevant.length)rows=relevant;
  }
  if (family=="family_answer" && c.question?.family=="family_question") {
    const kind={spouse:"spouse",children:"child",parents:"parent"}[c.question.situation];
    if(kind) rows=rows.filter(l=>l.b.link?.kinship==kind || [(kind=="child"?"refuse_children":"refuse_trust"),"no_children","fallback_"+c.question.situation].includes(l.situation));
  }
  if (family=="relative_news" && c.question?.relativeId) rows=rows.filter(l=>!l.b.relative || l.b.relative.id==c.question.relativeId);
  if(c.question?.situation=="bereaved_relative"&&family=="relative_news")rows=rows.filter(l=>l.situation=="fallback_bereaved_relative");
  if(realOnly) rows=rows.filter(l=>l.b.request || l.b.event);
  // Prefer relevant topic matches, then the newest event. Wording uses weights
  // only after purpose and real situation have been selected.
  rows.sort((a,b)=>{
    const topic=l=>l.icons.filter(i=>i.kind=="topic"&&c.row.some(x=>x.kind!="grievance"&&iconKey(i)==iconKey(x))).length;
    const date=l=>Math.max(-Infinity,...Object.values(l.b).filter(x=>x?.people&&x?.day!=null).map(x=>x.day));
    const distance=l=>{const at=s.ecs.spatial[c.actorId],target=l.b.other?.point||s.ecs.spatial[l.b.request?.householdId];return at&&target?Math.hypot(target.x-at.x,target.y-at.y):Infinity;};
    return Number(a.situation.startsWith("fallback_"))-Number(b.situation.startsWith("fallback_"))||topic(b)-topic(a)||date(b)-date(a)||(["lands_villages","need_news"].includes(family)?distance(a)-distance(b):0)||a.useKey.localeCompare(b.useKey);
  });
  return rows[0];
}
export function chatChoices(s) {
  return withFavourQuery(s,()=>queryChatChoices(s));
}
function queryChatChoices(s) {
  const c=s.chat?.active;if(!c||c.endReason)return [];
  c.phase="player_turn";
  const families=[...new Set(LINES.filter(l=>l.speaker=="player"&&l.family!="leave_taking").map(l=>l.family))];
  const available=families.flatMap(f=>variants(s,c,lineCandidates(s,c,f,"player")));
  let all=available;
  const direct=available.filter(l=>l.answers?.includes(c.expectation)&&previewLine(s,l).fits);
  const withAnswers=(result,limit=true)=>{
    const mandatory=["warning","oath","leave","offer"].includes(c.expectation)?direct.filter((l,i)=>direct.findIndex(x=>x.family==l.family&&x.situation==l.situation)==i).slice(0,2):direct.slice(0,1);
    const evasion=direct.find(l=>l.evasive);
    if(evasion&&!mandatory.includes(evasion))mandatory.push(evasion);
    const oath=available.find(l=>l.family=="customs_question"&&previewLine(s,l).fits);
    if(oath&&!mandatory.includes(oath))mandatory.push(oath);
    if(["warning","oath","leave"].includes(c.expectation))return mandatory;
    const combined=[...mandatory,...result.filter(l=>!mandatory.some(x=>x.useKey==l.useKey))];
    let searches=0;
    return combined.filter(l=>l.family!="maternal_search"||++searches<=1).slice(0,limit?4:undefined);
  };
  if(c.closingReply) return withAnswers(all.filter(l=>(c.closingReply=="offer"?["favour_accept","favour_decline"]:["referral_reply"]).includes(l.family)));
  if(c.focus=="tell")return withAnswers(all.filter(l=>l.family=="gossip_tell"&&l.situation.startsWith("catalogue_")).sort((a,b)=>b.b.event.day-a.b.event.day||a.useKey.localeCompare(b.useKey)),false);
  if (c.focus) {
    const focus={family:["maternal_introduction","maternal_search","family_question","own_question","player_family","confidence_question","flirt"],work:["work_question","player_work"],news:["gossip_question","gossip_tell","visit_question"],help:["need_question","help_offer","favour_accept","favour_decline","favour_progress"],village:["lands_question","village_question"],season:["season_talk"],mood:["own_question","mood_talk","mood_reply"]}[c.focus];
    all=all.filter(l=>focus.includes(l.family)||l.family=="customs_question"||c.focus=="season"&&l.family=="lands_question"&&l.situation=="country");
  }
  // Practical lines remain reachable; the list otherwise favours a visible
  // match and distinct purposes, without looking up hidden taste scores.
  all.sort((a,b)=>{
    const rank=l=>!previewLine(s,l).fits?-20:l.family=="customs_question"?110:l.family=="favour_accept"?100:l.family=="favour_decline"?90:c.focus=="family"&&l.family=="family_question"&&l.situation=="general"?80:["season_talk","lands_question","need_question"].includes(l.family)?70+previewLine(s,l).matches:l.family=="introduction"?60:previewLine(s,l).matches*4;
    return rank(b)-rank(a)||hashUnit(c.encounter+":"+c.transcript.length+":"+a.useKey)-hashUnit(c.encounter+":"+c.transcript.length+":"+b.useKey);
  });
  const result=[],used=new Set();
  for(const l of all)if(!used.has(l.family)){result.push(l);used.add(l.family);if(result.length==4)break;}
  if(result.length<4)for(const l of all)if(!result.includes(l)&&!result.some(x=>x.useKey==l.useKey)){result.push(l);if(result.length==4)break;}
  if(!result.some(l=>l.icons.some(i=>i.kind=="topic"&&i.key=="season"))) {
    const weather=available.find(l=>l.family=="season_talk"&&previewLine(s,l).fits);
    if(weather) {if(result.length==4)result.pop();result.push(weather);}
  }
  for(const family of ["lands_question","need_question"])for(const l of available)if(result.length<4&&l.family==family&&previewLine(s,l).fits&&!result.some(x=>x.useKey==l.useKey))result.push(l);
  const best=available.filter(l=>previewLine(s,l).fits).reduce((best,l)=>!best||previewLine(s,l).matches>previewLine(s,best).matches||previewLine(s,l).matches==previewLine(s,best).matches&&l.family=="work_question"&&l.situation=="personal"?l:best,null);
  if(!c.focus&&best&&previewLine(s,best).matches>Math.max(0,...result.map(l=>previewLine(s,l).matches))) {
    if(result.length<4)result.push(best);
    else {
      let at=result.findIndex(l=>l.family=="introduction");
      if(at<0)at=result.findLastIndex(l=>!["favour_accept","favour_decline"].includes(l.family)&&!l.icons.some(i=>i.kind=="topic"&&i.key=="season"));
      if(at<0)at=result.findLastIndex(l=>!["favour_accept","favour_decline"].includes(l.family));
      if(at>=0)result[at]=best;
    }
  }
  const comfort=available.find(l=>l.family=="mood_reply"&&previewLine(s,l).fits);
  if(comfort&&!result.some(l=>l.family=="mood_reply")) {if(result.length==4)result.pop();result.push(comfort);}
  // The opening goal always has a reachable line, including under Family.
  if(!c.focus || c.focus=="family") {
    const practical=all.filter(l=>["maternal_introduction","maternal_search"].includes(l.family)&&previewLine(s,l).fits).sort((a,b)=>Number(b.family=="maternal_introduction")-Number(a.family=="maternal_introduction"));
    let searches=0;
    const unique=[...new Map(practical.map(l=>[l.useKey,l])).values()].filter(l=>l.family!="maternal_search"||++searches<=1);
    if(unique.length)return withAnswers([...unique,...result.filter(l=>!unique.some(x=>x.useKey==l.useKey))]);
  }
  if(!result.some(l=>previewLine(s,l).fits)) {
    const goodbye=variants(s,c,lineCandidates(s,c,"leave_taking","player")).find(l=>previewLine(s,l).fits);
    if(goodbye)return withAnswers([goodbye]);
  }
  return withAnswers(result);
}
function effects(s,c,line) {
  const b=line.b||{},ref=x=>b[x]?.id,viewer=ref(line.disclosure?.to),speaker=line.speaker=="player"?c.actorId:c.npcId;
  for(const id of line.disclosure?.people||[]) {
    if(id=="event.people") {for(const person of b.event?.people||[])if(knows(s,speaker,person))learnIdentity(s,viewer,person);}
    else learnIdentity(s,viewer,ref(id));
  }
  const disclosed=[];
  for(const key of line.disclosure?.events||[]) {
    const event=eventById(s,b[key]?.id);if(!event)continue;
    if(line.speaker=="player"){c.toldEventId=event.id;c.npcKnewEvent=heard(s,c.npcId,event);}
    learnEvent(s,viewer,event);disclosed.push(event);
    const k=knowledge(s,viewer);(k.spokenSources ||= {})[event.id] ||= {speakerId:speaker,day:s.days,lineId:line.id};
  }
  if(viewer==c.actorId&&disclosed.length)recogniseConversation(s,c.actorId,c.npcId,disclosed);
  for(const key of line.disclosure?.requests||[]) {
    const id=b[key]?.id;if(!id)continue;const k=knowledge(s,viewer);k.favours ||= [];if(!k.favours.includes(id))k.favours.push(id);
    (k.offers ||= {})[id]={speakerId:c.npcId,day:s.days};
  }
  for(const fact of line.disclosure?.facts||[])if(fact.ref=="job"&&b.job?.trade){learnIdentity(s,viewer,c.npcId);knowledge(s,viewer).people[c.npcId].trade=b.job.trade;}
  for(const op of line.effects||[]) {
    const k=knowledge(s,ref(op.viewer)||c.actorId);
    switch(op.op) {
    case "begin_woodland_warning": {
      const incident=s.customs?.incidents.find(i=>i.id==c.context?.incidentId);
      if(incident)incident.status="chat";stopForbiddenCutting(s,c.actorId);break;
    }
    case "begin_customs_chat":c.context=customsChatContext(s,c.actorId,c.npcId,op.kind);break;
    case "customs_response":applyCustomsResponse(s,c,op.choice);c.finishAfterReply=true;break;
    case "recognise_maternal_kin":c.familyRecognition=b.relative;recogniseMaternalKin(s,c.actorId,c.npcId);break;
    case "ask_maternal_relative":c.familySearch=b.relative;break;
    case "learn_family_whereabouts": {const r=b.relative;if(r){(k.familyWhereabouts ||= {})[r.id]={villageId:r.village_id,direction:r.direction,day:s.days,speakerId:c.npcId};k.villages ||= [];if(r.village_id&&!k.villages.includes(r.village_id))k.villages.push(r.village_id);}break;}
    case "learn_identity":learnIdentity(s,ref(op.viewer),ref(op.person));break;
    case "set_reply_purpose":c.reply=op.purpose;break;
    case "set_chat_mode":c.mode=op.mode;break;
    case "set_subject":c.subjectId=ref(op.person);break;
    case "set_subject_place":c.subjectPlaceId=ref(op.place);break;
    case "clear_subject":c.subjectId=null;break;
    case "learn_kin_link": {const link=b[op.link];if(link)(k.kinLinks ||= {})[link.id]={...link,day:s.days,speakerId:c.npcId};break;}
    case "record_feeling_disclosure":(k.feelings ||= {});(k.feelings[c.npcId] ||= {})[ref(op.about)]=b.bond?.ring;break;
    case "remember_observation":(k.observations ||= {})[c.npcId+":"+op.fact]={day:s.days,lineId:line.id,value:b[op.fact]||b.lands||b.place||b.trip||b.activity||null};break;
    case "set_pending_offer":c.pendingOfferId=b[op.request]?.id;c.closingReply="offer";break;
    case "record_declined_offer":c.declinedId=b[op.request]?.id;(k.declinedOffers ||= {})[c.declinedId]={day:s.days};delete c.pendingOfferId;break;
    case "record_heard_need": {if(line.speaker=="npc")c.closingReply="referral";const r=b[op.request];if(r)(k.heardNeeds ||= {})[r.id]={askerId:r.giverId,requestId:r.id,householdId:r.householdId,kind:r.kind,speakerId:c.npcId,day:s.days};break;}
    case "record_heard_place": {const v=b[op.village];if(v){(k.heardPlaces ||= {})[v.id]={day:s.days,speakerId:c.npcId};k.villages ||= [];if(!k.villages.includes(v.id))k.villages.push(v.id);}break;}
    case "record_spoken_source":break; // all spoken events above record their source
    case "record_noticed_need":break; // world bubbles record only anonymous observations
    default:throw new Error("Unknown chat effect: "+op.op);
    }
  }
  if(line.resolve) {
    const r=s.favours?.requests[b.request?.id],task=acceptFavour(s,r?.id,c.npcId);
    if(task)r.deliveryAuthorised=true;
    c.result={requestId:r?.id,value:task?"favour_accepted":"favour_unavailable",reason:r?.outcome};
    c.reply=task?line.resolve.success_reply:line.resolve.failure_reply;delete c.pendingOfferId;
  }
}
export function speakLine(s,line) {
  const c=s.chat.active;if(c.endReason||!previewLine(s,line).fits)return false;
  if(line.effects?.some(e=>e.op=="customs_response")) {
    const op=line.effects.find(e=>e.op=="customs_response");
    if(!customsChatValid(s,c.context)) {
      const reason=customsIntentUnavailable(s,c.actorId,c.npcId,c.context?.kind);
      if(reason)s.ui.customsResult={speakerId:c.npcId,message:reason};
      closeChat(s,{interrupted:true});return false;
    }
    if(c.context.resolved||op.choice=="accept"&&customsIntentUnavailable(s,c.actorId,c.npcId,"oath"))return false;
  }
  if(line.speaker=="player" && line.answers?.includes(c.expectation)) {
    if(c.expectation=="name")delete c.lastSetback;
    delete c.expectation;
    c.finishAfterReply=!!c.finishAfterReply||!!c.closeAfterReply;
    delete c.closeAfterReply;
  }
  if(line.speaker=="player" && c.closingReply) {
    delete c.closingReply;
    c.finishAfterReply=!!c.finishAfterReply||!!c.closeAfterReply;
    delete c.closeAfterReply;
  }
  const risk=lineRisk(s,c,line);
  if(risk&&line.level.below=="hide")return false;
  const snapshot=()=>({row:c.row.map(i=>({...i})),regard:s.ecs.relationships[c.npcId]?.known[c.actorId]?.goodwill||0,learned:JSON.parse(JSON.stringify(s.knowledge?.[c.actorId]?.people?.[c.npcId]||{}))});
  const before=snapshot();
  const {row,popped}=rowAfter(c,{...line,risk}),pops=[];
  for(const i of popped) {
    const score=iconScore(s,i,c.actorId,c.npcId),amount=score==0?-.25:score;
    if(line.score!==false) {
      addGoodwill(s,c.actorId,c.npcId,amount);pops.push({...i,score,amount,listenerId:c.npcId});
      learnIdentity(s,c.actorId,c.npcId);const learned=knowledge(s,c.actorId).people[c.npcId];
      if(i.kind=="topic")(learned.topicTastes ||= {})[i.key]=score;
      else if(i.kind=="mood")(learned.moodTastes ||= {})[i.key]=score;
      else if(i.personId!=c.actorId)(learned.personReactions ||= {})[i.personId]={score,day:s.days};
    }
  }
  c.row=row;
  const pair=chatRecord(s,c.actorId,c.npcId);pair.used[line.useKey]=true;
  pair.last[line.family+":"+line.situation]={id:line.id,encounter:c.encounter};
  if(line.speaker=="npc") {
    s.chat.recentNpc ||= {};
    const byPurpose=s.chat.recentNpc[c.actorId] ||= {};
    const recent=byPurpose[line.family+":"+line.situation] ||= [];
    recent.push(line.id);recent.splice(0,Math.max(0,recent.length-8));
  }
  c.lastPops=[...(c.lastPops||[]),...pops];
  c.usedIds.push(line.id);
  const spoken={id:line.id,expects:line.expects,answers:line.answers,family:line.family,situation:line.situation,speaker:line.speaker,text:line.text,icons:line.icons,pops,presentation:{before,icons:[...line.icons,...(line.defiant||risk?.grievance?[{kind:"grievance"}]:[])]}};
  c.transcript.push(spoken);
  if(!risk) {
    for(const t of line.tags?.add||[])if(!c.tags.includes(t))c.tags.push(t);
    c.tags=c.tags.filter(t=>!line.tags?.remove?.includes(t));
    effects(s,c,line);
  }
  if(line.evasive) {
    const npcSpeaks=line.speaker=="npc";
    addGoodwill(s,npcSpeaks?c.npcId:c.actorId,npcSpeaks?c.actorId:c.npcId,-1);
    c.lastSetback={cost:1,message:npcSpeaks?"They avoid your question. Your regard falls.":"You avoid their question. Their regard falls."};
  }
  if(line.defiant||risk?.grievance) {
    addGoodwill(s,c.actorId,c.npcId,-2);
    const reason=line.defianceReason||risk?.reason||"disagreement";
    recordEvent(s,"defiance",[c.actorId,c.npcId],[],{reason,lineId:line.id,statement:line.text,
      villageId:c.context?.villageId||s.ecs.village?.[c.npcId]?.villageId,audienceIds:[c.actorId,c.npcId]});
    c.lastSetback={cost:2,message:"Grievance: it stays for this conversation."};
  }
  if(line.speaker=="npc"&&line.expects)c.expectation=line.expects;
  if(risk) {
    addGoodwill(s,c.actorId,c.npcId,-risk.cost);
    c.lastSetback={cost:risk.cost+(risk.grievance?2:0),message:risk.message+(risk.grievance?". They hold a grievance.":".")};
    c.reply=risk.rebuff;
  }
  if (line.speaker=="player") c.question={family:line.family,situation:line.situation,relativeId:line.b?.relative?.id};
  if(line.speaker=="player"&&!c.completed) {c.completed=true;completeConversation(s,c.actorId,c.npcId,false);pair.contacts=(pair.contacts||0)+1;recogniseConversation(s,c.actorId,c.npcId,[]);}
  const p=patience(s,c.actorId,c.npcId);
  pair.resting=p.resting;
  // Required answers may overflow a tired row. Preserve permanent grievances
  // first, then only as many ordinary icons as the visible row can hold.
  const grievances=c.row.filter(i=>i.kind=="grievance");
  c.row=[...grievances,...c.row.filter(i=>i.kind!="grievance")].slice(0,Math.max(0,p.max-p.resting));
  spoken.presentation.after=snapshot();
  const awaitsAnswer=line.speaker=="player"&&(line.resolve||line.effects?.some(e=>e.op=="set_reply_purpose"));
  if(c.phase!="opening" && c.row.length+p.resting>=p.max) {
    c.closeReason="row_full";
    if(c.expectation||c.closingReply)c.closeAfterReply=true;
    else if(awaitsAnswer)c.finishAfterReply=true;
    else endChat(s,"row_full");
  }
  return true;
}
export function reply(s,requested) {
  const c=s.chat.active;c.phase="reply";
  let line;
  if(c.finishAfterReply&&["open","practical"].includes(requested))line=pickNpc(s,c,"answer_acknowledged");
  if(!line&&(requested=="need_news" || requested=="introduction_reply" && c.knewBefore && c.completed))line=pickNpc(s,c,"favour_ask",true);
  if(!line&&requested&&!["open","player_introduction_or_open","practical","favour_choice"].includes(requested))line=pickNpc(s,c,requested);
  if(!line&&(!requested||["open","player_introduction_or_open","practical","favour_choice"].includes(requested)))for(const f of ["own_news","visit_news","event_news","work_talk","season_talk"]){line=pickNpc(s,c,f,["favour_ask","event_news"].includes(f));if(line)break;}
  if(line){speakLine(s,line);noteExhausted(s,c,line);
    if(requested=="maternal_recognition"&&firstFamilyRequest(s,c.actorId,c.npcId)) {
      const offer=pickNpc(s,c,"favour_ask",true);
      // An ask that grows out of their own trouble comes after they tell it.
      if(offer&&["word","peace","visit","find"].includes(offer.b?.request?.kind)){const own=pickNpc(s,c,"own_news");if(own)speakLine(s,own);}
      if(offer)speakLine(s,offer);
    }
    // Someone who has just told you of their own trouble may ask for your help with it.
    if(line.family=="own_news"&&line.situation.startsWith("told_")) {
      const ask=pickNpc(s,c,"favour_ask",true);if(ask&&["word","peace","visit","find"].includes(ask.b?.request?.kind))speakLine(s,ask);
    }
    if(["nothing_more","nothing_more_village"].includes(line.situation)&&!c.pendingOfferId)endChat(s,c.closeReason||"no_news");}
  else endChat(s,c.closeReason||"no_news");
  c.phase="player_turn";
}
export function noteExhausted(s,c,line) {
  if(!line?.exhausts||!c.question)return;
  const pair=chatRecord(s,c.actorId,c.npcId);
  (pair.exhausted ||= {})[c.question.family+":"+c.question.situation]=Math.max(0,RINGS.indexOf(s.ecs.relationships?.[c.npcId]?.known[c.actorId]?.ring));
}
export function chooseLine(s,key) {
  const c=s.chat?.active;if(!c||c.endReason)return false;
  const line=chatChoices(s).find(l=>l.key==key);if(!line)return false;
  c.lastPops=[];
  if(!speakLine(s,line))return false;
  if(line.family=="leave_taking"){endChat(s,"exchange_complete");return true;}
  if(!c.endReason)reply(s,c.reply);
  if(!c.endReason && !c.expectation && !c.closingReply && c.finishAfterReply)endChat(s,c.closeReason||(c.row.length+patience(s,c.actorId,c.npcId).resting>=patience(s,c.actorId,c.npcId).max?"row_full":"exchange_complete"));
  if(!c.endReason && !c.expectation && !c.closingReply && patience(s,c.actorId,c.npcId).max==2)endChat(s,"tired");
  c.focus=null;
  return true;
}
export function endChat(s,reason) {
  const c=s.chat.active;if(c.endReason)return;c.endReason=reason;c.phase="closing";
  if(reason=="player_ended") {
    const farewell=variants(s,c,lineCandidates(s,c,"leave_taking","player"))[0];
    if(farewell) {
      c.usedIds.push(farewell.id);
      c.transcript.push({id:farewell.id,family:farewell.family,speaker:"player",text:farewell.text,icons:[],pops:[]});
      chatRecord(s,c.actorId,c.npcId).last[farewell.family+":"+farewell.situation]={id:farewell.id,encounter:c.encounter};
    }
  }
  const line=pickNpc(s,c,"leave_taking");
  if(line){c.usedIds.push(line.id);c.transcript.push({id:line.id,expects:line.expects,answers:line.answers,family:line.family,speaker:"npc",text:line.text,icons:[],pops:[]});chatRecord(s,c.actorId,c.npcId).last[line.family+":"+line.situation]={id:line.id,encounter:c.encounter};}
}
export function closeChat(s,{interrupted=false}={}) {
  const c=s.chat?.active;if(!c)return;
  if(!interrupted&&c.expectation=="warning")return false;
  if(!c.endReason)endChat(s,"player_ended");
  const pair=chatRecord(s,c.actorId,c.npcId),p=patience(s,c.actorId,c.npcId);
  pair.resting=Math.min(p.max,p.resting+c.row.length);
  (s.chat.history ||= []).push({actorId:c.actorId,npcId:c.npcId,day:s.days,encounter:c.encounter,endReason:c.endReason,lines:c.transcript});
  const target=s.ecs.planner?.[c.npcId];if(target?.world.capturedBy==c.actorId)target.world.capturedBy=null;
  const taskId=c.taskId;
  if(c.initiatedBy&&target) {delete target.world.chatVisit;target.task=null;target.plan=null;}
  if(taskId)completeChatOrder(s,taskId);
  s.game_speed=c.previousSpeed;delete s.chat.active;
  s.redraws?.push(c.actorId,c.npcId);
}
export function openChat(s,actor,npc,options={}) {
  if(s.chat?.active)return s.chat.active.npcId==npc;
  const e=s.ecs,a=e.spatial[actor],b=e.spatial[npc];
  if(options.intent) {
    const reason=customsIntentUnavailable(s,actor,npc,options.intent);
    if(reason){s.ui.talkResult={personId:npc,message:reason};return false;}
    options={...options,openingFamily:"village_"+options.intent,context:customsChatContext(s,actor,npc,options.intent),required:true};
  }
  if(!a||!b||e.personable[actor]?.dead||e.personable[npc]?.dead||Math.hypot(a.x-b.x,a.y-b.y)>SPEECH_REACH||e.interior?.[actor]?.buildingId!=e.interior?.[npc]?.buildingId)return false;
  const flags=e.planner?.[npc]?.world.feeling;
  if(flags?.hungry||flags?.tired)return false;
  const key=[actor,npc].sort().join(":");if(!options.required&&s.social?.avoidance?.[key]>s.days)return false;
  if(!options.required&&patience(s,actor,npc).free<patience(s,actor,npc).minimum)return false;
  const knewBefore=!!e.relationships[npc]?.known[actor],pair=chatRecord(s,actor,npc);
  const c=s.chat.active={actorId:actor,npcId:npc,encounter:++pair.encounters,knewBefore,phase:"opening",tags:[],row:[],usedIds:[],transcript:[],
    initiatedBy:options.initiatedBy,context:options.context,required:options.required,
    taskId:!options.initiatedBy&&e.manager?.[actor]?.jobs.find(j=>j.job.key=="chat" && j.targetId==npc && !j.failed)?.id,subjectId:e.manager?.[actor]?.jobs.find(j=>j.assignedId==actor)?.aboutId,previousSpeed:s.game_speed,activity:e.planner?.[actor]?.world.chatActivity||snapshotActivity(s,npc),mode:"ordinary",
    startRanks:{[npc]:Math.max(0,RINGS.indexOf(e.relationships?.[npc]?.known[actor]?.ring)),[actor]:Math.max(0,RINGS.indexOf(e.relationships?.[actor]?.known[npc]?.ring))}};
  meet(s,actor,npc);meet(s,npc,actor);s.game_speed="paused";
  if(e.planner[npc])e.planner[npc].world.capturedBy=actor;
  if((!options.openingFamily || options.openingFamily=="greeting") && s.ecs.planner?.[npc]?.world.festivalPlace)options={...options,openingFamily:"festival"};
  let line=options.openingFamily?pickNpc(s,c,options.openingFamily):pickNpc(s,c,"visit_news");
  if(!options.openingFamily&&line&&line.icons.length>=patience(s,actor,npc).free)line=null;
  line ||= pickNpc(s,c,"recall");
  line ||= pickNpc(s,c,"greeting");
  if(line)speakLine(s,line);else {s.game_speed=c.previousSpeed;delete s.chat.active;return false;}
  c.phase="player_turn";
  if(s.ui.show)s.ui.show.selected_person=null;
  s.redraws?.push(actor,npc);return true;
}
export function selectChatSubject(s,id) {if(s.chat?.active&&!s.chat.active.endReason){s.chat.active.subjectId=id||null;s.chat.active.focus="news";}}
export function chatPersonName(s,id) {return id==s.ui.playerId?"You":displayName(s,id,x=>personFact(s,x)?.first_name)||"Someone";}

// Any authored opening can use this physical approach. Callers supply the
// reason as serialisable context; no completed contact exists until a reply.
export function startVillagerChat(s,npc,{actorId=s.ui.playerId,openingFamily="greeting",context,required=false}={}) {
  const p=s.ecs.planner?.[npc];
  if(!p||s.ecs.personable[npc]?.dead||s.ecs.personable[actorId]?.dead||p.world.chatVisit)return false;
  p.world.chatVisit={actorId,openingFamily,context,required};p.task=null;p.plan=null;
  return true;
}
