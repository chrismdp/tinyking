import { RINGS, relationshipCap } from "game/people";
import { knownEvents } from "game/events";
import { eligiblePartner, partnerInterest } from "game/social";
import { visitUnavailable, planVisit } from "game/social_visits";
import { SOCIAL_ACTIONS, socialActionAvailable, socialActionBindings } from "game/social_actions";

const pairKey = (a,b) => [a,b].sort().join(":");
export function trustedHelper(s, helper, a, b) {
  return [a,b].every(id => id != helper && RINGS.indexOf(s.ecs.relationships?.[id]?.known[helper]?.ring) >= 2 && relationshipCap(s,id,helper) >= 2);
}
export function peaceUnavailable(s, helper, a, b) {
  if (!trustedHelper(s,helper,a,b)) return "Both people must trust you at Personal closeness";
  const key = pairKey(a,b);
  const quarrel = knownEvents(s,helper).filter(e => e.type=="quarrel" && pairKey(...e.people)==key).at(-1);
  if (!quarrel || s.social?.avoidance?.[key] == null) return "There is no unresolved quarrel that you know about";
  if ([a,b].some(id => !(s.social.contacts?.[pairKey(helper,id)] > quarrel.day))) return "Complete a conversation with each person since the quarrel";
  const action = SOCIAL_ACTIONS.find(a=>a.id=="reconcile");
  // Check the existing seasonal rule with the proposed expiry. No event or
  // relationship changes until a real subsequent contact runs that action.
  const proposed = { ...s, social:{ ...s.social, avoidance:{ ...s.social.avoidance, [key]:s.days } } };
  if (!socialActionAvailable(proposed,action,socialActionBindings(proposed,action,a,b),a,b)) return "They have already reconciled this season";
  return visitUnavailable(s,a,b,{ignoreAvoidance:true});
}
export function makePeace(s, helper, a, b) {
  const reason = peaceUnavailable(s,helper,a,b);
  if (reason) return reason;
  if (!planVisit(s,a,b)) return "There is no route for them to meet";
  s.social.avoidance[pairKey(a,b)] = s.days;
  return null;
}
export function introduceUnavailable(s, helper, a, b) {
  if (!trustedHelper(s,helper,a,b)) return "Both people must trust you at Personal closeness";
  if (!eligiblePartner(s,a,b)) return "They must be unrelated single adults free to court";
  if (!partnerInterest(s,a,b)) return "They are not willing, compatible partners";
  return visitUnavailable(s,a,b);
}
export function introduce(s, helper, a, b) {
  const reason = introduceUnavailable(s,helper,a,b);
  if (reason) return reason;
  return planVisit(s,a,b) ? null : "There is no route for them to meet";
}
