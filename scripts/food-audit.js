/* eslint-disable no-undef */
// Read-only diagnostics: permissions and routes distinguish reserves from famine.
const { householdAccess } = require("../src/game/playable");
const { path } = require("../src/game/pathfinding");
const { Hex } = require("../src/game/hex");
const foods = new Set(["grain", "gruel", "forage"]);
const portions = amounts => Object.entries(amounts || {}).reduce((n, [type, amount]) => n + (foods.has(type) ? amount : 0), 0);
function foodSummary(s) {
  const result = { stored: 0, grain: 0, gruel: 0, forage: 0, held: 0, loose: 0, wild: 0, emptyResidentHomes: [] };
  for (const c of Object.values(s.ecs.container || {})) for (const type of foods) {
    result[type] += c.amounts[type] || 0; result.stored += c.amounts[type] || 0;
  }
  for (const [id, good] of Object.entries(s.ecs.good || {})) if (foods.has(good.type)) {
    result[s.ecs.haulable[id]?.heldBy ? "held" : "loose"] += good.amount;
  }
  for (const plant of Object.values(s.ecs.forageable || {})) result.wild += plant.amount;
  const homes = new Set(Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && !s.ecs.playable?.[id]).map(id => s.ecs.household[id]?.houseId));
  for (const house of homes) {
    const stores = Object.keys(s.ecs.container || {}).filter(id => s.ecs.interior?.[id]?.buildingId == house);
    if (!stores.some(id => portions(s.ecs.container[id].amounts))) result.emptyResidentHomes.push(house);
  }
  return result;
}
function actorTrace(s, id) {
  const e = s.ecs, point = e.spatial[id], planner = e.planner[id];
  const nav = p => (s.space[Hex().fromPoint(p)] || []).find(id => e.walkable[id]);
  return structuredClone({ day: s.days, id, hunger: e.personable[id].hunger, home: e.household[id], position: { ...point },
    task: planner?.task, plan: planner?.plan, world: planner?.world,
    held: (e.holder[id]?.held || []).map(id => ({ id, good: e.good[id], ownership: e.controllable[id], heldBy: e.haulable[id]?.heldBy })),
    stores: Object.entries(e.container || {}).filter(([, c]) => portions(c.amounts)).map(([store, c]) => {
      const access = householdAccess(e, id, store);
      return { id: store, amounts: c.amounts, household: e.interior?.[store], ownership: e.controllable[store], access,
        distance: Math.hypot(point.x - e.spatial[store].x, point.y - e.spatial[store].y),
        route: access ? path(s, nav(point), nav(e.spatial[store])) : undefined };
    }), target: planner?.world.target, targetGood: e.good[planner?.world.target], targetOwnership: e.controllable[planner?.world.target] });
}
module.exports = { foodSummary, actorTrace };
