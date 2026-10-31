import LINES from "data/conversation_lines.json";
import { nearbyRequester, reasonGone } from "game/favours";
import { hashUnit } from "game/math";
// World hints deliberately expose no name, request ID or relationship.
export function overheardHint(s,npc) {
  if(!s.ui?.playerId || !s.ecs.personable?.[npc])return null;
  if(s.knowledge?.[s.ui.playerId]?.people?.[npc]?.conversation || !nearbyRequester(s,npc))return null;
  const r=Object.values(s.favours?.requests||{}).find(r=>r.giverId==npc&&r.status=="offered"&&!reasonGone(s,r));
  if(!r)return null;
  const situation=r.kind=="wood"?(s.ecs.workplace[r.workplaceId]?.trade=="baker"?"wood_oven":"wood_forge"):r.kind;
  const traits=s.ecs.personality[npc]?.traits||[];
  const rows=LINES.filter(l=>l.family=="overheard_hint"&&l.situation==situation&&l.when.all.filter(p=>p.test=="has_trait").every(p=>traits.includes(p.args.trait))&&l.when.none.filter(p=>p.test=="has_trait").every(p=>!traits.includes(p.args.trait)));
  let roll=hashUnit(s.peopleSeed+":bubble:"+npc+":"+Math.floor(s.days))*rows.reduce((n,l)=>n+l.weight,0);
  return rows.find(l=>(roll-=l.weight)<0)?.text||null;
}
