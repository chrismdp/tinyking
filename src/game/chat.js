import { completeChatOrder } from "game/manager";
import LINES from "data/conversation_lines.json";
import { addGoodwill, meet, disposition, RINGS, completeConversation } from "game/people";
import { learnEvent } from "game/events";
import { recogniseConversation } from "game/guidance";
import { acceptFavour } from "game/favours";
import { hashUnit } from "game/math";
import { patience, chatRecord } from "game/chat_patience";
import { baseBindings, sourceValues, predicate, snapshotActivity, heard, personFact, knows } from "game/chat_facts";
import { SPEECH_REACH } from "game/conversation";
export { patience, recoverSlots } from "game/chat_patience";
export const TOPICS={family:"Family",work:"Work",harvest:"Harvest",food:"Food",season:"Season",village:"Village",faith:"Faith",gossip:"Gossip",help:"Help"};
const mapping={family:[["generous","humble"],["greedy"]],work:[["hard-working"],["lazy"]],harvest:[["hard-working","generous"],["lazy"]],food:[["cheerful"],["gloomy"]],season:[["brave"],["timid"]],village:[["generous","humble"],["greedy","proud"]],faith:[["pious"],["worldly"]],gossip:[["proud","gloomy"],["humble"]],help:[["generous"],["greedy"]]};
const clamp=(v,n)=>Math.max(-n,Math.min(n,v));
const traitWeight=(s,id,t)=>{const p=s.ecs.personality[id];return Number(p.traits.includes(t))+Number(p.likes.includes(t))-Number(p.dislikes.includes(t));};
export function topicScore(s,id,topic) {const [add,sub]=mapping[topic];return clamp(add.reduce((v,t)=>v+traitWeight(s,id,t),0)-sub.reduce((v,t)=>v+traitWeight(s,id,t),0),2);}
export const iconKey=i=>i.kind=="person"?"person:"+i.personId:"topic:"+i.key;
export function iconScore(s,icon,speaker,listener) {
  if(icon.kind=="topic")return topicScore(s,listener,icon.key);
  if(icon.personId==speaker)return -1;
  if(icon.personId==listener)return clamp(traitWeight(s,listener,"proud")-traitWeight(s,listener,"humble"),1);
  const b=s.ecs.relationships[listener]?.known[icon.personId];
  if(disposition(s,listener,icon.personId)=="hate"||b?.goodwill<0)return -2;
  return [0,1,2,2][Math.max(0,RINGS.indexOf(b?.ring))];
}
const knowledge=(s,id)=>{s.knowledge ||= {};return s.knowledge[id] ||= {people:{},feelings:{}};};
function learnIdentity(s,viewer,id) {if(!id)return;const k=knowledge(s,viewer);(k.people ||= {})[id] ||= {traits:[]};}
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
  const pair=chatRecord(s,c.actorId,c.npcId),result=[];
  for(const row of LINES) {
    if(row.family!=family||speaker&&row.speaker!=speaker||c.usedIds.includes(row.id)&&!row.situation.startsWith("fallback_")&&family!="referral_reply")continue;
    if(!row.tags.require.every(t=>c.tags.includes(t))||row.tags.forbid.some(t=>c.tags.includes(t)))continue;
    let bound=[baseBindings(s,c)];
    for(const key of bindingOrder(row.bindings))bound=bound.flatMap(b=>sourceValues(s,c,b,{...row.bindings[key],jobKey:row.when.all.find(p=>p.test=="player_has_queued_order")?.args.key}).map(v=>({...b,[key]:v})));
    for(const b of bound) {
      const tests=[...row.when.all,...row.when.none].map(p=>predicate(s,c,b,p));
      if(tests.some(v=>v===undefined)||!row.when.all.every((_,i)=>tests[i])||row.when.none.some((_,i)=>tests[row.when.all.length+i]))continue;
      const text=interpolate(row.text,b),useKey=interpolate(row.use_key,b);
      if(text==null||useKey==null)continue;
      const reoffer=family=="favour_ask" && c.tags.includes("offered_help") && s.knowledge?.[c.actorId]?.declinedOffers?.[b.request?.id];
      if(pair.used[useKey] && !row.situation.startsWith("fallback_") && family!="referral_reply" && !reoffer && !["greeting","leave_taking","introduction_reply","name_answer"].includes(family))continue;
      const icons=row.icons.map(i=>i.kind=="topic"?{...i}:{kind:"person",personId:b[i.ref]?.id});
      if(icons.some(i=>i.kind=="person"&&!i.personId))continue;
      result.push({...row,text,useKey,key:row.id+"|"+useKey,icons,b});
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
  const row=[...c.row],matchingKeys=[];let matches=0,added=0;
  for(const icon of line.icons) {const i=row.findIndex(x=>x.life>0&&iconKey(x)==iconKey(icon));if(i>=0){row.splice(i,1);matches++;matchingKeys.push(iconKey(icon));}else added++;}
  const p=patience(s,c.actorId,c.npcId);
  const closing=c.closingReply && (c.closingReply=="offer"?["favour_accept","favour_decline"]:["referral_reply"]).includes(line.family);
  return {matches,matchingKeys,remaining:row.length+added,fits:closing || line.speaker=="npc"&&c.phase=="reply" || row.length+added+p.resting<=p.max};
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
    const topic=l=>l.icons.filter(i=>i.kind=="topic"&&c.row.some(x=>x.life>0&&iconKey(i)==iconKey(x))).length;
    const date=l=>Math.max(-Infinity,...Object.values(l.b).filter(x=>x?.people&&x?.day!=null).map(x=>x.day));
    const distance=l=>{const at=s.ecs.spatial[c.actorId],target=l.b.other?.point||s.ecs.spatial[l.b.request?.householdId];return at&&target?Math.hypot(target.x-at.x,target.y-at.y):Infinity;};
    return Number(a.situation.startsWith("fallback_"))-Number(b.situation.startsWith("fallback_"))||topic(b)-topic(a)||date(b)-date(a)||(["lands_villages","need_news"].includes(family)?distance(a)-distance(b):0)||a.useKey.localeCompare(b.useKey);
  });
  return rows[0];
}
export function chatChoices(s) {
  const c=s.chat?.active;if(!c||c.endReason)return [];
  c.phase="player_turn";
  const families=[...new Set(LINES.filter(l=>l.speaker=="player"&&l.family!="leave_taking").map(l=>l.family))];
  const available=families.flatMap(f=>variants(s,c,lineCandidates(s,c,f,"player")));
  let all=available;
  if(c.closingReply) return all.filter(l=>(c.closingReply=="offer"?["favour_accept","favour_decline"]:["referral_reply"]).includes(l.family));
  if (c.focus) {
    const focus={family:["family_question","player_family"],work:["work_question","player_work"],news:["gossip_question","gossip_tell","visit_question"],help:["need_question","help_offer","favour_accept","favour_decline","favour_progress"],village:["lands_question","village_question"],season:["season_talk"]}[c.focus];
    all=all.filter(l=>focus.includes(l.family)||c.focus=="season"&&l.family=="lands_question"&&l.situation=="country");
  }
  // Practical lines remain reachable; the list otherwise favours a visible
  // match and distinct purposes, without looking up hidden taste scores.
  all.sort((a,b)=>{
    const rank=l=>!previewLine(s,l).fits?-20:l.family=="favour_accept"?100:l.family=="favour_decline"?90:c.focus=="family"&&l.family=="family_question"&&l.situation=="general"?80:["season_talk","lands_question","need_question"].includes(l.family)?70+previewLine(s,l).matches:l.family=="introduction"?60:previewLine(s,l).matches*4;
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
  return result;
}
function effects(s,c,line) {
  const b=line.b||{},ref=x=>b[x]?.id,viewer=ref(line.disclosure?.to),speaker=line.speaker=="player"?c.actorId:c.npcId;
  for(const id of line.disclosure?.people||[])learnIdentity(s,viewer,ref(id));
  const disclosed=[];
  for(const key of line.disclosure?.events||[]) {
    const event=(s.events||[]).find(e=>e.id==b[key]?.id);if(!event)continue;
    if(line.speaker=="player"){c.toldEventId=event.id;c.npcKnewEvent=heard(s,c.npcId,event);}
    learnEvent(s,viewer,event);disclosed.push(event);
    const k=knowledge(s,viewer);(k.spokenSources ||= {})[event.id]={speakerId:speaker,day:s.days,lineId:line.id};
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
  if(line.speaker=="player" && c.closingReply) {
    delete c.closingReply;
    c.finishAfterReply=!!c.closeAfterReply;
    delete c.closeAfterReply;
  }
  const earlyHelp=line.speaker=="player" && ["need_question","help_offer"].includes(line.family) &&
    !knows(s,c.npcId,c.actorId) && s.ecs.personality[c.npcId].traits.some(t=>["timid","proud"].includes(t));
  const old=[...c.row],fresh=[],pops=[];
  for(const i of line.icons) {
    const at=old.findIndex(x=>x.life>0&&iconKey(x)==iconKey(i));
    if(at<0)fresh.push({...i,life:3});
    else {
      old.splice(at,1);const score=iconScore(s,i,c.actorId,c.npcId),amount=score==0?-.25:score;
      addGoodwill(s,c.actorId,c.npcId,amount);pops.push({...i,score,amount,listenerId:c.npcId});
      learnIdentity(s,c.actorId,c.npcId);const learned=knowledge(s,c.actorId).people[c.npcId];
      if(i.kind=="topic")(learned.topicTastes ||= {})[i.key]=score;
      else if(i.personId!=c.actorId)(learned.personReactions ||= {})[i.personId]={score,day:s.days};
    }
  }
  const aged=old.map(x=>({...x,life:Math.max(0,x.life-1)}));
  c.lastFades=aged.filter(x=>x.life==0);
  // The decisions defer faded icons blocking slots. In v1 they fade out of
  // the row; only surviving icons become resting cells when the chat closes.
  c.row=[...aged.filter(x=>x.life>0),...fresh];
  const pair=chatRecord(s,c.actorId,c.npcId);pair.used[line.useKey]=true;
  pair.last[line.family+":"+line.situation]={id:line.id,encounter:c.encounter};
  if(line.speaker=="npc") {
    s.chat.recentNpc ||= {};
    const byPurpose=s.chat.recentNpc[c.actorId] ||= {};
    const recent=byPurpose[line.family+":"+line.situation] ||= [];
    recent.push(line.id);recent.splice(0,Math.max(0,recent.length-8));
  }
  c.lastPops=[...(c.lastPops||[]),...pops];
  c.usedIds.push(line.id);c.transcript.push({id:line.id,family:line.family,situation:line.situation,speaker:line.speaker,text:line.text,icons:line.icons,pops});
  for(const t of line.tags?.add||[])if(!c.tags.includes(t))c.tags.push(t);
  c.tags=c.tags.filter(t=>!line.tags?.remove?.includes(t));
  effects(s,c,line);
  if(earlyHelp) {
    addGoodwill(s,c.actorId,c.npcId,-2);
    c.earlyHelpReaction="Help before an introduction: −2 regard. Introduce yourself first.";
    c.reply="help_refusal";
  }
  if (line.speaker=="player") c.question={family:line.family,situation:line.situation,relativeId:line.b?.relative?.id};
  if(line.speaker=="player"&&!c.completed) {c.completed=true;completeConversation(s,c.actorId,c.npcId,false);pair.contacts=(pair.contacts||0)+1;recogniseConversation(s,c.actorId,c.npcId,[]);}
  const p=patience(s,c.actorId,c.npcId);
  pair.resting=p.resting;
  c.row=c.row.slice(0,Math.max(0,p.max-p.resting));
  const awaitsAnswer=line.speaker=="player"&&(line.resolve||line.effects?.some(e=>e.op=="set_reply_purpose"));
  if(c.phase!="opening" && c.row.length+p.resting>=p.max) {
    if(c.closingReply)c.closeAfterReply=true;
    else if(!awaitsAnswer)endChat(s,"row_full");
  } else if(!c.row.length&&c.lastFades.length&&!c.closingReply&&!awaitsAnswer)endChat(s,"all_faded");
  return true;
}
export function reply(s,requested) {
  const c=s.chat.active;c.phase="reply";
  let line;
  if(requested=="need_news" || requested=="introduction_reply" && c.knewBefore && c.completed)line=pickNpc(s,c,"favour_ask",true);
  if(!line&&requested&&!["open","player_introduction_or_open","practical","favour_choice"].includes(requested))line=pickNpc(s,c,requested);
  if(!line&&(!requested||["open","player_introduction_or_open","practical","favour_choice"].includes(requested)))for(const f of ["visit_news","event_news","work_talk","season_talk"]){line=pickNpc(s,c,f,["favour_ask","event_news"].includes(f));if(line)break;}
  if(line){speakLine(s,line);if(["nothing_more","nothing_more_village"].includes(line.situation)&&!c.pendingOfferId)endChat(s,"no_news");}
  else endChat(s,"no_news");
  c.phase="player_turn";
}
export function chooseLine(s,key) {
  const c=s.chat?.active;if(!c||c.endReason)return false;
  const line=chatChoices(s).find(l=>l.key==key);if(!line)return false;
  c.lastPops=[];
  if(!speakLine(s,line))return false;
  if(!c.endReason)reply(s,c.reply);
  if(!c.endReason && !c.closingReply && c.finishAfterReply)endChat(s,c.row.length+patience(s,c.actorId,c.npcId).resting>=patience(s,c.actorId,c.npcId).max?"row_full":"exchange_complete");
  if(!c.endReason && !c.closingReply && patience(s,c.actorId,c.npcId).max==2)endChat(s,"tired");
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
  if(line){c.usedIds.push(line.id);c.transcript.push({id:line.id,family:line.family,speaker:"npc",text:line.text,icons:[],pops:[]});chatRecord(s,c.actorId,c.npcId).last[line.family+":"+line.situation]={id:line.id,encounter:c.encounter};}
}
export function closeChat(s) {
  const c=s.chat?.active;if(!c)return;
  if(!c.endReason)endChat(s,"player_ended");
  const pair=chatRecord(s,c.actorId,c.npcId),p=patience(s,c.actorId,c.npcId);
  pair.resting=Math.min(p.max,p.resting+c.row.length);
  (s.chat.history ||= []).push({actorId:c.actorId,npcId:c.npcId,day:s.days,encounter:c.encounter,endReason:c.endReason,lines:c.transcript});
  const target=s.ecs.planner?.[c.npcId];if(target?.world.capturedBy==c.actorId)target.world.capturedBy=null;
  const taskId=c.taskId || s.ecs.manager?.[c.actorId]?.jobs.find(j=>j.job.key=="chat"&&j.targetId==c.npcId)?.id;
  if(taskId)completeChatOrder(s,taskId);
  s.game_speed=c.previousSpeed;delete s.chat.active;
  s.redraws?.push(c.actorId,c.npcId);
}
export function openChat(s,actor,npc) {
  if(s.chat?.active)return s.chat.active.npcId==npc;
  const e=s.ecs,a=e.spatial[actor],b=e.spatial[npc];
  if(!a||!b||e.personable[actor]?.dead||e.personable[npc]?.dead||Math.hypot(a.x-b.x,a.y-b.y)>SPEECH_REACH||e.interior?.[actor]?.buildingId!=e.interior?.[npc]?.buildingId)return false;
  const flags=e.planner?.[npc]?.world.feeling;
  if(flags?.hungry||flags?.tired)return false;
  const key=[actor,npc].sort().join(":");if(s.social?.avoidance?.[key]>s.days)return false;
  if(patience(s,actor,npc).free<patience(s,actor,npc).minimum)return false;
  const knewBefore=!!e.relationships[npc]?.known[actor],pair=chatRecord(s,actor,npc);
  const c=s.chat.active={actorId:actor,npcId:npc,encounter:++pair.encounters,knewBefore,phase:"opening",tags:[],row:[],usedIds:[],transcript:[],
    taskId:e.manager?.[actor]?.jobs.find(j=>j.job.key=="chat" && j.targetId==npc && !j.failed)?.id,subjectId:e.manager?.[actor]?.jobs.find(j=>j.assignedId==actor)?.aboutId,previousSpeed:s.game_speed,activity:e.planner?.[actor]?.world.chatActivity||snapshotActivity(s,npc),mode:"ordinary"};
  meet(s,actor,npc);meet(s,npc,actor);s.game_speed="paused";
  let line=pickNpc(s,c,"visit_news");
  if(line&&line.icons.length>=patience(s,actor,npc).free)line=null;
  line ||= pickNpc(s,c,"recall");
  line ||= pickNpc(s,c,"greeting");
  if(line)speakLine(s,line);else {s.game_speed=c.previousSpeed;delete s.chat.active;return false;}
  c.phase="player_turn";
  if(s.ui.show)s.ui.show.selected_person=null;
  s.redraws?.push(actor,npc);return true;
}
export function selectChatSubject(s,id) {if(s.chat?.active&&!s.chat.active.endReason){s.chat.active.subjectId=id||null;s.chat.active.focus="news";}}
export function chatPersonName(s,id) {return id==s.ui.playerId?"You":personFact(s,id)?.first_name||"Someone";}
