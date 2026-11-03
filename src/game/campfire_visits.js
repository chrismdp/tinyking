import { isDependent } from "game/life_stages";
import { localHome } from "game/construction";
import { actualHome } from "game/home";
import { hashUnit, squaredDistance } from "game/math";
import { disposition } from "game/people";
import { startVillagerChat } from "game/chat";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { LOCOMOTION_RATIO } from "game/locomotion";
import { patience } from "game/chat_patience";
import { isResident } from "game/residents";

export function playerFire(s) {
  const actor=s.ui?.playerId,e=s.ecs,p=e.planner?.[actor],hour=s.days%1*24;
  if(!p || e.personable?.[actor]?.dead || hour<18 || hour>=21 || p.task?.[0]=="sleep" || p.world.currentJob=="rest" || p.world.forcedRest)return null;
  const home=s.travel?.journey?.campId || localHome(s,actor),point=e.spatial?.[home],body=e.spatial?.[actor];
  if(!point || !body || squaredDistance(point,body)>110**2 || e.interior?.[actor])return null;
  return home;
}
export function campfireVisitValid(s,visit) {
  return visit?.context?.campfire && playerFire(s)==visit.context.campfire.homeId && Math.floor(s.days)==visit.context.campfire.day;
}
export function updateCampfireVisits(s) {
  for(const p of Object.values(s.ecs.planner||{}))if(p.world.chatVisit?.context?.campfire && (!campfireVisitValid(s,p.world.chatVisit) || p.world.feeling.hungry || p.world.feeling.tired)) {
    delete p.world.chatVisit;
    if(p.task?.[0]=="chat_visit"){p.task=null;p.plan=null;}
  }
}
export function inviteToFire(s,idle) {
  const home=playerFire(s),actor=s.ui?.playerId,e=s.ecs,day=Math.floor(s.days);
  if(!home || s.chat?.active || s.social?.lastCampfireDay==day || Object.values(e.planner||{}).some(p=>p.world.chatVisit?.actorId==actor || p.world.customsVisit))return;
  // One seeded opportunity per evening; no retries after a visitor sets out.
  if(hashUnit(s.peopleSeed+":campfire:"+actor+":"+day)>=.45)return;
  const nav=p=>(s.space[Hex().fromPoint(p)]||[]).find(id=>e.walkable[id]);
  const to=nav(e.spatial[actor]);if(!to)return;
  const candidates=Object.keys(e.planner).filter(id=>{
    if(id==actor || e.playable?.[id] || e.personable[id]?.dead || isDependent(e.personable[id]?.age) || !e.personality?.[id] || !e.relationships?.[id] || !idle(e.planner[id]) || e.interior?.[id])return false;
    const bond=e.relationships[id].known[actor];
    if(bond?.goodwill<0 || s.social?.avoidance?.[[id,actor].sort().join(":")]>s.days)return false;
    const alone=!actualHome(s,id)&&!Object.keys(e.relationships[id].known).some(other=>other!=id && isResident(s,other) && e.personable[other]&&!e.personable[other].dead);
    return (alone || disposition(s,id,actor)!="hate") && patience(s,actor,id).free>=3;
  }).sort((a,b)=>{
    const friends=id=>["personal","intimate"].includes(e.relationships[id].known[actor]?.ring);
    return Number(friends(b))-Number(friends(a)) || hashUnit(s.peopleSeed+":fire_guest:"+day+":"+a)-hashUnit(s.peopleSeed+":fire_guest:"+day+":"+b);
  });
  const guest=candidates.find(id=>{
    const from=e.spatial[id]&&nav(e.spatial[id]),route=from&&path(s,from,to);
    if(!route)return false;
    const hours=route.reduce((sum,tile)=>sum+1/(e.walkable[tile.id].speed||1),0)/(10*LOCOMOTION_RATIO);
    return hours+.5<21-s.days%1*24;
  });
  if(!guest)return;
  if(startVillagerChat(s,guest,{openingFamily:"campfire",context:{campfire:{homeId:home,day}}}))s.social.lastCampfireDay=day;
}
