import { Hex } from "game/hex";
import { newEntities, deleteEntity } from "game/entities";
import { topController } from "game/playable";
import { take, give } from "game/holder";
import { HOUR } from "game/time";
import { path } from "game/pathfinding";
import { hungerSpeed } from "game/hunger";
import { Task } from "game/htn";
import { walk_to } from "game/tasks";

export const STAGES = {
  "lean-to": { logs: 4, hours: 2, capacity: 8, next: "hut" },
  hut: { logs: 10, hours: 5, capacity: 20, next: "house" },
  house: { logs: 20, hours: 10, capacity: 40 }
};

export function canPlaceShelter(state, targetId) {
  const ecs = state.ecs;
  if (ecs.construction?.[targetId]) return false;
  if (ecs.shelter?.[targetId]) return topController(ecs, targetId) == state.ui.playerId && !!STAGES[ecs.shelter[targetId].stage].next;
  if (ecs.mappable[targetId]?.terrain != "grassland") return false;
  const hex = Hex().fromPoint(ecs.spatial[targetId]);
  const camp = Object.keys(ecs.camp || {})[0];
  if (!camp || hex.distance(Hex().fromPoint(ecs.spatial[camp])) > 3) return false;
  const campTile = state.space[Hex().fromPoint(ecs.spatial[camp])].find(id => ecs.mappable[id]);
  if (!path(state, campTile, targetId)) return false;
  if (Object.keys(ecs.shelter || {}).length || Object.keys(ecs.construction || {}).length) return false;
  return !(state.space[hex] || []).some(id => id != targetId &&
    (ecs.building[id] || ecs.camp?.[id] || ecs.farmable?.[id] || ecs.stockpile?.[id] || ecs.tree?.[id]));
}

export function placeShelter(state, targetId) {
  if (!canPlaceShelter(state, targetId)) return null;
  const stage = state.ecs.shelter?.[targetId] ? STAGES[state.ecs.shelter[targetId].stage].next : "lean-to";
  let id = targetId;
  if (!state.ecs.shelter?.[id]) {
    [id] = newEntities(state, [{
      spatial: { ...state.ecs.spatial[targetId], immovable: true },
      nameable: { nickname: "Lean-to" }, shelter: { stage: null },
      controllable: { controllerId: state.ui.playerId }
    }]);
  }
  state.ecs.construction ||= {};
  state.ecs.construction[id] = { id, stage, delivered: 0, work: 0 };
  state.redraws.push(id);
  return id;
}

// One primitive keeps the shared site effort in ECS. Every worker contributes
// dt, so extra hands naturally shorten construction without resetting effort.
export function workOnShelter(state, actorId, world, dt, firstRun, targetId) {
  const ecs = state.ecs;
  const site = ecs.construction?.[targetId];
  if (!site) return Task.FINISH;
  const stage = STAGES[site.stage];
  const job = ecs.manager[topController(ecs, actorId)].jobs.find(j => j.targetId == targetId);
  const move = point => {
    const key = typeof point == "string" ? point : point.x + ":" + point.y;
    const fresh = world.deliveryTarget != key;
    world.deliveryTarget = key;
    const result = walk_to(state, actorId, world, dt, fresh, point);
    if (result == Task.FINISH) world.deliveryTarget = null;
    return result;
  };
  if (firstRun) world.deliveryTarget = null;
  if (site.delivered < stage.logs) {
    let log = ecs.holder[actorId].held.find(id => ecs.good[id]?.type == "wood");
    if (log) {
      if (move(targetId) != Task.FINISH) return Task.CONTINUE;
      take(ecs, log);
      deleteEntity(state, log);
      world.holding.wood = ecs.holder[actorId].held.some(id => ecs.good[id]?.type == "wood");
      site.delivered++;
      state.redraws.push(targetId, actorId);
    } else {
      const owned = id => topController(ecs, id) == topController(ecs, actorId);
      log = Object.keys(ecs.haulable || {}).find(id => ecs.good[id]?.type == "wood" && owned(id) &&
        (!ecs.haulable[id].heldBy || ecs.stockpile?.[ecs.haulable[id].heldBy]));
      const store = Object.keys(ecs.container || {}).find(id => owned(id) && ecs.container[id].amounts.wood > 0);
      if (!log && !store) {
        if (job) job.detail = "Waiting for logs";
        return Task.CONTINUE;
      }
      if (move(log || store) != Task.FINISH) return Task.CONTINUE;
      if (!log) {
        ecs.container[store].amounts.wood--;
        [log] = newEntities(state, [{ spatial: { ...ecs.spatial[actorId] },
          good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: topController(ecs, actorId) } }]);
      }
      const previousHolder = ecs.haulable[log].heldBy;
      if (give(ecs, log, actorId)) world.holding.wood = true;
      state.redraws.push(log, actorId);
      if (store || previousHolder) state.redraws.push(store || previousHolder);
    }
  } else {
    if (move(targetId) != Task.FINISH) return Task.CONTINUE;
    site.work += dt / HOUR * hungerSpeed(ecs.personable[actorId]);
  }
  if (job) {
    job.detail = site.delivered < stage.logs ? `${site.delivered} of ${stage.logs} logs` : "Building";
    job.progress = (site.delivered / stage.logs + Math.min(1, site.work / stage.hours)) / 2;
  }
  if (site.work + 1e-9 < stage.hours) return Task.CONTINUE;
  ecs.shelter[targetId].stage = site.stage;
  ecs.nameable[targetId].nickname = site.stage == "lean-to" ? "Lean-to" : site.stage == "hut" ? "Hut" : "House";
  ecs.sleepable[targetId] = { id: targetId, capacity: 1, level: 1, occupiers: [] };
  ecs.container[targetId] = { id: targetId, capacity: stage.capacity, amounts: ecs.container[targetId]?.amounts || {} };
  ecs.household ||= {};
  const owner = topController(ecs, targetId);
  ecs.household[owner] = { id: owner, houseId: targetId };
  for (const camp of Object.keys(ecs.camp || {})) ecs.sleepable[camp].capacity = 0;
  delete ecs.planner[owner].world.places.sleep;
  delete ecs.construction[targetId];
  state.redraws.push(targetId);
  return Task.FINISH;
}
