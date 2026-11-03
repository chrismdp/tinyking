import ACTIVITIES from "data/secret_activities.json";
import { conditions } from "game/social_conditions";
import { eventRoles } from "game/event_roles";
import { activeSecretActivities, activityProgress, recordActivity } from "game/secret_activity_history";
import { nearbyPeople } from "game/population_index";
import { hashUnit, squaredDistance } from "game/math";
import { Hex, Grid } from "game/hex";
import { path } from "game/pathfinding";
import { LOCOMOTION_RATIO } from "game/locomotion";
import { eventWitnesses } from "game/social_visibility";
import { learnEvent } from "game/events";
import { leaveHome } from "game/home";
export { historySecretActivities } from "game/secret_activity_history";

const navAt=(s,p)=>p && (s.space[Hex().fromPoint(p)]||[]).find(id=>s.ecs.walkable?.[id]);
const free=(s,id)=>{
  const p=s.ecs.planner?.[id],w=p?.world;
  return w && !s.ecs.playable?.[id] && !w.ordered && !w.capturedBy && !w.capturedAttentionOf && !w.currentJob &&
    !w.feeling.hungry && !w.feeling.tired && !w.sleeping && !w.chatVisit && !w.customsVisit && !w.worldJourney && !w.worldArrival &&
    !w.claimedFarmable && !w.helpingFriend && !w.gardenHelp && (!w.social || w.social.kind!="secret") && ["wait_for","home_downtime","socialise","walk_to"].includes(p.task?.[0]);
};

function routeHours(s,from,to) {
  const a=navAt(s,from),b=navAt(s,to),route=a && b && path(s,a,b);
  return route ? route.reduce((n,t)=>n+1/(s.ecs.walkable[t.id].speed||1),0)/(10*LOCOMOTION_RATIO) : Infinity;
}

export function activityPlace(s,event,activityId) {
  const rules=ACTIVITIES[activityId],people=rules.participants.map(role=>eventRoles(event)[role]);
  const e=s.ecs,[a]=people,home=e.household?.[a]?.houseId,origin=e.spatial?.[home]||e.spatial?.[a];
  if(!origin)return null;
  const candidates=[];
  const houses=new Set([...(s.villages?.[e.village?.[a]?.villageId]?.houses||[]),...Object.keys(e.building||{}),...Object.keys(e.shelter||{}).filter(id=>e.shelter[id].stage=="house")]);
  if(rules.places.includes("empty_house"))for(const id of houses) {
    const point=e.spatial[id];
    if(!point || squaredDistance(origin,point)>rules.placeRadius**2 || nearbyPeople(s,point,120).some(who=>!e.personable[who]?.dead &&
        (e.household?.[who]?.houseId==id || e.interior?.[who]?.buildingId==id)))continue;
    candidates.push({point:{x:point.x,y:point.y},kind:"house",houseId:id});
  }
  if(rules.places.includes("woods"))for(const h of Grid.spiral({center:Hex().fromPoint(origin),radius:Math.ceil(rules.placeRadius/104)})) {
    const contents=s.space[h]||[],tile=contents.find(id=>e.walkable?.[id]);
    if(!tile || !contents.some(id=>e.tree?.[id] || e.good?.[id]?.type=="wood" && !e.haulable?.[id]) ||
      contents.some(id=>e.building?.[id]||e.shelter?.[id]))continue;
    candidates.push({point:{...h.toPoint()},kind:"woods"});
  }
  const day=Math.floor(s.days);
  candidates.sort((a,b)=>hashUnit(s.peopleSeed+":activity-place:"+activityId+":"+event.id+":"+day+":"+a.point.x+":"+a.point.y)-hashUnit(s.peopleSeed+":activity-place:"+activityId+":"+event.id+":"+day+":"+b.point.x+":"+b.point.y));
  const hour=(s.days%1)*24;
  return candidates.find(place=>people.every(id=>{
    const out=routeHours(s,e.spatial[id],place.point),home=e.spatial[e.household[id]?.houseId];
    return out+rules.durationHours+routeHours(s,place.point,home)<rules.homeHour-hour;
  }));
}

export function startSecretActivity(s,event,activityId,place) {
  const rules=ACTIVITIES[activityId],people=rules.participants.map(role=>eventRoles(event)[role]);
  if(!conditions(s,eventRoles(event),rules.when))return false;
  if(!people.every(id=>free(s,id)))return false;
  place ||= activityPlace(s,event,activityId);
  if(!place)return false;
  for(const id of people) {
    const old=s.ecs.planner[id].world.social,other=s.ecs.planner[old?.partnerId];
    if(old && !people.includes(old.partnerId) && other?.world.social?.partnerId==id) {
      other.world.social.stage="returning";other.task=null;other.plan=null;
    }
  }
  for(const [i,id] of people.entries()) {
    const p=s.ecs.planner[id];
    leaveHome(s,id);
    p.world.social={kind:"secret",activityId,participants:people,eventId:event.id,partnerId:people[(i+1)%people.length],visitor:true,homeId:s.ecs.household[id]?.houseId,
      stage:"outbound",expires:Math.floor(s.days)+rules.homeHour/24,meetingPlace:place,witnessChecks:0};
    p.world.places.sleep=s.ecs.household[id]?.houseId;
    p.world.places.socialDestination={x:place.point.x+(i-(people.length-1)/2)*20,y:place.point.y};
    p.task=null;p.plan=null;
  }
  return true;
}

// Called by the existing hourly social scheduler, only in the evening.
export function eveningSecretActivities(s) {
  const hour=(s.days%1)*24,day=Math.floor(s.days);
  // The scheduler is hourly. Outside any declared window, even the activity
  // index need not be visited.
  if(!Object.values(ACTIVITIES).some(r=>hour>=r.earliestHour && hour<r.latestStartHour))return;
  for(const {event,activityId,rules,people} of activeSecretActivities(s,Object.keys(s.ecs.planner||{}))) {
    if(hour<rules.earliestHour || hour>=rules.latestStartHour || !people.every(id=>free(s,id)))continue;
    const progress=activityProgress(s,event,activityId);
    if(progress.lastMeetingDay==day)continue;
    const chosen=hashUnit(s.peopleSeed+":activity:"+activityId+":"+event.id+":"+day)<rules.eveningChance;
    if(!chosen || startSecretActivity(s,event,activityId))progress.lastMeetingDay=day;
  }
}

// Called by the participants' running tasks. Only the declared moments query
// nearby people. The shared visit counters prevent duplicate witness checks.
export function meetInSecret(s,id) {
  const p=s.ecs.planner[id],v=p.world.social,rules=ACTIVITIES[v.activityId];
  const group=v.participants.map(who=>({who,p:s.ecs.planner[who],visit:s.ecs.planner[who]?.world.social}));
  if(group.some(({who,p,visit})=>!visit || visit.kind!="secret" || visit.eventId!=v.eventId || visit.stage=="returning" ||
    s.ecs.personable[who]?.dead || !p || p.world.feeling.hungry || p.world.feeling.tired) || s.days>=v.expires)return false;
  if(group.some(({who,p,visit})=>!s.ecs.spatial[who] || squaredDistance(s.ecs.spatial[who],visit.meetingPlace.point)>60**2 || p.task?.[0]!="socialise"))return true;
  if(v.started==null)for(const {who,visit} of group) {
    visit.started=s.days;visit.stage="visiting";
    if(visit.meetingPlace.houseId) {
      (s.ecs.interior ||= {})[who]={id:who,buildingId:visit.meetingPlace.houseId};s.redraws?.push(who);
    }
  }
  const elapsed=(s.days-v.started)*24;
  const moment=Math.min(rules.witnessMoments,1+Math.floor((elapsed+1e-9)/rules.durationHours*(rules.witnessMoments-1)));
  if(moment>v.witnessChecks) {
    for(const {visit} of group)visit.witnessChecks=moment;
    if(!v.meetingEventId) {
      const source=s.events.find(e=>e.id==v.eventId);
      const meeting=recordActivity(s,source,rules,{place:v.meetingPlace.houseId||"woods"});
      for(const {visit} of group)visit.meetingEventId=meeting.id;
    } else {
      const event=s.events.find(e=>e.id==v.meetingEventId);
      if(event)for(const witness of eventWitnesses(s,v.participants))learnEvent(s,witness,event,"witness");
    }
  }
  return elapsed+1e-9<rules.durationHours;
}
