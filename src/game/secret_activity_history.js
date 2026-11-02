import ACTIVITIES from "data/secret_activities.json";
import { eventRoles, affectedParties } from "game/event_roles";
import { conditions } from "game/social_conditions";
import { hashUnit } from "game/math";
import { recordEvent } from "game/events";
import { isResident } from "game/residents";

const indexes=new WeakMap();
export function activeSecretActivities(s,ids) {
  const events=s.events||[],residents=new Set(ids);
  let index=indexes.get(events);
  if(!index || index.length>events.length){index={length:0,entries:[]};indexes.set(events,index);}
  for(let i=index.length;i<events.length;i++)for(const [activityId,rules] of Object.entries(ACTIVITIES))
    if(events[i].type==rules.sourceEvent)index.entries.push({event:events[i],activityId,rules});
  index.length=events.length;
  return index.entries.flatMap(entry=>{
    const roles=eventRoles(entry.event),people=entry.rules.participants.map(role=>roles[role]);
    return people.every(id=>residents.has(id) && isResident(s,id) && s.ecs.personable?.[id] && !s.ecs.personable[id].dead) &&
      conditions(s,roles,entry.rules.when) ? [{...entry,people}] : [];
  });
}
export function activityProgress(s,event,activityId) {
  s.social ||= {};
  return ((s.social.activities ||= {})[event.id+":"+activityId] ||= {});
}
export function recordActivity(s,event,rules,details={}) {
  const roles=eventRoles(event);
  return recordEvent(s,rules.witnessEvent.type,rules.witnessEvent.people.map(role=>roles[role]),[],{causeEventId:event.id,...details});
}

// Summary seasons have no positions. The eligible audience and weights come
// from the same activity data; no arriving player is an invented witness.
export function historySecretActivities(s,ids,season,overrides={}) {
  for(const {event,activityId,rules,people} of activeSecretActivities(s,ids)) {
    const progress=activityProgress(s,event,activityId),rates={...rules.history,...overrides[activityId]};
    if(progress.lastHistorySeason===season)continue;
    progress.lastHistorySeason=season;
    const key=s.peopleSeed+":activity:"+activityId+":"+event.id+":"+season;
    if(hashUnit(key+":seen")>=rates.chance)continue;
    const homes=new Set(people.map(id=>s.ecs.household?.[id]?.houseId).filter(Boolean));
    const villages=new Set(people.map(id=>s.ecs.village?.[id]?.villageId).filter(v=>v!=null));
    const affected=new Set(affectedParties(s,event).map(p=>p.personId));
    const pool=ids.filter(id=>!people.includes(id) && !s.ecs.playable?.[id] && !s.ecs.personable[id]?.dead && isResident(s,id) &&
      (rates.sameHousehold && homes.has(s.ecs.household?.[id]?.houseId) || rates.sameVillage && villages.has(s.ecs.village?.[id]?.villageId)))
      .map(id=>({id,weight:affected.has(id)?rates.affectedWeight:homes.has(s.ecs.household?.[id]?.houseId)?rates.housemateWeight:1}));
    let roll=hashUnit(key+":who")*pool.reduce((n,p)=>n+p.weight,0);
    const witness=pool.find(p=>(roll-=p.weight)<0)?.id;
    if(witness)recordActivity(s,event,rules,{summary:true,audienceIds:[...people,witness]});
  }
}
