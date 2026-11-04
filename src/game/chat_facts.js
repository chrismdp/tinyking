import { lifeStageLabel } from "game/life_stages";
import { eventById } from "game/events";
import { knowsEvent } from "game/event_knowledge";
import { householdMembers } from "game/population_index";
import { condition } from "game/social_conditions";
import { personComponent } from "game/residents";
import { familySearchFacts, maternalIntroduction } from "game/mother_family";
/* global require */
import EVENT_TYPES from "data/event_types.json";
import { eventText } from "game/events";
import { personLabel } from "game/knowledge";
import { RINGS, disposition, siblingsOf, canDiscloseEvent } from "game/people";
import { closeFamily, knownEvents } from "game/events";
import { localWeather } from "game/weather";
import { season, time, seasonPart, year, DAYS_IN_SEASON } from "game/time";
import { villageElder, membership, resourcePermission, customsIntentUnavailable, warningConsequences, OATH_RIGHTS } from "game/village_customs";
import { householdStore, householdFood, reasonGone, canRequestForHousehold, favourSource, FUEL_TRADES, nearbyRequester } from "game/favours";
import { growingAt, frozenAt, climateTile } from "game/climate";
import { Hex } from "game/hex";
import { currentReach, worldDirection, localDirection, countryWords, placeFact, discoveredVillage, knownPlaces, ownTrips, visitedVillage, landsFact, landsTold } from "game/chat_lands";
import { patience } from "game/chat_patience";

export const VISITS=Object.keys(EVENT_TYPES).filter(type=>EVENT_TYPES[type].spokenVisit);
const trades={baker:"oven",smith:"forge",carpenter:"workshop",weaver:"loom",tanner:"tan-yard",miller:"mill"};
export const words=n=>["no","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"][n] ?? String(n);
const living=(s,id)=>!!s.ecs.personable[id]&&!s.ecs.personable[id].dead;
const residents=(s,h)=>householdMembers(s,h).filter(id=>living(s,id));
export function knows(s,viewer,id) {
  const c=s.chat?.active;
  if(c&&viewer==c.npcId&&id==c.actorId&&!c.knewBefore&&!s.knowledge?.[viewer]?.people?.[id])return false;
  return !!id && (viewer==id || !!s.knowledge?.[viewer]?.people?.[id] || !!s.ecs.relationships?.[viewer]?.known[id]);}
export function heard(s,viewer,e) {return knowsEvent(s,viewer,e);}
export function notable(s,id) {
  const h=s.ecs.household?.[id]?.houseId,v=s.ecs.village?.[id]?.villageId;
  return living(s,id) && (!!s.ecs.profession?.[id] || !!h&&s.ecs.controllable[h]?.controllerId==id || !!v&&villageElder(s,v)==id);
}
export function relevantVisit(s,speaker,viewer,e) {
  return !!e && VISITS.includes(e.type) && heard(s,speaker,e) && !heard(s,viewer,e) && canDiscloseEvent(s,speaker,viewer,e) &&
    (knows(s,viewer,e.people[0]) || notable(s,e.people[0])&&knows(s,speaker,e.people[0])) &&
    (e.people.includes(speaker) || e.villageId==s.ecs.village?.[speaker]?.villageId || e.fromWorld==(s.travel?.active||s.map?.worldKey));
}
export function relativeDate(s,e,exact=false) {
  const day=e.day, st=season(day),sy=year(day);
  if(exact)return `the ${st} of year ${sy}`;
  if(Math.floor(s.days)==Math.floor(day))return "earlier today";
  if(Math.floor(s.days)-Math.floor(day)==1)return "yesterday";
  const ago=Math.floor(s.days/DAYS_IN_SEASON)-Math.floor(day/DAYS_IN_SEASON);
  if(ago==0)return `earlier this ${st}`;
  if(ago<4)return `last ${st}`;
  if(ago<8)return `the ${st} before last`;
  return `${words(year(s.days)-sy)} years back, in the ${st}`;
}
export function personFact(s,id) {
  if(!personComponent(s,"personable",id)||personComponent(s,"personable",id).unrevealed)return null;
  const e=s.ecs,n=personComponent(s,"nameable",id)||{},p=personComponent(s,"personable",id),v=e.village?.[id]?.villageId,h=e.household?.[id]?.houseId;
  const full=s.personName?.(id) || n.nickname || (n.type=="person" && n.seed!=null ? require("game/name").name(n) : null) || (n.firstName ? [n.firstName,n.familyName].filter(Boolean).join(" ") : undefined);
  return {id,first_name:full?.split(" ")[0],family_name:full?.split(" ").slice(1).join(" "),name:full,village:v,household:h,
    village_name:s.villages?.[v]?.name,life_stage:lifeStageLabel(p.age),trade:e.profession?.[id]?.trade,
    workplace_name:trades[e.profession?.[id]?.trade],children_words:words((e.kinship[id]?.children||[]).filter(c=>living(s,c)).length),
    him_her:n.male?"him":"her",he_she:n.male?"he":"she",boy_girl:n.male?"boy":"girl",son_daughter:n.male?"son":"daughter",
    arrived_when:e.playable?.[id]?.arrivedAt!=null?relativeDate(s,{day:e.playable[id].arrivedAt}):undefined};
}
export function kinLinks(s,id) {
  const k=personComponent(s,"kinship",id)||{parents:[],children:[]};
  const pairs=[...(k.spouse?[[k.spouse,"spouse"]]:[]),...k.parents.map(x=>[x,"parent"]),...k.children.map(x=>[x,"child"]),...siblingsOf(s,id).map(x=>[x,"sibling"]),
    ...k.parents.flatMap(p=>(s.ecs.kinship[p]?.parents||[]).map(x=>[x,"grandparent"])),...k.children.flatMap(p=>(s.ecs.kinship[p]?.children||[]).map(x=>[x,"grandchild"]))];
  return pairs.filter(([r])=>personComponent(s,"personable",r)&&!personComponent(s,"personable",r).unrevealed).map(([r,kind])=>{
    const male=s.ecs.nameable[r]?.male, inv=s.ecs.nameable[id]?.male;
    const term=(kind,m)=>({spouse:m?"husband":"wife",parent:m?"father":"mother",child:m?"son":"daughter",sibling:m?"brother":"sister",grandparent:m?"grandfather":"grandmother",grandchild:m?"grandson":"granddaughter"}[kind]);
    return {id:id+":"+r+":"+kind,speaker_id:id,relative_id:r,kinship:kind,kin_term:term(kind,male),inverse_term:term(({parent:"child",child:"parent",grandparent:"grandchild",grandchild:"grandparent"})[kind]||kind,inv)};
  });
}
export const linkKnown=(s,viewer,l)=>!!l&&!!s.knowledge?.[viewer]?.kinLinks?.[l.id];
function homeFact(s,id) {
  if(!id)return null;
  const h=s.ecs.household?.[id];
  return {id,...h,stage:s.ecs.camp?.[id]?"camp":s.ecs.shelter?.[id]?.stage|| (s.ecs.building?.[id]?"house":undefined),owner:s.ecs.controllable[id]?.controllerId,size_words:words(residents(s,id).length)};
}
export function eventFact(s,e) {
  if(!e)return null;
  const item=e.items?.[0],good=e.gifts?.[0]?.type||s.ecs.good?.[item]?.type;
  const far=e.fromWorld==currentReach(s)?e.toWorld:e.fromWorld;
  return {...e,account_sentence:eventText(s,e,id=>personLabel(s,id,s.personName,s.chat?.active?.npcId),"chat"),tell_sentence:eventText(s,e,id=>personLabel(s,id,s.personName,s.chat?.active?.actorId),"chat"),account:({woodland:"refused to heed the woodland warning from",death:"pressed for an account of a death from",flirt:"made an unwelcome advance to",disagreement:"defied",intrusion:"offended"})[e.reason],when:relativeDate(s,e),when_exact:relativeDate(s,e,true),village:e.villageId,
    item_name:s.ecs.possession?.[item]?.name,item_phrase:s.ecs.possession?.[item]?.name || (good?"some "+good:undefined),
    building_name:({smith:"forge",carpenter:"workshop",weaver:"weaving shed",baker:"bakehouse",tanner:"tan-yard",miller:"mill",alehouse:"alehouse"})[e.kind],
    addition_phrase:({"Rear work bay":"a work bay at the back","Long rear wing":"a long wing at the back"})[e.addition],
    from_village_name:s.villages?.[e.fromVillage]?.name,to_village_name:s.villages?.[e.toVillage]?.name,village_name:s.villages?.[e.villageId]?.name,
    from_direction:worldDirection(s,e.fromWorld),to_direction:worldDirection(s,e.toWorld),far_direction:worldDirection(s,far),far_country_words:countryWords(s,far)};
}
export function snapshotActivity(s,id) {
  const e=s.ecs,p=e.planner?.[id],w=p?.world||{},task=p?.task||[],[key,target,place]=task;
  let activity=key;
  if(key=="perform_subtask_in_slot")activity=({ploughed:"plough",sown:"sow",harvested:"harvest"})[w.places?.[place]?.result];
  if(key=="walk_to")activity=e.meetingPlace?.[target]?"walk_to_place":w.social?.stage=="returning"?"returning_home":w.social?"visiting":"walking";
  if(key=="chop_tree")activity="fell";
  if(key=="collect_log")activity="collect_wood";
  if(key=="tend_garden")activity=e.backyard?.[target]?.kind=="vegetable"?"garden":"tend_field";
  if(key=="socialise")activity="visiting";
  if(w.helpingFriend)activity="helping_friend";
  if(!key||["wait_for","home_downtime","idle_person"].includes(key))activity="idle";
  const held=(e.holder?.[id]?.held||[]).map(x=>e.good?.[x]?.type).filter(Boolean);
  return {key:activity,target,task:[...task],social:w.social?{...w.social}:null,held:[...held],held_phrase:held.length?(held[0]=="wood"?"a log":"some "+held[0]):undefined,
    partner:personFact(s,w.social?.partnerId),place_name:e.meetingPlace?.[target]?.kind,work_noun:activity=="trade_work"?trades[e.profession?.[id]?.trade]:({plough:"field",sow:"field",harvest:"field",fell:"felling",forage:"foraging",garden:"garden",tend_field:"field",helping_friend:"work",carry_home:"carrying",collect_wood:"woodpile"})[activity]};
}
export function baseBindings(s,c) {
  const tod=time(s.days);
  return {player:personFact(s,c.actorId),npc:personFact(s,c.npcId),contact:{id:c.actorId+":"+c.npcId},
    context:{salute:tod=="morning"?"Morning":tod=="afternoon"?"Afternoon":"Evening",time_of_day:tod,season:season(s.days),weather_phrase:({clear:"this fine weather",cloudy:"this grey weather",rain:"this rain",snow:"this snow",storm:"this wind"})[localWeather(s)?.type],world_key:currentReach(s),encounter_number:c.encounter,game_hour:Math.floor(s.days*24)}};
}
const requests=(s,n)=>Object.values(s.favours?.requests||{}).filter(r=>r.householdId==s.ecs.household?.[n]?.houseId);
const OWN_NEWS=["quarrel","reconciliation","marriage","birth","death","move","inheritance"];
export function newsEvents(s,c,visits=false) {
  return knownEvents(s,c.npcId).filter(e=>visits?relevantVisit(s,c.npcId,c.actorId,e):!VISITS.includes(e.type)&&!heard(s,c.actorId,e)&&canDiscloseEvent(s,c.npcId,c.actorId,e)&&
    (c.subjectId?e.people.includes(c.subjectId):e.villageId==s.ecs.village?.[c.npcId]?.villageId)).sort((a,b)=>b.day-a.day||a.id.localeCompare(b.id));
}
export function knownOpenRequests(s,npc) {
  return Object.values(s.favours?.requests||{}).filter(r=>r.status=="offered"&&!reasonGone(s,r)&&living(s,r.giverId)&&
    (s.ecs.village?.[r.giverId]?.villageId==s.ecs.village?.[npc]?.villageId||residents(s,r.householdId).some(id=>RINGS.indexOf(s.ecs.relationships?.[npc]?.known[id]?.ring)>=1||closeFamily(s,npc).includes(id))));
}
function elsewhereRequests(s,c) {
  const k=s.knowledge?.[c.actorId];
  return knownOpenRequests(s,c.npcId).filter(r=>r.householdId!=s.ecs.household?.[c.npcId]?.houseId&&r.householdId!=s.ecs.household?.[c.actorId]?.houseId&&!k?.offers?.[r.id]&&!k?.heardNeeds?.[r.id]);
}
function tellableTravel(s,c) {
  return knownEvents(s,c.npcId).filter(e=>["world_visit","world_move","return"].includes(e.type)&&e.people[0]!=c.npcId&&e.fromWorld&&e.toWorld&&
    (knows(s,c.actorId,e.people[0])||notable(s,e.people[0])&&knows(s,c.npcId,e.people[0]))&&
    canDiscloseEvent(s,c.npcId,c.actorId,e));
}
// Bind one source at a time. Multiple real events/relatives remain distinct
// candidates; an absent source rejects the row, including in negative tests.
export function sourceValues(s,c,b,d) {
  const e=s.ecs,p=c.actorId,n=c.npcId,ref=x=>x?.split(".").reduce((v,k)=>v?.[k],b),person=x=>ref(x)?.id;
  const events=(type,id)=>knownEvents(s,n,id).filter(x=>x.type==type&&canDiscloseEvent(s,n,p,x)).sort((a,b)=>b.day-a.day).map(x=>eventFact(s,x));
  const request=r=>r?{...r,house_direction:localDirection(e.spatial[n],e.spatial[r.householdId]),quantity_words:words(r.quantity),unit:r.kind=="wood"?"log":r.kind=="harvest"?(r.quantity==1?"patch":"patches"):(r.quantity==1?"portion":"portions"),workplace_name:FUEL_TRADES[e.workplace?.[r.workplaceId]?.trade],
    target_first_name:personFact(s,r.targetId)?.first_name,target_village_name:s.villages?.[e.village?.[r.targetId]?.villageId]?.name}:null;
  const place=id=>{const v=placeFact(s,n,id);return v&&{...v,house_count_words:words(v.house_count)};};
  switch(d.source) {
  case "customs_chat": {
    const context=c.context;if(!context)return [];
    const i=s.customs?.incidents.find(i=>i.id==context.incidentId);
    return [{...context,rights:OATH_RIGHTS,result:context.result||"Very well.",...(i?warningConsequences(s,i):{})}];
  }
  case "maternal_recognised":return c.familyRecognition?[c.familyRecognition]:[];
  case "maternal_introduction":return [maternalIntroduction(s,p,n)].filter(Boolean);
  case "maternal_search":return familySearchFacts(s,p,n);
  case "maternal_search_question":return c.familySearch?[c.familySearch]:[];
  case "npc_activity_at_approach":return [c.activity];
  case "npc_current_profession":case "player_known_trade_of_npc": {const j=e.profession?.[n],w=e.workplace?.[e.household?.[e.household?.[n]?.houseId]?.workplaceId];return j?[{...j,trade:j.trade,workplace_name:trades[j.trade],since_when:w?.builtDay!=null?relativeDate(s,{day:w.builtDay}):undefined}]:[];}
  case "npc_household_field":return (e.household?.[e.household?.[n]?.houseId]?.fields||[]).map(id=>({id,...e.farmable[id],ripe_words:words(e.farmable[id].slots.filter(x=>x.state=="harvestable").length),ploughable_words:words(e.farmable[id].slots.filter(x=>["empty","harvested","rotten"].includes(x.state)).length)}));
  case "npc_household":return [homeFact(s,e.household?.[n]?.houseId)].filter(Boolean);
  case "player_home":return Object.keys(e.camp||{}).concat(Object.keys(e.shelter||{}),Object.keys(e.building||{})).filter(id=>e.controllable?.[id]?.controllerId==p).map(id=>homeFact(s,id));
  case "npc_household_pasture":return Object.entries(e.pasture||{}).filter(([id,v])=>v.houseId==e.household?.[n]?.houseId||e.interior?.[id]?.buildingId==e.household?.[n]?.houseId).map(([id,v])=>({id,...v,animal_plural:v.kind}));
  case "player_observed_local_weather":return localWeather(s)?[{id:Math.floor(s.days*24),weather_type:localWeather(s).type,season:season(s.days)}]:[];
  case "npc_village": {const v=s.villages?.[e.village?.[n]?.villageId];return v?[{...v,id:e.village[n].villageId,house_count_words:words(v.houses?.length||0),trade_list:[...new Set((v.houses||[]).map(h=>e.household[h]?.trade).filter(Boolean))].map(t=>"a "+t).join(" and ")}]:[];}
  case "village_elder":return [personFact(s,villageElder(s,ref(d.village)?.id))].filter(Boolean);
  case "npc_kin_link":return kinLinks(s,n);
  case "npc_undisclosed_kin_link":return kinLinks(s,n).filter(l=>!linkKnown(s,p,l));
  case "player_known_kin_link_of_npc":return kinLinks(s,n).filter(l=>linkKnown(s,p,l));
  case "link_relative":return [personFact(s,ref(d.link)?.relative_id)].filter(Boolean);
  case "spouse_of":return [personFact(s,e.kinship?.[person(d.person)]?.spouse)].filter(Boolean);
  case "player_child":return (e.kinship?.[p]?.children||[]).filter(id=>living(s,id)).map(id=>personFact(s,id));
  case "player_parent":return (e.kinship?.[p]?.parents||[]).filter(id=>living(s,id)).map(id=>personFact(s,id));
  case "death_event_of":return events("death",person(d.person));
  case "birth_event_of":return events("birth",person(d.person)).filter(x=>x.people[0]==person(d.person));
  case "marriage_event_of":return events("marriage",person(d.person));
  case "marriage_event_of_link":return events("marriage",n).filter(x=>x.people.includes(ref(d.link)?.relative_id));
  case "latest_move_event_of":return events("move",person(d.person)).slice(0,1);
  case "founding_event_with":return events("founding",person(d.person));
  case "village_founding_event":return events("founding").filter(x=>x.villageId==ref(d.village)?.id);
  case "current_subject_known_to_player":return knows(s,p,c.subjectId)?[personFact(s,c.subjectId)].filter(Boolean):[];
  case "npc_bond_with_subject": {const bond=e.relationships[n]?.known[c.subjectId];return bond?[{...bond,dislikes:disposition(s,n,c.subjectId)=="hate"||bond.goodwill<0}]:[];}
  // Their own life lately: events they took part in, or a birth or death in
  // their close family, from the past seven days. Each is told once.
  case "npc_own_recent_event":return knownEvents(s,n).filter(x=>!x.sealed&&x.day>=s.days-7&&OWN_NEWS.includes(x.type)&&
    (x.type=="death"?closeFamily(s,n).includes(x.people[0]):x.type=="birth"?x.people.slice(1).includes(n):x.type=="inheritance"?x.people[1]==n:x.people.includes(n)))
    .sort((a,b)=>b.day-a.day||a.id.localeCompare(b.id)).map(x=>eventFact(s,x));
  case "npc_known_unheard_event_for_question":return newsEvents(s,c).filter(x=>!d.eventType||x.type==d.eventType).map(x=>eventFact(s,x));
  case "npc_known_relevant_unheard_visit":return newsEvents(s,c,true).filter(x=>!d.eventType||x.type==d.eventType).map(x=>eventFact(s,x));
  case "player_known_permitted_event":return knownEvents(s,p).filter(x=>(!d.eventType||x.type==d.eventType)&&canDiscloseEvent(s,p,n,x)&&(!c.subjectId||x.people.includes(c.subjectId))).sort((a,b)=>b.day-a.day).map(x=>eventFact(s,x));
  case "event_just_told_by_player":return [eventFact(s,eventById(s,c.toldEventId))].filter(Boolean);
  case "event_person":return [personFact(s,ref(d.event)?.people[d.index])].filter(Boolean);
  case "event_other_participant":return (ref(d.event)?.people||[]).filter(id=>id!=person(d.person)).map(id=>personFact(s,id));
  case "event_participant_who_is_close_kin_of":return (ref(d.event)?.people||[]).filter(id=>closeFamily(s,person(d.person)).includes(id)).map(id=>personFact(s,id));
  case "live_request_for_npc_household":return requests(s,n).filter(r=>r.status=="offered"&&!reasonGone(s,r)).map(request);
  case "npc_known_live_request_elsewhere":return elsewhereRequests(s,c).map(request);
  case "local_lands": {const lands=landsFact(s,n);return [{...lands,open_count_words:words(lands.open_count)}];}
  case "npc_local_other_village_unknown_to_player":return Object.keys(s.villages||{}).filter(id=>id!=e.village?.[n]?.villageId&&!s.knowledge?.[p]?.villages?.includes(id)).map(place).filter(Boolean);
  case "player_known_other_village":return [...knownPlaces(s,p)].filter(id=>id!=e.village?.[n]?.villageId).map(place).filter(Boolean);
  case "place_asked_by_player":return [place(c.subjectPlaceId)].filter(Boolean);
  case "npc_own_world_trip":return ownTrips(s,n).map(x=>eventFact(s,x));
  case "npc_own_world_trip_to_reach":return ownTrips(s,n).filter(x=>x.fromWorld==ref(d.reach)||x.toWorld==ref(d.reach)).map(x=>eventFact(s,x));
  case "npc_known_world_travel_by_other":return tellableTravel(s,c).filter(x=>!heard(s,p,x)).map(x=>eventFact(s,x));
  case "player_heard_live_offer_from_npc":return requests(s,n).filter(r=>r.status=="offered"&&s.knowledge?.[p]?.offers?.[r.id]?.speakerId==n).map(request);
  case "player_accepted_request_for_npc_household":return requests(s,n).filter(r=>r.status=="accepted"&&r.actorId==p).map(request);
  case "player_accepted_request_elsewhere":return Object.values(s.favours?.requests||{}).filter(r=>r.actorId==p&&r.status=="accepted"&&r.householdId!=e.household?.[n]?.houseId).map(request);
  case "request_giver":return [personFact(s,ref(d.request)?.giverId)].filter(Boolean);
  case "pending_favour_result":return c.result?[c.result]:[];
  case "result_request":return [request(s.favours?.requests[ref(d.result)?.requestId])].filter(Boolean);
  case "request_just_declined":return [request(s.favours?.requests[c.declinedId])].filter(Boolean);
  case "player_noticed_need_from_npc":return Object.values(s.knowledge?.[p]?.noticedNeeds||{}).filter(x=>x.speakerId==n);
  case "player_construction_site":return Object.entries(e.construction||{}).filter(([id])=>e.controllable?.[id]?.controllerId==p).map(([id,x])=>({id,...x}));
  case "player_queued_order":return (e.manager?.[p]?.jobs||[]).filter(x=>!d.jobKey||x.job.key==d.jobKey).map(x=>({...x,job_key:x.job.key}));
  case "player_field":return Object.entries(e.farmable||{}).filter(([id])=>e.controllable?.[id]?.controllerId==p).map(([id,x])=>({id,...x,sown_count:x.slots.filter(t=>t.state=="sown").length,ripe_count:x.slots.filter(t=>t.state=="harvestable").length}));
  case "completed_favour_event_player_helped_npc":return events("favour",p).filter(x=>x.people[1]==n);
  case "commons_warning_event_npc_gave_player":return events("commons_warning",p).filter(x=>x.people[0]==n);
  case "player_house_built_event":return knownEvents(s,p).filter(x=>x.type=="house_built"&&x.people[0]==p).map(x=>eventFact(s,x));
  default:return [];
  }
}
export function predicate(s,c,b,{test,args:a={}}) {
  const shared=condition(s,{...b,actor:b.player,partner:b.npc,teller:b.npc,listener:b.player,subject:c.subjectId},{test,args:a});
  if(shared!==undefined)return shared;
  const e=s.ecs, get=x=>typeof x=="string"?x.split(".").reduce((v,k)=>v?.[k],b):x;
  const id=x=>get(x)?.id, person=id(a.person), viewer=id(a.viewer), event=get(a.event), link=get(a.link), home=get(a.household), request=get(a.request);
  const k=p=>e.kinship?.[p]||{parents:[],children:[]}, alive=p=>living(s,p), count=p=>k(p).children.filter(alive).length;
  const reqs=requests(s,c.npcId), active=reqs.filter(r=>r.status=="offered"&&!reasonGone(s,r));
  const weather=()=>localWeather(s)?.type;
  const kin=p=>kinLinks(s,p), field=get(a.field), states=field?.slots||[];
  const value=x=>get(x)??x;
  const identity=x=>get(x)?.id??get(x)??x;
  const otherVillages=()=>Object.keys(s.villages||{}).filter(id=>id!=identity(a.village));
  const lands=()=>landsFact(s,c.npcId),told=f=>landsTold(s,viewer||c.actorId,id(a.speaker)||c.npcId,f);
  const tripTold=e=>!!s.chat?.pairs?.[c.actorId+":"+c.npcId]?.used?.[`lands_trip:${c.npcId}:${c.actorId}:${e.id}`];
  switch(test) {
  case "family_search_answer":return b.relative?.answer==a.value;
  case "festival_active":return !!s.ecs.planner?.[c.npcId]?.world.festivalPlace;
  case "mood_in_row":return c.row.some(i=>i.kind=="mood"&&i.key==a.key);
  case "phase_is":return c.phase==a.phase;
  case "customs_chat_kind_is":return c.context?.kind==a.value;
  case "customs_eligible":return !c.context?.kind&&!customsIntentUnavailable(s,c.actorId,c.npcId,a.kind)&&
    (a.kind=="leave"?!!membership(s,c.actorId,e.village[c.npcId]?.villageId):!membership(s,c.actorId,e.village[c.npcId]?.villageId));
  case "answer_expected_is":return c.expectation==a.value;
  case "closing_reply_is":return c.closingReply==a.value;
  case "question_is":return c.question?.family==a.family&&c.question?.situation==a.situation;
  case "relative_known_dead":return knownEvents(s,viewer).some(e=>e.type=="death"&&e.people[0]==person);
  case "has_no_children":return !k(person).children.length;
  case "npc_first_encounter":return !c.knewBefore;
  case "npc_knew_player_before_chat":return c.knewBefore;
  case "completed_contact_exists":return !!s.knowledge?.[id(a.actor)]?.people?.[person]?.conversation;
  case "no_completed_contact_before_this_line":return !s.knowledge?.[id(a.actor)]?.people?.[person]?.conversation;
  case "profession_is":return e.profession?.[person]?.trade==a.trade;
  case "has_profession":return !!e.profession?.[person]?.trade;
  case "activity_snapshot_is":return c.activity.key==a.activity && (!a.place_kind || c.activity.place_name==a.place_kind);
  case "activity_snapshot_was_work":return ["trade_work","plough","sow","harvest","tend_field","garden","fell","forage","helping_friend","carry_home","collect_wood"].includes(c.activity.key);
  case "activity_holds_good":return c.activity.held?.some(type=>a.goods.includes(type));
  case "free_cells_at_least": {const p=patience(s,c.actorId,c.npcId);return p.max-p.resting-c.row.length>=a.count;}
  case "weather_is":return weather()==a.type;
  case "weather_in":return a.types.includes(weather());
  case "snow_lying_at": {const at=e.spatial?.[person],tile=at&&(s.space?.[Hex().fromPoint(at)]||[]).find(id=>e.walkable[id]);return tile&&(s.snow?.[tile]||0)>=a.min_depth;}
  case "time_of_day_in":return a.values.includes(time(s.days));
  case "season_is":return season(s.days)==a.season;
  case "season_part_is":return seasonPart(s.days)==a.part;
  case "season_part_in":return a.parts.includes(seasonPart(s.days));
  case "ground_frozen_at":return frozenAt(climateTile(s,person),s.days);
  case "crops_growing_at":return !!field&&growingAt(s,field.id);
  case "crops_not_growing_at":return !!field&&!growingAt(s,field.id);
  case "crops_not_growing_here":return !growingAt(s,c.npcId);
  case "knows_identity":case "knows_person":return knows(s,viewer,person);
  case "does_not_know_identity":case "does_not_know_person":return !knows(s,viewer,person);
  case "arrived_within_days":return e.playable?.[person]?.arrivedAt!=null&&s.days-e.playable[person].arrivedAt<=a.days;
  case "home_stage_is":return sourceValues(s,c,b,{source:"player_home"}).some(h=>h.stage==a.stage);
  case "chat_mode_is":return c.mode==a.mode;
  case "player_knows_trade":return !!s.knowledge?.[c.actorId]?.people?.[person]?.trade;
  case "field_has_state":return states.filter(x=>x.state==a.state).length>=a.min;
  case "field_all_states_in":return states.length>0&&states.every(x=>a.states.includes(x.state));
  case "household_has_no_field":return !!home&&!(e.household?.[home.id]?.fields||[]).length;
  case "household_has_field":return !!e.household?.[identity(a.household)]?.fields?.length;
  case "household_has_live_request":case "household_has_no_live_request": {const has=Object.values(s.favours?.requests||{}).some(r=>r.householdId==identity(a.household)&&r.status=="offered"&&!reasonGone(s,r));return test=="household_has_live_request"?has:!has;}
  case "household_store_full": {const st=e.container?.[householdStore(s,home?.id)];return !!st&&Object.values(st.amounts).reduce((a,b)=>a+b,0)>=st.capacity;}
  case "household_food_per_resident_at_least":return !!home&&(householdFood(s).get(home.id)||0)>=residents(s,home.id).length*a.value;
  case "household_food_per_resident_below":return !!home&&(householdFood(s).get(home.id)||0)<residents(s,home.id).length*a.value;
  case "household_has_pasture":return sourceValues(s,c,b,{source:"npc_household_pasture"}).length>0;
  case "player_construction_in_progress":return sourceValues(s,c,b,{source:"player_construction_site"}).length>0;
  case "player_has_queued_order":return (e.manager?.[c.actorId]?.jobs||[]).some(j=>j.job.key==a.key);
  case "player_queue_empty":return !(e.manager?.[id(a.actor)]?.jobs||[]).some(j=>j.job.key!="chat");
  case "player_field_has_state":return (b.pfield?[b.pfield]:sourceValues(s,c,b,{source:"player_field"})).some(f=>f.slots.filter(x=>x.state==a.state).length>=a.min);
  case "knows_village_name":return !!s.knowledge?.[viewer]?.villages?.includes(value(a.village)) || !!s.knowledge?.[viewer]?.people?.[c.npcId]?.conversation;
  case "not_resident_of_village":return e.village?.[person]?.villageId!=value(a.village);
  case "not_member_of":return !membership(s,person,value(a.village));
  case "village_has_place":return (get(a.village)?.sharedPlaces||[]).some(id=>e.meetingPlace?.[id]?.kind==a.kind);
  case "village_house_count_at_most":return (get(a.village)?.houses?.length||0)<=a.count;
  case "village_trade_count_at_least":return new Set((get(a.village)?.houses||[]).map(h=>e.household[h]?.trade).filter(Boolean)).size>=a.count;
  case "village_has_elder":return !!villageElder(s,id(a.village));
  case "village_has_common_woodland":return Object.keys(e.tree||{}).some(tree=>{const permission=resourcePermission(s,c.actorId,tree);return permission.kind=="common" && permission.villageId==id(a.village);});
  case "kin_link_known_to":return linkKnown(s,viewer,link);
  case "kinship_is":return link?.kinship==a.kind;
  case "kinship_not_in":return !!link&&!a.kinds.includes(link.kinship);
  case "different_village":return !!get(a.a)?.village&&!!get(a.b)?.village&&get(a.a).village!=get(a.b).village;
  case "same_village":return !!get(a.a)?.village&&get(a.a).village==get(a.b)?.village;
  case "is_youngest_living_child":return k(id(a.parent)).children.filter(alive).sort((a,b)=>e.personable[a].age-e.personable[b].age||a.localeCompare(b))[0]==id(a.child);
  case "has_no_living_kin":return !kin(person).some(l=>alive(l.relative_id));
  case "had_kin":return kin(person).length>0;
  case "living_kin_count_at_most":return kin(person).filter(l=>alive(l.relative_id)).length<=a.count;
  case "no_undisclosed_kin_links":return !kin(id(a.speaker)).some(l=>!linkKnown(s,viewer,l));
  case "household_size_is":return residents(s,home?.id).length==a.size;
  case "household_at_capacity": {const rooms=e.building?.[home?.id]?.rooms||[home?.id];const cap=rooms.reduce((n,r)=>n+(e.sleepable?.[r]?.capacity||0),0);return cap>0&&residents(s,home?.id).length>=cap;}
  case "living_child_count_at_least":return count(person)>=a.count;
  case "has_living_parent":return k(person).parents.some(alive);
  case "no_move_events":return !(s.events||[]).some(x=>["move","world_move"].includes(x.type)&&x.people.includes(person));
  case "no_residence_record":return !e.household?.[person]?.houseId;
  case "subject_is_set":return !!c.subjectId;
  case "bond_ring_is":return get(a.bond)?.ring==a.ring;
  case "bond_goodwill_at_least":return get(a.bond)?.goodwill>=a.value;
  case "bond_dislikes":return !!get(a.bond)?.dislikes;
  case "event_type_is":return event?.type==a.type;
  case "event_type_in":return !!event&&a.types.includes(event.type);
  case "event_detail_is":return !!event&&event[a.field]==value(a.value);
  case "event_participant_is":return event?.people?.[a.index]==person;
  case "event_participant":return !!event?.people.includes(person);
  case "not_event_participant":return !!event&&!event.people.includes(person);
  case "event_participant_in":return !!event&&a.indices.some(i=>event.people[i]==person);
  case "event_known_to":return heard(s,person,event);
  case "event_unknown_to":return !!event&&!heard(s,person,event);
  case "can_disclose_event":return !!event&&canDiscloseEvent(s,id(a.speaker),viewer,event);
  case "event_village_is":return event?.villageId==value(a.village);
  case "event_villages_differ":return !!event?.fromVillage&&!!event.toVillage&&event.fromVillage!=event.toVillage;
  case "event_villages_same":return !!event?.fromVillage&&event.fromVillage==event.toVillage;
  case "same_day":return get(a.a)?.day==get(a.b)?.day;
  case "no_later_quarrel":return !!event&&!(s.events||[]).some(x=>x.type=="quarrel"&&x.day>event.day&&event.people.every(p=>x.people.includes(p)));
  case "event_items_are_houses":return !!event?.items.length&&event.items.every(id=>e.building?.[id]||e.shelter?.[id]);
  case "event_items_are_possessions":return !!event?.items.length&&event.items.every(id=>e.possession?.[id]);
  case "item_carried_by":return !!event?.items.some(id=>e.haulable?.[id]?.heldBy==person||e.possession?.[id]?.ownerId==person&&e.possession[id].carried);
  case "question_is_village":return !c.subjectId;
  case "no_permitted_unheard_event_about":return !newsEvents(s,{...c,subjectId:id(a.subject)}).length;
  case "no_unheard_event_about":return !knownEvents(s,id(a.speaker),id(a.subject)).some(x=>!heard(s,viewer,x));
  case "no_permitted_unheard_event_in_village":return !newsEvents(s,{...c,subjectId:null}).length;
  case "player_heard_event_spoken":return !!s.knowledge?.[c.actorId]?.spokenSources?.[event?.id];
  case "npc_knew_event_before_line":return c.npcKnewEvent==a.value;
  case "visit_is_relevant_to_player":return relevantVisit(s,id(a.speaker),c.actorId,event);
  case "is_current_elder":return notable(s,person)&&villageElder(s,e.village?.[person]?.villageId)==person;
  case "is_household_head":return !!e.household?.[person]?.houseId&&e.controllable?.[e.household[person].houseId]?.controllerId==person;
  case "no_relevant_unheard_visit":return !newsEvents(s,c,true).length;
  case "no_visit_events_known_this_season":return !knownEvents(s,id(a.speaker)).some(x=>VISITS.includes(x.type)&&x.season==Math.floor(s.days/DAYS_IN_SEASON));
  case "request_status_is":return request?.status==a.status;
  case "request_accepted_by":return request?.actorId==id(a.actor);
  case "request_kind_is":return request?.kind==a.kind;
  case "request_household_is_npc_household":return request?.householdId==e.household?.[c.npcId]?.houseId;
  case "request_reason_still_holds":return !!request&&!reasonGone(s,request);
  case "resident_of_request_household":return !!request&&e.household?.[person]?.houseId==request.householdId;
  case "within_encounter_distance": {const p=e.spatial[id(a.a)],q=e.spatial[id(a.b)];return !!p&&!!q&&Math.hypot(p.x-q.x,p.y-q.y)<=a.units;}
  case "on_explored_ground":return nearbyRequester(s,person);
  case "request_workplace_trade_is":return e.workplace?.[request?.workplaceId]?.trade==a.trade;
  case "household_offered_request_count_at_least":return active.length>=a.count;
  case "player_noticed_need":return Object.values(s.knowledge?.[c.actorId]?.noticedNeeds||{}).some(x=>x.speakerId==id(a.speaker)&&x.kind==a.kind);
  case "can_request_for_household":return !!request&&canRequestForHousehold(s,request,person);
  case "player_declined_offer_without_reoffer":return !!s.knowledge?.[c.actorId]?.declinedOffers?.[request?.id]&&!c.tags.includes("offered_help");
  case "request_covers_whole_need":return request?.kind=="harvest"?request.quantity>=(e.farmable?.[request.targetId]?.slots||[]).filter(x=>x.state=="harvestable").length:request?.kind=="wood";
  case "no_live_request_for_household":return !reqs.some(r=>["offered","accepted"].includes(r.status)&&!reasonGone(s,r));
  case "npc_knows_of_request":return !!request&&knownOpenRequests(s,id(a.speaker)).some(r=>r.id==request.id);
  case "no_known_live_request_elsewhere":return !elsewhereRequests(s,c).length;
  case "request_household_is_player_household":return !!request&&request.householdId==e.household?.[c.actorId]?.houseId;
  case "different_village_id":return identity(a.a)!=identity(a.b);
  case "no_other_local_village":return !otherVillages().length;
  case "other_local_village_exists":return !!otherVillages().length;
  case "other_local_villages_all_known_to":return otherVillages().every(id=>s.knowledge?.[viewer]?.villages?.includes(id));
  case "player_discovered_village":return discoveredVillage(s,viewer,identity(a.village));
  case "village_on_current_map":case "village_not_on_current_map": {const local=!!s.villages?.[identity(a.village)];return test=="village_on_current_map"?local:!local;}
  case "village_smaller_than": {const count=x=>s.villages?.[identity(x)]?.houses?.length??get(x)?.house_count;return count(a.a)!=null&&count(a.b)!=null&&count(a.a)<count(a.b);}
  case "npc_visited_village":return visitedVillage(s,person,identity(a.village));
  case "npc_not_visited_village":return !visitedVillage(s,person,identity(a.village));
  case "npc_has_world_trip":return !!ownTrips(s,person).length;
  case "npc_has_no_world_trip":return !ownTrips(s,person).length;
  case "npc_no_world_trip_to_reach":return !ownTrips(s,person).some(e=>e.fromWorld==value(a.reach)||e.toWorld==value(a.reach));
  case "npc_own_world_trips_all_told":return ownTrips(s,id(a.speaker)).every(tripTold);
  case "npc_knows_no_world_travel":return !knownEvents(s,id(a.speaker)).some(e=>["world_visit","world_move","return"].includes(e.type)&&e.fromWorld&&e.toWorld);
  case "npc_knows_no_tellable_world_travel":return !tellableTravel(s,c).some(e=>!heard(s,viewer,e));
  case "lands_beyond_all_told":return !!(ownTrips(s,c.npcId).length||tellableTravel(s,c).length)&&ownTrips(s,c.npcId).every(tripTold)&&tellableTravel(s,c).every(e=>heard(s,c.actorId,e));
  case "lands_fact_told":return told(a.fact);
  case "lands_country_all_told": {const l=lands();return told("country_here")&&(!l.mountain_direction||told("mountains"))&&(!l.water_direction||told("water"))&&(l.tree_count<20||told("woods"));}
  case "lands_roads_all_told": {const l=lands();return told("ways_out")&&(!l.sea_count||told("sea"))&&(!l.closed_land_count||told("no_road_side"));}
  case "local_terrain_present":return a.terrain.some(t=>lands().terrain.includes(t));
  case "local_tree_count_at_least":return lands().tree_count>=a.count;
  case "map_open_side_count_is":return lands().open_count==a.count;
  case "map_open_side_count_at_least":return lands().open_count>=a.count;
  case "map_sea_side_count_at_least":return lands().sea_count>=a.count;
  case "map_closed_side_count_at_least":return lands().closed_count>=a.count;
  case "map_closed_land_side_count_at_least":return lands().closed_land_count>=a.count;
  case "reach_temperature_is":return lands().temperature==a.value;
  case "reach_moisture_is":return lands().moisture==a.value;
  case "request_heard_from":return !!request&&s.knowledge?.[c.actorId]?.offers?.[request.id]?.speakerId==person;
  case "player_has_favour_supply":return !!request&&!!favourSource(s,request);
  case "player_queue_length_at_least":return (e.manager?.[c.actorId]?.jobs||[]).length>=a.count;
  case "result_is":return get(a.result)?.value==a.value;
  case "result_reason_in":return a.reasons.includes(get(a.result)?.reason);
  case "favour_waiting_for_supply":return !!request&&request.kind!="harvest"&&!favourSource(s,request);
  case "chat_end_reason_is":return c.endReason==a.reason;
  default:return undefined;
  }
}
