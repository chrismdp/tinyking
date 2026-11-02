import { addGoodwill, meet } from "game/people";
import { conditions, boundId, pairKey } from "game/social_conditions";
import { DAYS_IN_SEASON } from "game/time";

export function eventBindings(event,listener) {
  return {event,actor:event.people[0],partner:event.people[1],subject:event.people[1],listener};
}

// `person` owns the directional regard; `towards` is its subject.
export function applySocialEffects(s,effects,bindings,recordEvent) {
  for(const effect of effects||[]) {
    const variants=effect.each=="participant" ? (bindings.event?.people||[]).map(actor=>({...bindings,actor,partner:bindings.event.people.find(p=>p!=actor)})) : [bindings];
    for(const b of variants) {
      if(!conditions(s,b,effect.when))continue;
      const id=p=>boundId(b,p),a=id(effect.person),other=id(effect.towards);
      switch(effect.op) {
      case "goodwill":if(s.ecs.relationships?.[a]&&s.ecs.personable?.[other])addGoodwill(s,other,a,effect.amount);break;
      case "avoidance": {
        s.social ||= {};s.social.avoidance ||= {};
        const key=pairKey(id(effect.a),id(effect.b));
        if(effect.seasons==0)delete s.social.avoidance[key];
        else s.social.avoidance[key]=s.days+effect.seasons*DAYS_IN_SEASON;
        break;
      }
      case "reaction": {
        const k=(s.knowledge ||= {})[id(effect.person)] ||= {people:{},feelings:{}};
        k.reactions={...k.reactions,[b.event.id]:effect.value};break;
      }
      case "romance":case "affair":
        for(const [a,c] of [[id(effect.a),id(effect.b)],[id(effect.b),id(effect.a)]]) {
          meet(s,a,c);
          const list=s.ecs.relationships[a].known;
          list[c]={...list[c],[effect.op]:{since:s.days,eventId:b.event?.id}};
        }
        break;
      case "record_event":recordEvent(s,effect.type,effect.people.map(id),[],{reason:effect.reason,causeEventId:b.event?.id});break;
      default:throw new Error("Unknown social effect: "+effect.op);
      }
    }
  }
}
