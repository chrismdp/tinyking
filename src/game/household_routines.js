import { HOUR, hour_of_day, season } from "game/time";
import { isResident } from "game/residents";

// Gardens use the same crops, seasonal growth and harvest goods as fields.
// A short care visit adds real growth once per day, never creates a commodity.
export function gardenHelp(state, actor, childrenByHome) {
  const ecs = state.ecs, age = ecs.personable?.[actor]?.age;
  if (age < 6 || ecs.playable?.[actor] || !isResident(state, actor) || season(state.days) == "winter" || hour_of_day(state.days) < 8 || hour_of_day(state.days) >= 18) return null;
  const home = ecs.household?.[actor]?.houseId;
  if (age < 18 && ecs.planner?.[actor]?.world.lastGardenHelp?.day >= Math.floor(state.days)) return null;
  // Leave this light household work to a comfortable older child when one is
  // available; adults keep the fields and trades moving and cover care otherwise.
  if (age >= 18 && (childrenByHome?.get(home) || []).some(id => {
    const child = ecs.personable[id], p = ecs.planner?.[id];
    return !child.dead && child.age >= 6 && child.age < 18 && isResident(state, id) && ecs.household?.[id]?.houseId == home && p && !p.world.ordered && !p.world.capturedBy && !p.world.social && !p.world.worldJourney && child.hunger <= .9 && child.tiredness <= .9;
  })) return null;
  const gardens = (ecs.household?.[home]?.backyards || []).filter(id => ecs.backyard?.[id]?.kind == "vegetable");
  const plots = [...gardens, ...(age < 18 ? ecs.household?.[home]?.fields || [] : [])];
  return plots.find(id => ecs.farmable?.[id]?.slots.some(slot => slot.state == "sown" && slot.tendedDay != Math.floor(state.days)) &&
    !Object.values(ecs.planner || {}).some(p => p.id != actor && p.world.gardenHelp == id)) || null;
}
export const GARDEN_CARE_TIME = HOUR / 4;
export const GARDEN_GROWTH = HOUR * 3;
