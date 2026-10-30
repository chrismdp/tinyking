import { householdAccess } from "game/playable";
import { squaredDistance } from "game/math";

const FOODS = ["gruel", "grain", "forage"];
// Read actual hands and supplies; these sensors never move an actor or create food.
export function stationarySupplies(state, actor) {
  const ecs = state.ecs, point = ecs.spatial?.[actor];
  if (!point) return {};
  const near = (id, reach = 10) => ecs.spatial?.[id] && squaredDistance(point, ecs.spatial[id]) <= reach ** 2;
  const owned = id => ecs.controllable?.[id] && householdAccess(ecs, actor, id);
  let meal;
  for (const type of FOODS) {
    const held = ecs.holder?.[actor]?.held.find(id => ecs.good[id]?.type == type && ecs.good[id].amount > 0 && owned(id));
    if (held) { meal = { type, kind: "held", source: held }; break; }
    const store = Object.keys(ecs.container || {}).find(id => near(id) && owned(id) && ecs.container[id].amounts[type] > 0);
    if (store) { meal = { type, kind: "container", source: store }; break; }
    const good = Object.keys(ecs.haulable || {}).find(id => near(id) && owned(id) && ecs.good[id]?.type == type && ecs.good[id].amount > 0 && !ecs.haulable[id].reservedFor && (!ecs.haulable[id].heldBy || ecs.stockpile?.[ecs.haulable[id].heldBy]));
    if (good) {
      const holder = ecs.haulable[good].heldBy;
      meal = { type, kind: holder ? "stockpile" : "loose", source: holder ? { ...ecs.spatial[good], id: good, stockpileId: holder } : good }; break;
    }
  }
  const bed = Object.keys(ecs.sleepable || {}).find(id => near(id, 50) && owned(id) && (ecs.sleepable[id].occupiers.includes(actor) || ecs.sleepable[id].occupiers.length < ecs.sleepable[id].capacity));
  return { meal, bed };
}
