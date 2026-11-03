import { isAdult, isDependent } from "game/life_stages";
import { mutuallyOriented } from "game/orientation";
import { eventParticipants } from "game/event_roles";
import { RINGS, disposition, goodwillTowards } from "game/people";
import { personComponent } from "game/residents";
import { closeFamily, relatedPeople } from "game/social_kin";

export const pairKey = (a,b) => [a,b].sort().join(":");
export const boundValue = (bindings,path) => {
  if(typeof path != "string")return path;
  // Most authored arguments are a single role, with no nested field to walk.
  if(!path.includes("."))return bindings?.[path];
  return path.split(".").reduce((v,k)=>v?.[k],bindings);
};
export const boundId = (bindings,path) => {const v=boundValue(bindings,path);return v?.id ?? v;};
const person = (s,id) => personComponent(s,"personable",id);
const alive = (s,id) => !!person(s,id) && !person(s,id).dead;
const kin = (s,id) => personComponent(s,"kinship",id);
const bond = (s,a,b) => personComponent(s,"relationships",a)?.known[b];

// A current directional score, never a second stored relationship meter.
export function maritalSatisfaction(s,id) {
  const spouse=kin(s,id)?.spouse;
  if(!alive(s,id)||!alive(s,spouse))return null;
  const goodwill=goodwillTowards(s,id,spouse);
  const avoiding=s.social?.avoidance?.[pairKey(id,spouse)]>s.days;
  return Math.max(0,Math.min(100,goodwill-(avoiding?15:0)));
}

// undefined means an unknown predicate; missing bindings fail known predicates.
export function condition(s,b,{test,args:a={}}) {
  const id=path=>boundId(b,path),p=id(a.person),q=id(a.towards),x=id(a.a),y=id(a.b);
  const valid=(...ids)=>ids.every(v=>v!=null && !!person(s,v));
  switch(test) {
  case "event_participant":return eventParticipants(b.event).includes(p);
  case "participant_kin":return eventParticipants(b.event).some(id=>closeFamily(s,id).includes(p)||closeFamily(s,p).includes(id)||(a.extended&&relatedPeople(s,id,p,true)));
  case "participant_friend":return eventParticipants(b.event).some(id=>RINGS.indexOf(bond(s,p,id)?.ring)>=RINGS.indexOf(a.ring));
  case "person_alive":return alive(s,p);
  case "person_dead":return !!person(s,p)?.dead;
  case "is_adult":return alive(s,p)&&isAdult(person(s,p).age);
  case "is_dependent":return valid(p)&&isDependent(person(s,p).age);
  case "has_trait":return valid(p)&&!!personComponent(s,"personality",p)?.traits.includes(a.trait);
  case "disposition_is":return valid(p,q)&&disposition(s,p,q)==a.value;
  case "cold_towards":return valid(p,q)&&(disposition(s,p,q)=="hate"||goodwillTowards(s,p,q)<0);
  case "ring_is":return valid(p,q)&&(bond(s,p,q)?.ring||"public")==a.ring;
  case "ring_at_least":return valid(p,q)&&RINGS.includes(a.ring)&&RINGS.indexOf(bond(s,p,q)?.ring||"public")>=RINGS.indexOf(a.ring);
  case "goodwill_at_least":return valid(p,q)&&goodwillTowards(s,p,q)>=a.value;
  case "goodwill_below":return valid(p,q)&&goodwillTowards(s,p,q)<a.value;
  case "has_living_spouse":return alive(s,kin(s,p)?.spouse);
  case "spouses":return valid(x,y)&&kin(s,x)?.spouse==y;
  case "same_person":return valid(x,y)&&x==y;
  case "same_household": {const h=personComponent(s,"household",x)?.houseId;return valid(x,y)&&!!h&&h==personComponent(s,"household",y)?.houseId;}
  case "close_kin":return valid(x,y)&&closeFamily(s,x).includes(y);
  case "related":return valid(x,y)&&(x==y||relatedPeople(s,x,y,true));
  case "marital_satisfaction_below": {const n=maritalSatisfaction(s,p);return n!=null&&n<a.value;}
  case "mutual_romance":return valid(x,y)&&!!bond(s,x,y)?.romance&&!!bond(s,y,x)?.romance;
  case "mutually_oriented":return valid(x,y)&&mutuallyOriented(s,x,y);
  case "affair_exists":return valid(x,y)&&!!(bond(s,x,y)?.affair||bond(s,y,x)?.affair);
  case "different_village": {const h=personComponent(s,"village",x)?.villageId,v=personComponent(s,"village",y)?.villageId;return valid(x,y)&&h!=null&&v!=null&&h!=v;}
  case "avoiding":return valid(x,y)&&s.social?.avoidance?.[pairKey(x,y)]>s.days;
  case "avoidance_expired": {const until=s.social?.avoidance?.[pairKey(x,y)];return valid(x,y)&&until!=null&&until<=s.days;}
  case "subject_is_close_kin_of":return valid(p,id("subject"))&&closeFamily(s,p).includes(id("subject"));
  case "event_has_close_kin_of":return valid(p)&&!!boundValue(b,a.event)?.people.some(id=>closeFamily(s,p).includes(id));
  case "event_recipient_is_close_kin_of":return valid(p)&&closeFamily(s,p).includes(boundValue(b,a.event)?.people[1]);
  default:return undefined;
  }
}
export function conditions(s,b,when={}) {
  return (when.all||[]).every(p=>condition(s,b,p)===true) &&
    (!when.any?.length||when.any.some(p=>condition(s,b,p)===true)) &&
    (when.none||[]).every(p=>condition(s,b,p)===false);
}
