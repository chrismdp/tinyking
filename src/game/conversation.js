import { Hex } from "game/hex";
import { fenceFootprints, fenceRoute } from "game/fences";
import { path } from "game/pathfinding";

// Stable separate positions, within the unchanged 85-unit speech/contact reach.
export const CONVERSATION_RADIUS = 30;
export const SPEECH_REACH = 70;
export const SPEECH_SPACING = 45;
export function conversationPositions(state, a, b) {
  const ecs=state.ecs, centre=ecs.spatial[b];
  if(!centre)return null;
  const tileAt=p=>(state.space[Hex().fromPoint(p)] || []).find(id=>ecs.walkable[id]);
  const fences=fenceFootprints(state);
  for(const angle of [0,Math.PI/3,2*Math.PI/3,Math.PI/2]) {
    const dx=Math.cos(angle)*CONVERSATION_RADIUS,dy=Math.sin(angle)*CONVERSATION_RADIUS;
    const points=[{x:centre.x-dx,y:centre.y-dy},{x:centre.x+dx,y:centre.y+dy}];
    if([a,b].every((id,i)=>{
      const from=tileAt(ecs.spatial[id]),to=tileAt(points[i]);
      return from && to && path(state,from,to) && fenceRoute(state,ecs.spatial[id],points[i],fences);
    }))return {[a]:points[0],[b]:points[1]};
  }
  return null;
}

export function speechPosition(state, actor, target) {
  const a = state.ecs.spatial[actor], b = state.ecs.spatial[target];
  if (!a || !b) return null;
  const base = Math.atan2(a.y-b.y,a.x-b.x);
  for (const turn of [0, Math.PI/3, -Math.PI/3, Math.PI]) {
    const point = { x:b.x + Math.cos(base+turn)*SPEECH_SPACING, y:b.y + Math.sin(base+turn)*SPEECH_SPACING };
    const nav = (state.space[Hex().fromPoint(point)] || []).find(id=>state.ecs.walkable[id]);
    if (nav && fenceRoute(state,a,point)) return point;
  }
  return null;
}
