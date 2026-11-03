import { eventById } from "game/events";
import TYPES from "data/event_types.json";
import { conditions } from "game/social_conditions";
import { eventParticipants, eventRoles, affectedParties, affectedBindings } from "game/event_roles";

export function disclosureEvent(s,event) {
  if(event?.sealed)return event;
  const via=TYPES[event?.type]?.disclosure?.via;
  return via ? eventById(s,event[via]) : event;
}

// Rules name both ends of a disclosure. An affected audience is exclusive:
// a failed loyalty/spite rule cannot fall through to ordinary private gossip.
export function disclosureRoute(s,event,teller,listener) {
  event=disclosureEvent(s,event);
  const rule=TYPES[event?.type]?.disclosure;
  if(!rule?.routes)return {};
  const participants=eventParticipants(event),base={...eventRoles(event),event,teller,listener};
  const parties=affectedParties(s,event).filter(p=>p.personId==listener);
  for(const route of rule.routes || []) {
    const contexts=route.listener=="affected" ? parties.map(p=>affectedBindings(event,p)) : [base];
    for(const context of contexts) {
      const b={...base,...context};
      if(route.teller=="participant" && !participants.includes(teller) || route.teller=="outsider" && participants.includes(teller))continue;
      if(route.listener=="outsider" && (participants.includes(listener)||parties.length))continue;
      if(conditions(s,b,route.when))return {allowed:true,chance:route.chancePerSeason};
    }
  }
  return {allowed:parties.length && rule.affectedOnlyByRoutes ? false : undefined};
}
