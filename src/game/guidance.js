import { patience } from "game/chat_patience";
import { localDirection, worldDirection } from "game/chat_lands";
import { visibleFavours, reasonGone } from "game/favours";
import { STAGES, shelterLogSource, canPlaceShelter } from "game/construction";
import { topController } from "game/playable";
import { Hex } from "game/hex";
import { displayName } from "game/knowledge";

export const OPENING_NARRATIVE = "This is a strange land, but I feel like I was born to be here. First things first: win over the locals.";
// Per actor and per guidance key. Future family guidance can reuse this small
// dismissed/seen store without adding a quest engine or duplicating outcomes.
export function guidanceState(state, key = "opening") {
  state.guidance ||= {};
  state.guidance[state.ui.playerId] ||= {};
  return state.guidance[state.ui.playerId][key] ||= { seen: [], dismissed: false };
}
export function dismissGuidance(state, key = "opening") { guidanceState(state,key).dismissed = true; }
export function openingGuidance(state) {
  if(!state.intro || state.intro.active || state.ui.show?.main_menu) return null;
  const actorId=state.ui.playerId, ecs=state.ecs;
  if (!actorId || ecs.personable?.[actorId]?.dead) return null;
  if(state.chat?.active)return {actorId,key:"chat_open",text:state.chat.active.endReason?"Close the conversation when you have finished reading.":"Choose a reply in the conversation, or End chat."};
  const accepted=visibleFavours(state).find(r=>r.status=="accepted");
  const task=(ecs.manager?.[actorId]?.jobs||[])[0];
  const person=ecs.personable[actorId],jobs=ecs.manager?.[actorId]?.jobs||[];
  const deferred=(person.hunger>.9 && jobs.find(j=>j.waiting&&j.job.key=="find_food")) || jobs.find(j=>j.waiting&&j.job.key=="chat");
  if(deferred)return {actorId,key:"deferred",text:deferred.waiting};
  if(state.game_speed=="paused" && jobs.length) return {actorId,key:"resume",text:"Choose Normal speed to continue your tasks.",action:"Normal speed",speed:"normal"};
  if(person.hunger>.9) return jobs.some(j=>j.job.key=="find_food")?{actorId,key:"eating",text:"Keep the game running until your Find food task finishes."}:{actorId,key:"food",text:"Choose Find food to go for a meal before your next conversation.",action:"Find food",job:"find_food"};
  if(person.tiredness>.9 && (state.days%1*24>=20 || state.days%1*24<9)) return jobs.some(j=>j.job.key=="rest")?{actorId,key:"resting",text:"Keep the game running until your Rest task finishes."}:{actorId,key:"sleep",text:"Choose Rest to sleep before your next conversation.",action:"Rest",job:"rest"};
  if (state.renderer?.overview) return {actorId,key:"return",text:"Choose You to return to your character."};
  if (state.ui.familyPersonId) return {actorId,key:"family",text:"Close the family tree to return to your conversations."};
  if(task?.job.key=="chat") {
    if(task.waiting) return {actorId,key:"blocked_chat",text:"Cancel the Chat task marked ‘"+task.waiting+"’."};
    const feeling=ecs.planner?.[task.targetId]?.world.feeling;
    if(feeling?.hungry) return {actorId,key:"waiting_meal",text:"Keep the game running while your neighbour finishes a meal."};
    if(feeling?.tired) return {actorId,key:"waiting_rest",text:"Keep the game running while your neighbour finishes resting."};
    return {actorId,key:"approach",text:"Let your character walk over to start the conversation."};
  }
  const arrived=ecs.playable?.[actorId]?.arrivedAt;
  const firstDay=arrived!=null && state.days<Math.floor(arrived)+1+6/24;
  const contacts=Object.values(state.knowledge?.[actorId]?.people||{}).filter(p=>p.conversation).length;
  if(firstDay && contacts>=3 && (person.age??18)>=18) {
    const owned=id=>ecs.controllable?.[id] && topController(ecs,id)==actorId;
    const shelter=Object.keys(ecs.shelter||{}).find(owned);
    const site=Object.keys(ecs.construction||{}).find(owned);
    if(site) {
      const build=ecs.construction[site];
      if(build.delivered<STAGES[build.stage].logs && !shelterLogSource(state,actorId))
        return {actorId,key:"shelter_logs",text:"Select an unclaimed tree and choose Cut down for your shelter's logs."};
      if(!jobs.some(j=>j.job.key=="build_shelter" && j.targetId==site))
        return {actorId,key:"shelter",text:"Select your shelter site and choose Build shelter to finish it before night."};
      return {actorId,key:"building",text:"Keep the game running to finish your shelter before night."};
    }
    if(!shelter) {
      const at=ecs.spatial[actorId],known=new Set((ecs.playable?.[actorId]?.known||[]).map(h=>String(Hex(h))));
      const tile=Object.keys(ecs.mappable||{}).filter(id=>known.has(String(Hex().fromPoint(ecs.spatial[id])))&&ecs.mappable[id].terrain=="grassland")
        .sort((a,b)=>Math.hypot(ecs.spatial[a].x-at.x,ecs.spatial[a].y-at.y)-Math.hypot(ecs.spatial[b].x-at.x,ecs.spatial[b].y-at.y)).find(id=>canPlaceShelter(state,id));
      return tile?{actorId,key:"shelter",text:"Select Grassland #"+tile+" near camp and choose Build shelter before night.",action:"Show shelter tile",selectId:tile}:
        {actorId,key:"shelter",text:"Build shelter needs an available site on explored ground. Explore empty grass within three tiles of camp; select a tile to see its shelter requirements."};
    }
    return jobs.some(j=>j.job.key=="rest")?{actorId,key:"resting",text:"Keep the game running until your Rest task finishes."}:
      {actorId,key:"sleep",text:"Choose Rest to sleep in your shelter.",action:"Rest",job:"rest"};
  }
  if(accepted && !task?.waiting) return {actorId,key:"working",text:"Keep the game running to finish your favour delivery."};
  if(accepted && task?.waiting && accepted.kind!="harvest") return {actorId,key:"supply",text:accepted.kind=="wood" ? "Select an unclaimed tree and choose Cut down to supply your promised log." : "Select a forage plant and choose Forage to supply your promised food."};
  const lead=Object.values(state.knowledge?.[actorId]?.heardNeeds||{}).find(l=>{
    const r=state.favours?.requests[l.requestId];
    return r?.status=="offered"&&!reasonGone(state,r)&&!state.knowledge?.[actorId]?.offers?.[r.id]&&!ecs.personable[r.giverId]?.dead&&patience(state,actorId,r.giverId).free>=patience(state,actorId,r.giverId).minimum;
  });
  if(lead && (!firstDay || contacts>=3)) {
    const r=state.favours.requests[lead.requestId],giver=r.giverId,n=displayName(state,giver),point=ecs.spatial[giver];
    const explored=point&&(ecs.playable?.[actorId]?.known||[]).some(h=>String(Hex(h))==String(Hex().fromPoint(point)));
    if(!ecs.planner?.[giver]||!explored) {
      const villageId=ecs.village?.[giver]?.villageId,village=state.villages?.[villageId]||state.travel?.villages?.[villageId];
      const far=Object.entries(state.travel?.maps||{}).find(([,m])=>m.residents?.[giver])?.[0];
      const direction=ecs.planner?.[giver]?localDirection(ecs.spatial[actorId],point):worldDirection(state,far);
      return {actorId,key:"find_help",text:"Find "+n+(village?.name?" in "+village.name:"")+(direction?", to the "+direction:"")+"."};
    }
    return {actorId,key:"help_lead",targetId:giver,text:"Chat with "+n+" and ask how you can help.",action:"Chat with "+n};
  }
  const player=ecs.spatial[actorId];
  const explored=new Set((ecs.playable?.[actorId]?.known||[]).map(h=>h.x+","+h.y));
  const candidates=Object.keys(ecs.planner||{}).filter(id=>id!=actorId&&!ecs.personable[id]?.dead&&ecs.spatial[id]&&explored.has(String(Hex().fromPoint(ecs.spatial[id])))&&patience(state,actorId,id).free>=patience(state,actorId,id).minimum);
  candidates.sort((a,b)=>Math.hypot(ecs.spatial[a].x-player.x,ecs.spatial[a].y-player.y)-Math.hypot(ecs.spatial[b].x-player.x,ecs.spatial[b].y-player.y));
  const target=candidates.find(id=>!state.knowledge?.[actorId]?.people?.[id]?.conversation) || candidates.sort((a,b)=>(state.chat?.pairs?.[actorId+":"+a]?.encounters||0)-(state.chat?.pairs?.[actorId+":"+b]?.encounters||0))[0];
  if(target) {
    const n=displayName(state,target);
    const walking=task?.job.key=="chat";
    const anyContact=Object.values(state.knowledge?.[actorId]?.people||{}).some(p=>p.conversation);
    let text="Chat with "+n+" and ask how you can help.";
    if(n=="an unknown person") text=anyContact?"Chat with the nearby neighbour to meet someone new.":"Chat with the nearby neighbour to make your first acquaintance.";
    if(walking) text="Let your character walk over to start the conversation.";
    if(accepted) text="Chat with the nearby neighbour while your harvest waits.";
    return {actorId,key:"chat",targetId:target,text,action:walking?null:"Chat with "+(n=="an unknown person"?"nearby neighbour":n)};
  }
  return {actorId,key:"explore",text:"Select the edge of visible ground and choose Move here to find another neighbour."};
}

export const PEOPLE_GOALS = {
  trust: "You earned someone's trust in your arrival village.",
  story: "You learned a family's story.",
  help: "A friend contributed to your work without being asked.",
  wedding: "You witnessed another couple's live wedding."
};
export function arrivalVillage(s,actor=s.ui.playerId) {
  const p=s.ecs.spatial?.[actor];
  const villages=Object.values(s.villages||{}).filter(v=>v.centre);
  villages.sort((a,b)=>Math.hypot(Hex(a.centre).toPoint().x-(p?.x||0),Hex(a.centre).toPoint().y-(p?.y||0))-Math.hypot(Hex(b.centre).toPoint().x-(p?.x||0),Hex(b.centre).toPoint().y-(p?.y||0)));
  return villages[0]?.id || s.ecs.village?.[actor]?.villageId;
}
export function goalEvidence(s,actor) {
  s.knowledge ||= {};
  const k=s.knowledge[actor] ||= {people:{},feelings:{}};
  return k.peopleGoals ||= {villageId:arrivalVillage(s,actor),earned:{}};
}
export function peopleGoals(s) {
  const actor=s.ui.playerId,g=goalEvidence(s,actor);
  if(!g.earned.trust)for(const [id,p] of Object.entries(s.knowledge[actor].people||{}))if(p.conversation && s.ecs.village?.[id]?.villageId==g.villageId && ["social","personal","intimate"].includes(s.ecs.relationships[id]?.known[actor]?.ring)) {
    g.earned.trust={personId:id,day:s.days};break;
  }
  const completed=Object.keys(PEOPLE_GOALS).filter(key=>g.earned[key]);
  const next=Object.keys(PEOPLE_GOALS).find(key=>!g.earned[key]);
  return {completed,labels:completed.map(key=>PEOPLE_GOALS[key]),hint:{trust:"Chat with someone in your arrival village and earn their trust.",story:"Ask a trusted local about a relative to learn their story.",help:"Friends can help once your building has materials or your field needs work.",wedding:"Keep an eye out for a live wedding between other people."}[next] || "Your life here is yours to shape."};
}
export function recogniseConversation(s,actor,speaker,events) {
  const g=goalEvidence(s,actor),k=s.knowledge[actor];
  if(s.ecs.village?.[speaker]?.villageId==g.villageId && ["social","personal","intimate"].includes(s.ecs.relationships[speaker]?.known[actor]?.ring))g.earned.trust ||= {personId:speaker,day:s.days};
  for(const e of events)if(["birth","marriage","death","inheritance","move","quarrel","reconciliation"].includes(e.type) && e.people.length && e.people.every(id=>id==actor || k.people?.[id])) {
    g.earned.story ||= {speakerId:speaker,eventId:e.id,day:s.days};
  }
}
