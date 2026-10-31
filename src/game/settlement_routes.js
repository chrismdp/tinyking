import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { recordRoadUse, updateRoadWear } from "game/road_wear";

export const routeTile = (s, point) => point && (s.space?.[Hex().fromPoint(point)] || []).find(id=>s.ecs.walkable?.[id]);
const routeCaches=new WeakMap();
function journeyPath(s,from,to) {
  if(!from || !to)return null;
  let cache=routeCaches.get(s);
  if(!cache || cache.revision!=s.landUseRevision) {cache={revision:s.landUseRevision,paths:new Map()};routeCaches.set(s,cache);}
  const key=from+":"+to;
  if(!cache.paths.has(key))cache.paths.set(key,path(s,from,to));
  return cache.paths.get(key);
}
function applyLeg(s,trip,day) {
  s.days=day;
  for(const [i,step] of trip.steps.entries()) {
    recordRoadUse(s,step.id,step.entrance,step.exit,trip.count);
    if(trip.mainRoute && i>0 && i<trip.steps.length-1) {
      const tile=s.ecs.mappable[step.id], key=[step.entrance ?? "C",step.exit ?? "C"].sort().join(",");
      const roles=tile.roadRoles ||= {};
      const role=roles[key] ||= {role:"main",journeys:0,firstDay:day,reason:trip.reason};
      role.journeys+=trip.count;role.lastDay=day;
    }
  }
}
export function flushJourneys(s) {
  const history=s.settlement, now=s.days;
  const legs=(history.pendingJourneys || []).flatMap(j=>[{day:j.day,trip:j},...(j.returnDay!=null?[{day:j.returnDay,trip:j}]:[])])
    .sort((a,b)=>a.day-b.day || a.trip.key.localeCompare(b.trip.key));
  for(const leg of legs)applyLeg(s,leg.trip,leg.day);
  delete history.pendingJourneys;
  s.days=now;updateRoadWear(s);
}
export function recordJourney(s, details) {
  const history=s.settlement;
  if(!history)return null;
  history.appliedJourneys ||= {};
  if(history.appliedJourneys[details.key])return history.journeys.find(j=>j.key==details.key) || null;
  const route=details.steps || journeyPath(s,details.from,details.to);
  if(!route?.length)return null;
  const day=details.day ?? s.days, count=details.count ?? details.people.length;
  if(!(count>0))return null;
  const trip={...details,day,count,villageId:details.villageId ?? s.ecs.village?.[details.people[0]]?.villageId,mainRoute:details.mainRoute ?? !!details.borderKey,origin:details.origin || s.map?.worldKey,tiles:route.map(step=>step.id),steps:route.map(step=>({...step}))};
  if(s.generatingHistory || s.settlement.summarising) (history.pendingJourneys ||= []).push(trip);
  else {
    const now=s.days;
    applyLeg(s,trip,day);
    if(trip.returnDay!=null)applyLeg(s,trip,trip.returnDay);
    s.days=now;
  }
  history.journeys.push(trip);
  history.appliedJourneys[trip.key]={day,returnDay:trip.returnDay};
  return trip;
}

// A border's first observed community seals its prehistory. A lazy neighbour
// receives these crossing/camp legs before its first view. No people are spawned
// or aged here, and no claim is made about an unknown neighbour's households.
export function reconcileRouteHistory(s, ledger) {
  if(!s.settlement || s.settlement.observedAt!=null)return;
  const history=s.settlement, now=s.days;
  const imported=[];
  for(const trip of ledger) {
    if(history.appliedJourneys[trip.key] || trip.origin==s.map.worldKey)continue;
    const entry=Object.values(s.map.entrances || {}).find(e=>e.key==trip.borderKey);
    if(!entry?.tileIds?.length)continue;
    const steps=path(s,entry.tileIds[0],entry.tileIds[2]);
    if(!steps)continue;
    imported.push({...trip,tiles:steps.map(p=>p.id),steps,imported:true});
  }
  if(!imported.length)return;
  // First observation has no unrecorded live footsteps. Replay every recorded
  // leg in chronological order through the real wear API, including decay.
  const all=[...history.journeys,...imported], touched=new Set(all.flatMap(j=>j.tiles));
  const start=Math.min(...all.map(j=>j.day));
  for(const id of touched) {
    Object.assign(s.ecs.walkable[id],{worn:{},routeWear:0,wearUpdatedAt:start});
    s.ecs.mappable[id].roadRoles={};
  }
  const legs=all.flatMap(j=>[{day:j.day,trip:j},...(j.returnDay!=null?[{day:j.returnDay,trip:j}]:[])])
    .sort((a,b)=>a.day-b.day || a.trip.key.localeCompare(b.trip.key));
  for(const {day,trip} of legs) {
    applyLeg(s,trip,day);
  }
  s.days=now;updateRoadWear(s);
  for(const trip of imported) {
    history.journeys.push(trip);
    history.appliedJourneys[trip.key]={day:trip.day,returnDay:trip.returnDay,imported:true};
  }
}
