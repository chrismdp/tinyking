import { visibleFavours } from "game/favours";
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
  const actorId=state.ui.playerId;
  if (!actorId) return null;
  const progress=guidanceState(state);
  if(progress.dismissed || state.ecs.personable?.[actorId]?.dead) return null;
  const conversations=Object.entries(state.knowledge?.[actorId]?.people || {}).filter(([,p])=>p.conversation);
  const requests=visibleFavours(state);
  const completed=requests.some(r=>r.status=="completed");
  // Successful help closes this short opening permanently.
  if(completed) { progress.dismissed=true;return null; }
  const request=requests.find(r=>r.status=="offered");
  const accepted=requests.find(r=>r.status=="accepted");
  let key="meet",text="Select someone nearby and choose Chat to meet a local.";
  if(conversations.length) {
    key="contact";
    text="You have made a first acquaintance. Keep talking when you want to know them better.";
    if(request) { key="help";text="Ask how to help: select " + displayName(state,request.giverId) + " and open Offer help to see their request."; }
    if(accepted) {key="working";text="Your accepted favour is in Your tasks. Goodwill comes when the real work is done.";}
  }
  if(!progress.seen.includes(key)) {
    // Contact without a request is useful briefly, then leaves the player alone.
    progress.seen.push(key); progress.changedAt=state.days;
  }
  if(key=="contact" && state.days-progress.changedAt>1/24 || state.days-(progress.startedAt ??=state.days)>1) {progress.dismissed=true;return null;}
  return {actorId,key,text};
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
