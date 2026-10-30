import { DAYS_IN_YEAR } from "game/time";
import { fieldAtTile } from "game/land_use";

export const FULL_TRACK = 100;
export const WEAR_LIFETIME = 2 * DAYS_IN_YEAR;
const visualStep = value => Math.round(value / FULL_TRACK * 20);

function decayTile(state, id) {
  const walk = state.ecs.walkable[id];
  walk.wearUpdatedAt ??= state.environmentUpdatedAt ?? state.days;
  walk.routeWear ??= state.ecs.mappable?.[id]?.route?.length ? FULL_TRACK : 0;
  if (Object.values(walk.worn).some(value=>value>0)) walk.trackReserved = true;
  const elapsed = Math.max(0,state.days-walk.wearUpdatedAt);
  if (!elapsed) return;
  const loss = FULL_TRACK * elapsed / WEAR_LIFETIME;
  const fade = value => Math.max(0,Math.min(FULL_TRACK,value)-loss);
  let changed = visualStep(walk.routeWear) != visualStep(fade(walk.routeWear));
  walk.routeWear = fade(walk.routeWear);
  for (const key in walk.worn) {
    const before=walk.worn[key], after=fade(before);
    changed ||= visualStep(before) != visualStep(after);
    walk.worn[key]=after;
  }
  walk.wearUpdatedAt = state.days;
  if (changed) state.redraws.push(id);
}

// Elapsed game time only. Repeating an update on the same day is harmless.
export function updateRoadWear(state) {
  for (const id in state.ecs.walkable) decayTile(state,id);
}

// Actual use, including later recorded traffic, replenishes a specific track.
export function recordRoadUse(state, id, entrance, exit, amount = 1) {
  if (fieldAtTile(state,id) || entrance == null && exit == null) return false;
  decayTile(state,id);
  const walk=state.ecs.walkable[id], key=[entrance ?? "C",exit ?? "C"].sort().join(",");
  walk.worn[key]=Math.min(FULL_TRACK,(walk.worn[key] || 0)+amount);
  walk.trackReserved=true;
  if (state.ecs.mappable?.[id]?.route?.length) walk.routeWear=Math.min(FULL_TRACK,walk.routeWear+amount);
  state.redraws.push(id);
  return true;
}

// Fixed topology contributes its fading surface, never an eternal dirt overlay.
export function roadTracks(ecs, id) {
  const tracks={...ecs.walkable[id].worn}, sides=ecs.mappable[id].route || [];
  const visible=ecs.walkable[id].routeWear ?? FULL_TRACK;
  const mark=(a,b)=>{const key=[a,b].sort().join(",");tracks[key]=Math.max(tracks[key] || 0,visible);};
  if(sides.length==1) mark("C",sides[0]);
  for(let i=1;i<sides.length;i++) mark(sides[0],sides[i]);
  return tracks;
}
