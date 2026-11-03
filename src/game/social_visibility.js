import { nearbyPeople } from "game/population_index";
import { isResident } from "game/residents";
import { buildingFootprint } from "game/tree_clearance";

export function crossesWall(s,a,b,interior) {
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

// The same witness rule serves an occurrence and later meeting moments.
export function eventWitnesses(s,people) {
  const origin=s.ecs.spatial?.[people[0]],interior=s.ecs.interior?.[people[0]]?.buildingId;
  return nearbyPeople(s,origin,85).filter(id=>{
    const p=s.ecs.planner?.[id],point=s.ecs.spatial[id];
    return !people.includes(id) && !s.ecs.personable[id]?.dead && isResident(s,id) &&
      !p?.world.sleeping && p?.task?.[0]!="sleep" && s.ecs.interior?.[id]?.buildingId==interior && !crossesWall(s,origin,point,interior);
  });
}
