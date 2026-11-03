import TYPES from "data/event_types.json";
import { boundId } from "game/social_conditions";

export function eventRoles(event) {
  return Object.fromEntries((TYPES[event?.type]?.roles || []).map((role,i)=>[role,event?.people[i]]));
}
export function eventParticipants(event) {
  const declared=TYPES[event?.type]?.participants;
  if(!declared)return event?.people || [];
  const roles=eventRoles(event);
  return declared.map(role=>roles[role]).filter(id=>id!=null);
}

// Capture affected identities at occurrence, before marriage/ownership can change.
// Older saves without this field can still resolve their declared roles.
export function affectedParties(s,event) {
  if(event.affected)return event.affected;
  if(!TYPES[event.type]?.affected)return [];
  const roles=eventRoles(event),participants=eventParticipants(event),result=[];
  for(const rule of TYPES[event.type]?.affected || []) {
    for(const subject of rule.each=="participant" ? participants : [roles[rule.subject]]) {
      const personId=typeof rule.from=="string" ? roles[rule.from] : s.ecs[rule.from.component]?.[subject]?.[rule.from.field];
      if(!personId || participants.includes(personId) || !s.ecs.personable?.[personId] || s.ecs.personable[personId].dead)continue;
      result.push({role:rule.role,personId,subject,other:participants.find(id=>id!=subject)});
    }
  }
  return result;
}
export function affectedBindings(event,party) {
  return {...eventRoles(event),affected:party.personId,subject:party.subject,other:party.other,event};
}
export function discoverySpec(event,party) {
  return TYPES[event.type]?.affected?.find(rule=>rule.role==party.role)?.discovery;
}
export function discoveryPeople(event,party) {
  const b=affectedBindings(event,party);
  return discoverySpec(event,party)?.people.map(path=>boundId(b,path));
}
