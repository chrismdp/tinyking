import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { recordRoadUse, updateRoadWear, throughTrack } from "game/road_wear";
import { transitBlocked } from "game/land_use";

// Connect border crossings and one public approach per village along the
// surveyed network. House, field and camp spurs keep their existing topology.
// Colour is per side pair, so a local turn at a main junction stays brown.
export function markThroughRoutes(s, villageApproaches) {
  const {ecs}=s, entries=Object.values(s.map.entrances || {});
  const terminals=[...entries.map(e=>e.tileIds[0]),...villageApproaches];
  const network=new Set(), links=new Map(Object.keys(ecs.mappable).map(id=>[id,new Map()]));
  const link=(id,side)=>{
    const next=ecs.walkable[id].neighbours[side];
    if(!next || ecs.walkable[next].neighbours[(side+3)%6]!=id || transitBlocked(s,id) || transitBlocked(s,next))return;
    links.get(id).set(side,next);links.get(next).set((side+3)%6,id);
  };
  for(const [id,tile] of Object.entries(ecs.mappable))for(const side of tile.route || [])link(id,side);
  // Later households can reach the original survey along walking tracks.
  // Their recorded border and inter-village journeys supply those real links.
  for(const trip of s.settlement.journeys.filter(trip=>trip.mainRoute)) {
    for(const step of trip.steps)if(step.exit!=null)link(step.id,step.exit);
  }
  for(const tile of Object.values(ecs.mappable))tile.throughRoute=[];
  const mark=(id,side)=>{
    const sides=ecs.mappable[id].throughRoute;
    if(!sides.includes(side))sides.push(side);
  };
  for(const target of terminals) {
    const queue=[target], previous=new Map([[target,null]]);
    let joined;
    for(let i=0;i<queue.length;i++) {
      const id=queue[i];
      if(network.has(id)){joined=id;break;}
      for(const [side,next] of links.get(id)) {
        if(previous.has(next))continue;
        previous.set(next,{id,side});queue.push(next);
      }
    }
    while(joined && previous.get(joined)) {
      const {id,side}=previous.get(joined);
      mark(id,side);mark(joined,(side+3)%6);
      network.add(joined);network.add(id);joined=id;
    }
    network.add(target);
  }
  // Continue the corridor to the real crossing beyond the map boundary.
  for(const entry of entries) {
    const id=entry.tileIds[0];
    if(ecs.mappable[id].throughRoute.length)for(const side of ecs.mappable[id].route || []) {
      if(!ecs.walkable[id].neighbours[side])mark(id,side);
    }
  }
  // Construction can relocate surveyed sites during prehistory. Classify the
  // finished village, then attribute the existing journey ledger to it.
  for(const tile of Object.values(ecs.mappable))tile.roadRoles={};
  for(const trip of s.settlement.journeys)for(const step of trip.steps) {
    recordMainUse(s,trip,step,trip.day);
    if(trip.returnDay!=null)recordMainUse(s,trip,step,trip.returnDay);
  }
}

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
  for(const step of trip.steps) {
    recordRoadUse(s,step.id,step.entrance,step.exit,trip.count);
    recordMainUse(s,trip,step,day);
  }
}
function recordMainUse(s,trip,step,day) {
  const key=[step.entrance ?? "C",step.exit ?? "C"].sort().join(",");
  if(!trip.mainRoute || !throughTrack(s.ecs,step.id,key))return;
  const roles=s.ecs.mappable[step.id].roadRoles ||= {};
  const role=roles[key] ||= {role:"main",journeys:0,firstDay:day,reason:trip.reason};
  role.journeys+=trip.count;
  role.firstDay=Math.min(role.firstDay,day);role.lastDay=Math.max(role.lastDay ?? day,day);
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
