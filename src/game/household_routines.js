import { HOUR, hour_of_day, season } from "game/time";
import { isResident } from "game/residents";

// Own this index for one synchronous planner frame. Outside that scope,
// callers retain ordinary mutable-state semantics. Claims/releases refresh it
// after each sensor and task, so later actors see earlier actors' changes.
const gardenIndexes = new WeakMap();
export function withGardenHelpIndex(state, transition) {
  const index = { gardens: new Map(), actors: new Map() };
  gardenIndexes.set(state, index);
  for (const id of Object.keys(state.ecs.planner || {})) refreshGardenHelpIndex(state, id);
  try { return transition(); }
  finally { gardenIndexes.delete(state); }
}
export function refreshGardenHelpIndex(state, actor) {
  const index = gardenIndexes.get(state);
  if (!index) return;
  const previous = index.actors.get(actor), garden = state.ecs.planner[actor]?.world.gardenHelp;
  if (previous == garden) return;
  if (previous) {
    const workers = index.gardens.get(previous);
    workers.delete(actor);
    if (!workers.size) index.gardens.delete(previous);
  }
  index.actors.set(actor, garden);
  if (garden) {
    if (!index.gardens.has(garden)) index.gardens.set(garden, new Set());
    index.gardens.get(garden).add(actor);
  }
}
function gardenOccupied(state, garden, actor) {
  const index = gardenIndexes.get(state);
  if (!index) return Object.values(state.ecs.planner || {}).some(p => p.id != actor && p.world.gardenHelp == garden);
  const workers = index.gardens.get(garden);
  return workers && (workers.size > 1 || !workers.has(actor));
}

// Gardens use the same crops, seasonal growth and harvest goods as fields.
// A short care visit adds real growth once per day, never creates a commodity.
export function gardenHelp(state, actor, childrenByHome, explicit = false) {
  const ecs = state.ecs, age = ecs.personable?.[actor]?.age;
  if (age < 6 || !explicit && ecs.playable?.[actor] || !isResident(state, actor) || season(state.days) == "winter" || hour_of_day(state.days) < 8 || hour_of_day(state.days) >= 18) return null;
  const home = ecs.household?.[actor]?.houseId;
  // Leave this light household work to a comfortable older child when one is
  // available; adults keep the fields and trades moving and cover care otherwise.
  if (age >= 18 && (childrenByHome?.get(home) || []).some(id => {
    const child = ecs.personable[id], p = ecs.planner?.[id];
    return !child.dead && child.age >= 6 && child.age < 18 && isResident(state, id) && ecs.household?.[id]?.houseId == home && p && !p.world.ordered && !p.world.capturedBy && !p.world.social && !p.world.worldJourney && child.hunger <= .9 && child.tiredness <= .9;
  })) return null;
  const gardens = (ecs.household?.[home]?.backyards || []).filter(id => ecs.backyard?.[id]?.kind == "vegetable");
  const plots = [...gardens, ...(age < 18 ? ecs.household?.[home]?.fields || [] : [])];
  return plots.find(id => ecs.farmable?.[id]?.slots.some(slot => slot.state == "sown" && slot.tendedDay != Math.floor(state.days)) &&
    !gardenOccupied(state, id, actor)) || null;
}
export const GARDEN_CARE_TIME = HOUR / 4;
export const GARDEN_GROWTH = HOUR * 3;
