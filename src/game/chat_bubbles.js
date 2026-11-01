import LINES from "data/conversation_lines.json";
import { nearbyRequester, reasonGone } from "game/favours";
import { hashUnit } from "game/math";
import { buildingFootprint } from "game/tree_clearance";
import { tellNews } from "game/news";
import { canDiscloseEvent } from "game/people";

export const HEARING_REACH=120;
function crossesWall(s,a,b,interior) {
  const e=s.ecs,buildings=new Set([...Object.keys(e.building||{}),...Object.keys(e.shelter||{}),...Object.keys(e.workplace||{}),
    ...Object.keys(e.meetingPlace||{}).filter(id=>["alehouse","chapel"].includes(e.meetingPlace[id].kind))]);
  return [...buildings].some(id=>{
    if(id==interior)return false;
    const f=e.treeClearance?.[id] || buildingFootprint(s,id);if(!f)return false;
    const c=Math.cos(f.angle),sn=Math.sin(f.angle);
    const local=p=>({x:(p.x-f.x)*c-(p.y-f.y)*sn,y:(p.x-f.x)*sn+(p.y-f.y)*c});
    const p=local(a),q=local(b);let lo=0,hi=1;
    for(const [axis,size] of [["x",f.halfWidth],["y",f.halfDepth]]) {
      const d=q[axis]-p[axis];
      if(!d){if(Math.abs(p[axis])>size)return false;}
      else {const ends=[(-size-p[axis])/d,(size-p[axis])/d].sort((a,b)=>a-b);lo=Math.max(lo,ends[0]);hi=Math.min(hi,ends[1]);}
    }
    return hi>=lo;
  });
}
function audibleSpeech(s,npc) {
  const e=s.ecs,viewer=s.ui?.playerId,p=e.planner?.[npc],v=p?.world.social,u=v?.utterance;
  if(!u || p.task?.[0]!="socialise" || v.stage!="visiting" || s.days>=u.until || e.personable?.[npc]?.dead ||
    e.planner?.[viewer]?.task?.[0]=="sleep" || e.personable?.[viewer]?.dead)return null;
  const a=e.spatial?.[npc],b=e.spatial?.[viewer],interior=e.interior?.[npc]?.buildingId;
  if(!a||!b || (a.x-b.x)**2+(a.y-b.y)**2>HEARING_REACH**2 || interior!=e.interior?.[viewer]?.buildingId || crossesWall(s,a,b,interior))return null;
  if(u.eventId) {
    const event=(s.events||[]).find(e=>e.id==u.eventId);
    if(!event || !canDiscloseEvent(s,npc,viewer,event))return null;
  }
  return u;
}
// Simulation owns learning. Reading an above-head label is always pure.
export function updateOverhearing(s) {
  const viewer=s.ui?.playerId;if(!viewer)return;
  for(const [npc,p] of Object.entries(s.ecs.planner||{})) {
    const speech=p.world.social?.utterance;
    if(!speech)continue;
    const audible=!!audibleSpeech(s,npc);
    if(speech.audible!==audible){speech.audible=audible;s.redraws?.push(npc);}
    if(!audible || !speech.eventId || s.knowledge?.[viewer]?.events?.includes(speech.eventId))continue;
    const event=(s.events||[]).find(e=>e.id==speech.eventId);
    tellNews(s,npc,viewer,event,speech.lineId);
    const k=s.knowledge[viewer];k.people ||= {};
    for(const id of speech.namedPeople){(k.people[id] ||= {traits:[]});delete k.people[id].nameOnly;}
    s.redraws?.push(viewer,npc);
  }
}
// Need hints stay anonymous. Spoken accounts use only the speaker's facts.
export function overheardHint(s,npc) {
  if(!s.ui?.playerId || !s.ecs.personable?.[npc])return null;
  if(s.ecs.planner?.[npc]?.task?.[0]=="socialise")return audibleSpeech(s,npc)?.text||null;
  if(s.knowledge?.[s.ui.playerId]?.people?.[npc]?.conversation || !nearbyRequester(s,npc))return null;
  const r=Object.values(s.favours?.requests||{}).find(r=>r.giverId==npc&&r.status=="offered"&&!reasonGone(s,r));
  if(!r)return null;
  const situation=r.kind=="wood"?(s.ecs.workplace[r.workplaceId]?.trade=="baker"?"wood_oven":"wood_forge"):r.kind;
  const traits=s.ecs.personality[npc]?.traits||[];
  const rows=LINES.filter(l=>l.family=="overheard_hint"&&l.situation==situation&&l.when.all.filter(p=>p.test=="has_trait").every(p=>traits.includes(p.args.trait))&&l.when.none.filter(p=>p.test=="has_trait").every(p=>!traits.includes(p.args.trait)));
  let roll=hashUnit(s.peopleSeed+":bubble:"+npc+":"+Math.floor(s.days))*rows.reduce((n,l)=>n+l.weight,0);
  return rows.find(l=>(roll-=l.weight)<0)?.text||null;
}
