import LINES from "data/conversation_lines.json";
import { nearbyRequester, reasonGone } from "game/favours";
import { hashUnit } from "game/math";
import { crossesWall } from "game/social_visibility";
import { tellNews } from "game/news";
import { canDiscloseEvent } from "game/people";

export const HEARING_REACH=120;

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
    tellNews(s,npc,viewer,event,speech.lineId,speech.namedPeople);
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
