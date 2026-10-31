import { visibleFavours } from "game/favours";
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
