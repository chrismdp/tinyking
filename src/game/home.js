import { hour_of_day } from "game/time";
import { isResident } from "game/residents";
import { squaredDistance } from "game/math";

export const nightTime = days => hour_of_day(days) >= 21 || hour_of_day(days) < 6;
export function actualHome(state, actor) {
  const ecs=state.ecs, home=ecs.household?.[actor]?.houseId;
  return isResident(state,actor) && !ecs.personable?.[actor]?.dead && (ecs.building?.[home] || ecs.shelter?.[home]?.stage == "house") && ecs.spatial?.[home] ? home : null;
}
export function leaveHome(state, actor) {
  const ecs=state.ecs;
  if (!ecs.interior?.[actor]) return;
  delete ecs.interior[actor];
  for(const bed of Object.values(ecs.sleepable || {})) bed.occupiers=bed.occupiers.filter(id=>id!=actor);
  state.redraws.push(actor);
}
export function enterHome(state, actor, place) {
  const ecs=state.ecs, home=actualHome(state,actor), building=ecs.interior?.[place]?.buildingId || place;
  if(!home || home!=building || !ecs.spatial[actor] || squaredDistance(ecs.spatial[actor],ecs.spatial[home])>=100) return false;
  ecs.interior ||= {};
  if(ecs.interior[actor]?.buildingId!=home) {ecs.interior[actor]={id:actor,buildingId:home};state.redraws.push(actor);}
  const bed=ecs.sleepable?.[place];
  if(bed && !bed.occupiers.includes(actor) && bed.occupiers.length<bed.capacity)bed.occupiers.push(actor);
  return true;
}
export function validateHome(state, actor) {
  const home=state.ecs.interior?.[actor]?.buildingId;
  if(home && (!state.ecs.spatial?.[actor] || actualHome(state,actor)!=home || squaredDistance(state.ecs.spatial[actor],state.ecs.spatial[home])>=100))leaveHome(state,actor);
}
// Lighting only reads real, still-valid occupancy. The clock cannot create it.
export function occupiedHomes(state) {
  const homes=new Set();
  if(!nightTime(state.days))return homes;
  for(const id of Object.keys(state.ecs.personable || {})) {
    const home=actualHome(state,id);
    if(home && state.ecs.interior?.[id]?.buildingId==home && squaredDistance(state.ecs.spatial[id],state.ecs.spatial[home])<100)homes.add(home);
  }
  return homes;
}
