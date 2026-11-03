import { isAdult, LIFE_STAGES } from "game/life_stages";
import { villagePeople } from "game/population_index";
import { DAYS_IN_SEASON, day_of_season, hour_of_day, season } from "game/time";
import { recordEvent, knownEvents, learnEvent } from "game/events";
import { eventSentence } from "game/events";
import { personLabel } from "game/knowledge";
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
    const present=villagePeople(s,v.id).filter(id=>id!=a&&!s.ecs.personable[id].dead&&isResident(s,id)&&s.ecs.village?.[id]?.villageId==v.id&&near(s,id,place,300));
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
  pauseWork(s);delete p.world.fireHome;delete p.world.byFire;
  // The explicit destination is the surveyed central green, never a teleport.
  const target=place.id || (s.space && Object.keys(e.walkable || {}).find(id=>near(s,id,place,10)));
  if(!target)return false;
  enqueueTask(s,{key:"move_to_here"},target);return true;
}
const LIFE_EVENTS = new Set(["birth", "marriage", "death", "move", "world_move", "household_join", "household_arrival", "arrival", "departure", "world_visit", "return", "fire", "quarrel", "reconciliation", "founding", "inheritance", "succession"]);
const BUILD_EVENTS = new Set(["house_built", "building_built", "expansion", "green_moved"]);
function lifeSummary(s,records) {
  const event=records[0],n=records.length;
  const count=(["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"][n] || String(n));
  const people=records.map(e=>e.people[0]);
  const adults=people.every(id=>isAdult(s.ecs.personable?.[id]?.age ?? LIFE_STAGES.youngAdult.from));
  const male=people.every(id=>s.ecs.nameable?.[id]?.male===true),female=people.every(id=>s.ecs.nameable?.[id]?.male===false);
  const who=adults?(male?"men":female?"women":"people"):"people";
  const reason=event.reason=="seeking company"?"to seek company elsewhere":event.reason=="returning home"?"to return home":event.reason;
  const account={departure:`${who} left${reason ? " " + reason : " for another region"}`,
    arrival:`${who} arrived from another region`,world_visit:`${who} came from another region to meet people`,
    return:`${who} returned home`,world_move:`${who} settled in another region after marrying`,
    move:`${who} moved home`,birth:"children were born",marriage:"couples married",
    death:`${who} died${event.cause ? " of " + event.cause : ""}`,
    household_arrival:"households were established",household_join:`${who} joined new households`}[event.type];
  return account ? count+" "+account+"." : null;
}
export const SEASON_PAGE_LINES = 6;
export function seasonLines(s, n, actor = s.ui.playerId) {
  const start = n * DAYS_IN_SEASON, end = start + DAYS_IN_SEASON;
  const events = knownEvents(s, actor).filter(e => e.day >= start && e.day < end)
    .sort((a,b) => a.day-b.day || a.id.localeCompare(b.id, undefined, {numeric:true}));
  const row = (id, text, section, records) => ({id, text, section, eventIds:records.map(e=>e.id)});
  const lifeRecords=events.filter(e=>LIFE_EVENTS.has(e.type));
  const groups=new Map();
  for(const event of lifeRecords) {
    if(event.people.includes(actor))continue;
    const key=JSON.stringify([event.type,event.reason,event.cause]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(event);
  }
  const grouped=new Set(),life=[];
  for(const event of lifeRecords) {
    if(grouped.has(event.id))continue;
    const key=JSON.stringify([event.type,event.reason,event.cause]);
    const records=groups.get(key) || [];
    // A repeated record about the same person is not several people.
    const different=records.length>1 && new Set(records.flatMap(e=>e.people)).size==records.reduce((n,e)=>n+e.people.length,0);
    const summary=different && lifeSummary(s,records);
    if(summary) {
      for(const e of records)grouped.add(e.id);
      life.push(row(event.id,summary,"life",records));
    } else life.push(row(event.id,eventSentence(s,event,id=>personLabel(s,id,s.personName,actor))
      .replace(/ in the (spring|summer|autumn|winter) of year -?\d+\.$/, "."),"life",[event]));
  }
  const work = [], harvest = events.filter(e=>e.type=="harvest"), builds = events.filter(e=>BUILD_EVENTS.has(e.type));
  const favours = events.filter(e=>e.type=="favour" && e.people[0]!=actor);
  if (harvest.length) work.push(row("harvest", "The harvest came in: " + harvest.reduce((sum,e)=>sum+e.quantity,0) + " grain over " + harvest.length + (harvest.length==1 ? " load." : " loads."), "work", harvest));
  if (builds.length) work.push(row("buildings", builds.length + (builds.length==1 ? " building project was completed." : " building projects were completed."), "work", builds));
  if (favours.length) work.push(row("favours", "Neighbours completed " + favours.length + (favours.length==1 ? " favour." : " favours."), "work", favours));
  const own = events.filter(e=>e.people[0]==actor && ["festival","favour"].includes(e.type));
  const festivals = [...new Set(own.filter(e=>e.type=="festival").map(e=>e.title))];
  const helped = own.filter(e=>e.type=="favour").length;
  const met = Object.entries(s.knowledge?.[actor]?.people || {}).filter(([id,p])=>id!=actor && p.conversation?.day>=start && p.conversation.day<end && !s.ecs.personable?.[id]?.unrevealed).length;
  const personal = [];
  if (festivals.length || helped || met) {
    const parts = [...festivals.map(title=>"attended the " + title)];
    if (helped) parts.push("did " + helped + (helped==1 ? " favour" : " favours"));
    if (met) parts.push("spoke with " + met + (met==1 ? " person" : " people"));
    personal.push(row("your-season", "You " + parts.join("; ") + ".", "player", own));
  }
  // Keep work and the actor's season visible even when village life is busy.
  if (life.length + work.length + personal.length <= SEASON_PAGE_LINES) return [...life, ...work, ...personal];
  const shownLife = life.slice(0, SEASON_PAGE_LINES - work.length - personal.length - 1);
  const more = life.length - shownLife.length;
  return [...shownLife, ...work, ...personal, row("more", "And " + more + " more pieces of news.", "more", [])];
}
// Suggestions rank only personally known needs and the family names already given.
export function festivalPeople(s, candidates) {
  const a = s.ui.playerId, k = s.knowledge?.[a], relatives = s.backstories?.[a]?.relatives || [];
  const knownFavours = new Set(k?.favours || []);
  const rank = id => {
    if (k?.people?.[id] && relatives.some(r=>r.id==id) && !k?.maternalFamily?.met?.includes(id)) return 4;
    const bond = s.ecs.relationships?.[a]?.known[id];
    if (["personal","intimate"].includes(bond?.ring)) return 3;
    if (Object.values(s.favours?.requests || {}).some(r=>knownFavours.has(r.id) && r.giverId==id && ["offered","accepted"].includes(r.status))) return 2;
    return personLabel(s,id) != "a person" && (bond || k?.people?.[id] && !k.people[id].nameOnly) ? 1 : 0;
  };
  return candidates.filter(id=>!s.ecs.personable[id]?.unrevealed).sort((x,y)=>rank(y)-rank(x) || x.localeCompare(y, undefined, {numeric:true})).slice(0,4);
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
