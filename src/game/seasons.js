import { DAYS_IN_SEASON, day_of_season, hour_of_day, season } from "game/time";
import { recordEvent, knownEvents, learnEvent } from "game/events";
import { eventSentence } from "game/events";
import { displayName } from "game/knowledge";
import { addGoodwill } from "game/people";
import { isResident } from "game/residents";
import { squaredDistance } from "game/math";
import { enqueueTask } from "game/manager";
import { pauseWork } from "game/energy";
import { retryCourtships, chatTogether, canCourt } from "game/social";

export const FESTIVAL_NAMES={spring:"Seedwake Fair",summer:"Midsummer Gathering",autumn:"Harvest Hearth",winter:"Longest-night Vigil"};
export const FESTIVAL_MOODS={spring:"Seeds, shared plans and a place in the coming work.",summer:"An evening for courting, promises and weddings.",autumn:"A feast to honour the hands that brought the harvest home.",winter:"Every door is open. We keep the names of those who died this year."};
const near=(s,a,point,reach=75)=>s.ecs.spatial?.[a] && squaredDistance(s.ecs.spatial[a],point)<=reach**2;
export function festivalPlace(s,v) {
  const green=v.sharedPlaces?.find(id=>s.ecs.meetingPlace?.[id]?.kind=="green");
  return green && s.ecs.spatial[green] ? {id:green,...s.ecs.spatial[green]} : v.centre;
}
function releaseForFestival(s,id) {
  const p=s.ecs.planner[id],w=p.world;
  for(const manager of Object.values(s.ecs.manager || {}))for(const job of manager.jobs || [])if(job.assignedId==id)job.assignedId=null;
  if(w.claimedFarmable && s.ecs.farmable?.[w.claimedFarmable]) {
    const f=s.ecs.farmable[w.claimedFarmable];if(f.claimerId==id)f.claimerId=null;
    for(const slot of f.slots)if(slot.workerId==id)delete slot.workerId;
  }
  w.feeling.hungry=false;w.feeling.tired=false;
  w.claimedFarmable=null;w.currentJob=null;delete w.social;delete w.helpingFriend;
  p.task=null;p.plan=null;
}
export function updateFestival(s) {
  s.social ||= {};
  const fs=s.festivals=s.social.festivals ||= {records:{},active:null};
  fs.records ||= {};
  const n=Math.floor(s.days/DAYS_IN_SEASON),hour=hour_of_day(s.days);
  if(day_of_season(s.days)!=DAYS_IN_SEASON-1 || hour<18 || hour>=23) {
    if(fs.active)for(const p of Object.values(s.ecs.planner || {}))if(p.world.festivalPlace){delete p.world.festivalPlace;if(["festival_wait","walk_to"].includes(p.task?.[0])){p.task=null;p.plan=null;}}
    fs.active=null;return;
  }
  if(!fs.records[n]) {
    const kind=season(s.days),yearStart=Math.floor(n/4)*4*DAYS_IN_SEASON;
    fs.records[n]={season:n,kind,title:FESTIVAL_NAMES[kind],attended:{},honours:[],memorials:(s.events || []).filter(e=>e.type=="death" && e.day>=yearStart && e.day<=s.days && !e.sealed).map(e=>e.id),deadIds:knownEvents(s,s.ui.playerId).filter(e=>e.type=="death"&&e.day>=yearStart&&e.day<=s.days).map(e=>e.people[0])};
    // Honour only actual recorded work; its public reading discloses those events.
    if(kind=="autumn")fs.records[n].honours=(s.events || []).filter(e=>["harvest","favour"].includes(e.type)&&e.day>=yearStart&&e.day<=s.days&&!e.sealed).map(e=>e.id);
    for(const [id,p] of Object.entries(s.ecs.planner || {})) {
      const v=s.villages?.[s.ecs.village?.[id]?.villageId];
      if(id==s.ui.playerId || !v || !isResident(s,id) || s.ecs.personable?.[id]?.dead)continue;
      releaseForFestival(s,id);
      const green=v.sharedPlaces?.find(place=>s.ecs.meetingPlace?.[place]?.kind=="green");
      const centre=festivalPlace(s,v);
      const points=(s.ecs.meetingPlace?.[green]?.gatheringPoints || []).filter(point=>squaredDistance(point,centre)<290**2).sort((a,b)=>squaredDistance(a,centre)-squaredDistance(b,centre));
      const index=Object.keys(s.ecs.planner).filter(who=>who!=s.ui.playerId && !s.ecs.personable?.[who]?.dead && isResident(s,who) && s.ecs.village?.[who]?.villageId==v.id).indexOf(id);
      p.world.festivalPlace=points[index%points.length] || festivalPlace(s,v);
    }
  }
  fs.active=fs.records[n];
  const a=s.ui.playerId,active=fs.active;
  for(const v of Object.values(s.villages || {})) {
    const place=festivalPlace(s,v);if(!place)continue;
    const present=Object.keys(s.ecs.personable || {}).filter(id=>id!=a&&!s.ecs.personable[id].dead&&isResident(s,id)&&s.ecs.village?.[id]?.villageId==v.id&&near(s,id,place,300));
    if(near(s,a,place) && present.length && !active.attended[a+":"+v.id]) {
      active.attended[a+":"+v.id]={day:s.days,rewarded:[]};
      const eventById=id=>(s.events || []).find(e=>e.id==id);
      const shared=(active.kind=="autumn"?active.honours:active.kind=="winter"?active.memorials:[]).filter(id=>eventById(id)?.villageId==v.id);
      const remembered=active.kind=="winter"?shared.map(id=>eventById(id).people[0]):[];
      if(remembered.length)active.deadIds=[...new Set([...active.deadIds,...remembered])];
      recordEvent(s,"festival",[a,...present],[],{kind:active.kind,title:active.title,villageId:v.id,audienceIds:[a,...present],honouredEvents:active.kind=="autumn"?shared:[],remembered});
      for(const id of shared) {
        const event=eventById(id);
        // Named public honours and memorials disclose only the recorded fact.
        if(event)for(const who of [a,...present]) {
          learnEvent(s,who,event);
          const k=s.knowledge[who];k.people ||= {};
          k.people[event.people[0]] ||= {traits:[]};
        }
      }
    }
    const attendance=active.attended[a+":"+v.id];
    if(attendance && near(s,a,place))for(const id of present)if(!attendance.rewarded.includes(id)) {
      addGoodwill(s,a,id,2);attendance.rewarded.push(id);
    }
    if(active.kind=="summer") {
      const used=new Set();
      for(const x of present)for(const y of present)if(x<y && !used.has(x) && !used.has(y) && canCourt(s,x,y)) {
        const key=x+":"+y, together=squaredDistance(s.ecs.spatial[x],s.ecs.spatial[y])<=85**2;
        if(!together){if(active.pairStarts)delete active.pairStarts[key];continue;}
        used.add(x);used.add(y);
        active.pairStarts ||= {};active.pairStarts[key] ??= s.days;
        if(!active.contacts?.[key] && s.days-active.pairStarts[key]>=.5/24-1e-9) {
          (active.contacts ||= {})[key]=true;chatTogether(s,x,y);
        }
      }
      retryCourtships(s); // Existing consent, kin, housing and two-season rules.
    }
  }
}
export function attendFestival(s,villageId) {
  const v=s.villages?.[villageId],active=s.festivals?.active,a=s.ui.playerId;
  if(!v || !active)return false;
  const place=festivalPlace(s,v),e=s.ecs,p=e.planner[a];
  if(!place)return false;
  pauseWork(s);p.world.returnedNight=Math.floor(s.days-6/24);delete p.world.duskHome;
  // The explicit destination is the surveyed central green, never a teleport.
  const target=place.id || (s.space && Object.keys(e.walkable || {}).find(id=>near(s,id,place,10)));
  if(!target)return false;
  enqueueTask(s,{key:"move_to_here"},target);return true;
}
const PAGE_EVENTS=new Set(["birth","marriage","death","move","world_move","household_join","household_arrival","arrival","departure","return","harvest","fire","favour","festival","house_built","building_built","expansion","founding","green_moved","inheritance","succession"]);
export function seasonLines(s,n,actor=s.ui.playerId) {
  return knownEvents(s,actor).filter(e=>PAGE_EVENTS.has(e.type)&&e.day>=n*DAYS_IN_SEASON&&e.day<(n+1)*DAYS_IN_SEASON)
    .sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id)).map(e=>({id:e.id,text:eventSentence(s,e,id=>displayName(s,id,s.personName)).replace(/ in the (spring|summer|autumn|winter) of year -?\d+\.$/,".")}));
}
// Pause at dawn, after the festival night and before the new day's work.
export function seasonTurnAt(s,to) {
  if(!s.ecs.planner?.[s.ui?.playerId]?.world.ordered)return null;
  const turn=s.social?.lastTurnSeason ?? Math.floor((s.days-.25)/DAYS_IN_SEASON)-1;
  const next=Math.max(turn+1,Math.floor((s.days-.25)/DAYS_IN_SEASON));
  const boundary=(next+1)*DAYS_IN_SEASON+.25;
  if(s.days<=boundary+1e-9 && to>=boundary-1e-9) {
    s.seasonTurn={season:next,actorId:s.ui.playerId,lines:seasonLines(s,next)};
    (s.social ||= {}).lastTurnSeason=next;s.game_speed="paused";return boundary;
  }
  return null;
}
export function finishSeasonTurn(s) {s.seasonTurn=null;s.game_speed="normal";}
