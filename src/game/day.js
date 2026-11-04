import { Hex } from "game/hex";
import { createSimulation } from "game/simulation";
import { enqueueTask, canReachTask, chatUnavailable, cancelTask } from "game/manager";
import { giftOptions } from "game/people";
import { FOODS } from "game/goods";
import { forageAvailable } from "game/ecology";
import { knownEvents } from "game/events";
import { chatChoices, chooseLine, closeChat, previewLine, patience } from "game/chat";
import { visibleFavours, acceptFavour } from "game/favours";
import { finishSeasonTurn } from "game/seasons";
import { peaceUnavailable, introduceUnavailable, makePeace, introduce } from "game/social_interventions";

// Boundaries are game time. The arrival morning starts at nine; later mornings
// start at six. Evening company ends at nine, followed by the real night's rest.
export function currentSlot(s) {
  const day = Math.floor(s.days + 1e-9), hour = (s.days-day+1e-9)*24;
  const slot = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return { day:day+1, slot, endsAt: slot=="morning" ? day+.5 : slot=="afternoon" ? day+.75 : day+1.25 };
}
const at = (s,p) => p && (s.space[Hex().fromPoint(p)] || []).find(id=>s.ecs.walkable?.[id]);
const samePair = (people,a,b) => people.length==2 && people.includes(a) && people.includes(b);
const requests = (s,id) => visibleFavours(s,id).filter(r=>["offered","accepted"].includes(r.status) &&
  (r.status=="accepted" || s.knowledge?.[s.ui.playerId]?.offers?.[r.id]?.speakerId==id));
// Wild food the player has found, nearest the chosen place first. A morning's
// gathering visits several plants, as the arrival orders already allow.
function plantsNear(s,placeId,known) {
  const at=s.ecs.spatial[placeId];
  return Object.keys(s.ecs.forageable || {}).filter(id=>forageAvailable(s,s.ecs.forageable[id]) && known.has(Hex().fromPoint(s.ecs.spatial[id]).toString()))
    .map(id=>({id,d:Math.hypot(s.ecs.spatial[id].x-at.x,s.ecs.spatial[id].y-at.y)})).filter(p=>p.d<400).sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)).map(p=>p.id);
}
const availableReason = activity => ({forage:"Gather wild food nearby",talk:"They can stop and talk",give_food:"You have food to offer",ask_favour:"Ask about help in conversation",work:"They asked for help with this work",make_peace:"They trust you and you heard both sides",introduce:"They trust you and can meet"})[activity];

export function slotChoices(s) {
  const e=s.ecs, actor=s.ui.playerId, clock=currentSlot(s);
  const known=new Set((e.playable?.[actor]?.known || []).map(h=>Hex(h).toString()));
  const places=Object.keys(e.walkable || {}).filter(id=>known.has(Hex().fromPoint(e.spatial[id]).toString())).map(id=>({
    id, name:e.nameable?.[id]?.nickname || (s.space[Hex().fromPoint(e.spatial[id])] || []).map(x=>e.nameable?.[x]?.nickname).find(Boolean) || e.mappable?.[id]?.terrain || "Open ground", people:[]
  }));
  const byId=new Map(places.map(p=>[p.id,p])), choices=[];
  for(const place of places) {
    const reachable=canReachTask(s,actor,place.id);
    const c={id:[clock.day,clock.slot,place.id,"visit"].join("/"),placeId:place.id,personId:null,activity:"visit",available:reachable,
      reason:reachable?"Spend this part of the day here and see who you meet":"There is no path there"};
    place.visit=c;choices.push(c);
    const plants=plantsNear(s,place.id,known);
    if(plants.length)choices.push({id:[clock.day,clock.slot,place.id,"forage"].join("/"),placeId:place.id,personId:null,activity:"forage",
      available:reachable,reason:reachable?availableReason("forage"):"There is no path there",plants:plants.slice(0,4)});
  }
  const add=(place,person,activity,reason,extra={})=>{
    const c={id:[clock.day,clock.slot,place.id,person.id,activity,extra.otherId||extra.requestId||""].join("/"),placeId:place.id,personId:person.id,activity,
      available:!reason,reason:reason||availableReason(activity),...extra};
    person.activities.push(c);choices.push(c);
  };
  const people=[];
  for (const [id,p] of Object.entries(e.planner || {})) {
    if(id==actor || e.personable?.[id]?.dead || !e.personable?.[id])continue;
    const here=at(s,e.interior?.[id] ? e.spatial[e.interior[id].buildingId] : e.spatial[id]);
    const destination=p.task?.[0]=="walk_to" ? p.world.places?.[p.task[1]] || e.spatial[p.task[1]] || (typeof p.task[1]=="object" ? p.task[1] : null) : null;
    const due=at(s,destination);
    for (const placeId of new Set([here,due].filter(id=>byId.has(id)))) {
      const place=byId.get(placeId),person={id,due:placeId!=here,activities:[]};
      place.people.push(person);people.push({place,person});
      const route=canReachTask(s,actor,id)?null:"There is no path to them";
      const talk=route || chatUnavailable(s,actor,id) || (patience(s,actor,id).free < patience(s,actor,id).minimum ? "They need time before another conversation" : null);
      add(place,person,"talk",talk);
      add(place,person,"ask_favour",talk);
      const gifts=giftOptions(s,actor).filter(g=>FOODS.includes(g.type));
      const gift=gifts.find(g=>e.haulable?.[g.sourceId]?.heldBy==actor || canReachTask(s,actor,g.sourceId));
      const need=e.planner[id].world.feeling;
      add(place,person,"give_food",route || (!gift ? "You have no food that you can give" : need.hungry || need.tired ? "They must finish their meal or rest before taking a gift" : null),{gift});
      const work=requests(s,id).find(r=>r.kind!="food");
      add(place,person,"work",route || (!work ? "Ask them about help first. There is no offered work you can take" : null),{requestId:work?.id});
    }
  }
  // These are deliberate pair choices. Hidden people and unheard quarrels do
  // not become visible just because their records exist in the simulation.
  const ids=[...new Set(people.map(x=>x.person.id))],quarrels=knownEvents(s,actor).filter(e=>e.type=="quarrel");
  for(const {place,person} of people)for(const other of ids)if(person.id<other) {
    if(quarrels.some(e=>samePair(e.people,person.id,other)))add(place,person,"make_peace",peaceUnavailable(s,actor,person.id,other),{otherId:other});
    // Only known single adult prospects enter the list. The real eligibility
    // and consent checks still supply the reason if an introduction is blocked.
    if(e.personable[person.id].age>=16 && e.personable[other].age>=16 &&
      (!e.kinship?.[person.id]?.spouse || !e.personable[e.kinship[person.id].spouse] || e.personable[e.kinship[person.id].spouse].dead) &&
      (!e.kinship?.[other]?.spouse || !e.personable[e.kinship[other].spouse] || e.personable[e.kinship[other].spouse].dead))
      add(place,person,"introduce",introduceUnavailable(s,actor,person.id,other),{otherId:other});
  }
  return {...clock,places,choices};
}

// Use visible matches and learned tastes. No hidden personality scores enter
// the default player's decision. A hook can inspect the same authored choices.
export function sensibleLine(s, lines) {
  const c=s.chat.active, actor=c.actorId;
  const score=l=>{
    const matching=new Set(previewLine(s,l).matchingKeys);
    const learned=s.knowledge?.[actor]?.people?.[c.npcId];
    const known=l.icons.filter(i=>matching.has(i.kind+":"+(i.key||i.personId))).map(i=>
      i.kind=="topic"?learned?.topicTastes?.[i.key]:i.kind=="mood"?learned?.moodTastes?.[i.key]:learned?.personReactions?.[i.personId]?.score);
    return (l.answers?.includes(c.expectation)?100:0)+(l.family=="introduction"?20:0)+previewLine(s,l).matches*3+known.reduce((n,v)=>n+(v||0),0)-(l.risk?50:0)-(l.evasive?10:0);
  };
  return lines.filter(l=>!c.usedIds.includes(l.id) && previewLine(s,l).fits).sort((a,b)=>score(b)-score(a))[0]?.key;
}
function factsChanged(before,after,path="") {
  return Object.entries(after || {}).flatMap(([key,value])=>{
    const name=path?path+"."+key:key;
    if(value && typeof value=="object" && !Array.isArray(value))return factsChanged(before?.[key],value,name);
    return JSON.stringify(before?.[key])==JSON.stringify(value)?[]:[{fact:name,value}];
  });
}

export async function playSlot(s, requested, hooks={}) {
  const menu=slotChoices(s),choice=menu.choices.find(c=>c.id==(typeof requested=="string"?requested:requested?.id));
  if(!choice)throw new Error("This choice is not in the current slot");
  if(!choice.available)throw new Error(choice.reason);
  const actor=s.ui.playerId,start=s.days,prior=new Set(knownEvents(s,actor).map(e=>e.id));
  const knowledge=structuredClone(s.knowledge?.[actor] || {});
  const regards=()=>Object.fromEntries(Object.keys(s.ecs.personable).map(id=>[id,{ring:s.ecs.relationships?.[id]?.known[actor]?.ring || "public",goodwill:s.ecs.relationships?.[id]?.known[actor]?.goodwill || 0}]));
  const before=regards(),orders=[],outcomes=[],conversations=[];
  const order=(key,target,extra)=>{const j=enqueueTask(s,{key},target,extra);if(j)orders.push(j);return j;};
  let bringing=null;
  if(choice.activity=="visit")order("move_to_here",choice.placeId);
  if(choice.activity=="forage")for(const id of choice.plants)order("forage",id);
  if(["talk","ask_favour"].includes(choice.activity))order("chat",choice.personId);
  if(choice.activity=="give_food")order("give_gift",choice.personId,{gift:choice.gift});
  if(choice.activity=="work") {
    const r=s.favours.requests[choice.requestId];
    const j=r.status=="accepted" ? s.ecs.manager[actor].jobs.find(j=>j.favourId==r.id) : acceptFavour(s,r.id,choice.personId);
    if(j && !orders.includes(j))orders.push(j);
  }
  if(["make_peace","introduce"].includes(choice.activity))bringing=order("move_to_here",choice.placeId);
  const sim=createSimulation(s,{onError:error=>{throw error;}});
  const handleChat=async()=>{
    const c=s.chat?.active;if(!c)return;
    // Help is a normal subject in the paused conversation, rather than a
    // synthetic request or a reward for opening the panel.
    if(choice.activity=="ask_favour" && c.npcId==choice.personId)c.focus="help";
    while(s.chat?.active && !c.endReason) {
      const lines=chatChoices(s);if(!lines.length)break;
      const selected=hooks.chooseLine ? await hooks.chooseLine(s,lines,choice) : sensibleLine(s,lines);
      if(selected==null)break;
      if(!chooseLine(s,typeof selected=="string"?selected:selected.key))throw new Error("chooseLine must select an offered conversation line");
    }
    conversations.push({personId:c.npcId,completed:!!c.completed,lines:structuredClone(c.transcript)});
    if(closeChat(s)===false)throw new Error("The conversation needs an answer before it can close");
  };
  const advance=async until=>{
    while(s.days < until-1e-9) {
      await handleChat();
      if(s.seasonTurn) {outcomes.push({kind:"season",season:s.seasonTurn.season,lines:s.seasonTurn.lines});finishSeasonTurn(s);}
      if(s.travelError)throw new Error(s.travelError);
      if(s.ecs.personable[actor]?.dead) {outcomes.push({kind:"death",personId:actor});break;}
      s.game_speed="normal";
      if(bringing && bringing.progress>=1) {
        const reason=choice.activity=="make_peace" ? makePeace(s,actor,choice.personId,choice.otherId) : introduce(s,actor,choice.personId,choice.otherId);
        outcomes.push({kind:choice.activity,requested:!reason,reason});bringing=null;
      }
      sim.tick();if(sim.pending)await sim.pending;
      s.redraws.length=0;
    }
    await handleChat();
    if(s.seasonTurn) {outcomes.push({kind:"season",season:s.seasonTurn.season,lines:s.seasonTurn.lines});finishSeasonTurn(s);}
  };
  if(menu.slot=="evening") {
    await advance(Math.floor(start)+21/24);
    // Let unfinished real work remain unfinished, and release its real claims.
    for(const j of [...s.ecs.manager[actor].jobs])cancelTask(s,j.id);
    order("rest",actor);
  }
  await advance(menu.endsAt);
  for(const j of orders)if(j.progress<1)outcomes.push({kind:"unfinished",task:j.job.key,reason:j.waiting || j.detail || s.ui.talkResult?.message || "The slot ended before the task finished"});
  const after=regards();
  return {day:menu.day,slot:menu.slot,start,end:s.days,choice,events:knownEvents(s,actor).filter(e=>!prior.has(e.id)),
    facts:factsChanged(knowledge,s.knowledge?.[actor]),regard:Object.keys(after).filter(id=>JSON.stringify(before[id])!=JSON.stringify(after[id])).map(personId=>({personId,before:before[personId],after:after[personId]})),conversations,outcomes};
}
