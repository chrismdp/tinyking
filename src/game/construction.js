import { setTileElevation } from "game/biome_field";
import { householdStore } from "game/favours";
import { growthRecord } from "game/settlement_growth";
import { recordEvent } from "game/events";
import { buildingFootprint, canClearForBuilding, reserveBuildingClearance } from "game/tree_clearance";
import { groundForState, shelterSurface } from "game/geography";
import { Hex } from "game/hex";
import { newEntities, deleteEntity, removeFromSpace } from "game/entities";
import { topController } from "game/playable";
import { take, give } from "game/holder";
import { HOUR } from "game/time";
import { path } from "game/pathfinding";
import { hungerSpeed } from "game/hunger";
import { Task } from "game/htn";

export const STAGES = {
  "lean-to": { logs: 4, hours: 2, capacity: 8, next: "hut" },
  hut: { logs: 10, hours: 5, capacity: 20, next: "house" },
  house: { logs: 20, hours: 10, capacity: 40 }
};

export function localHome(state, actorId) {
  const ecs=state.ecs,home=ecs.household?.[actorId]?.houseId;
  if(home && ecs.spatial[home] && (ecs.building?.[home] || ecs.camp?.[home] || ecs.shelter?.[home]?.stage))return home;
  return [...Object.keys(ecs.shelter||{}).filter(id=>ecs.shelter[id].stage),...Object.keys(ecs.camp||{})]
    .find(id=>ecs.controllable[id] && topController(ecs,id)==actorId);
}
export function deliveryHome(state,actorId) {
  const home=localHome(state,actorId);
  return householdStore(state,home) || home;
}
export function canPlaceShelter(state, targetId) {
  const ecs = state.ecs;
  if (ecs.construction?.[targetId]) return false;
  if (ecs.shelter?.[targetId]) return topController(ecs, targetId) == state.ui.playerId && !!STAGES[ecs.shelter[targetId].stage].next &&
    canClearForBuilding(state, buildingFootprint(state, targetId), state.ui.playerId);
  if (ecs.mappable[targetId]?.terrain != "grassland" || ecs.mappable[targetId]?.villagePlot || ecs.mappable[targetId]?.route?.length) return false;
  if (state.map?.geography && !shelterSurface(state, ecs.spatial[targetId])) return false;
  const preview = { ecs: { spatial: { site: ecs.spatial[targetId] }, shelter: { site: {} } } };
  if (!canClearForBuilding(state, buildingFootprint(preview, "site"), state.ui.playerId)) return false;
  const hex = Hex().fromPoint(ecs.spatial[targetId]);
  const camp = Object.keys(ecs.camp || {}).find(id=>topController(ecs,id)==state.ui.playerId);
  if (!camp || hex.distance(Hex().fromPoint(ecs.spatial[camp])) > 3) return false;
  const campTile = state.space[Hex().fromPoint(ecs.spatial[camp])].find(id => ecs.mappable[id]);
  if (!path(state, campTile, targetId)) return false;
  if ([...Object.keys(ecs.shelter || {}),...Object.keys(ecs.construction || {})].some(id=>topController(ecs,id)==state.ui.playerId)) return false;
  return !(state.space[hex] || []).some(id => id != targetId &&
    (ecs.building[id] || ecs.camp?.[id] || ecs.farmable?.[id] || ecs.stockpile?.[id]));
}

export function placeShelter(state, targetId) {
  if (!canPlaceShelter(state, targetId)) return null;
  if (state.map?.geography && !state.ecs.shelter?.[targetId]) {
    const geography = shelterSurface(state, state.ecs.spatial[targetId]);
    if (!geography) return null;
    state.map.geography = geography;
    const ground = groundForState(state);
    for (const id of Object.keys(state.ecs.mappable)) setTileElevation(state,id,ground.hex(state.ecs.spatial[id]).centre);
  }
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
  reserveBuildingClearance(state, id);
  state.redraws.push(id);
  return id;
}

// Timber comes from the player's stores, never from standing trees.
export function shelterLogSource(state, actorId, reachable = () => true) {
  const ecs = state.ecs;
  const owner = topController(ecs, actorId);
  const owned = id => ecs.controllable[id] && topController(ecs, id) == owner;
  const homes = [...Object.keys(ecs.camp || {}), ...Object.keys(ecs.shelter || {}).filter(id => ecs.shelter[id].stage)].filter(owned);
  const log = Object.keys(ecs.haulable || {}).find(id => ecs.good[id]?.type == "wood" && owned(id) &&
    (ecs.haulable[id].heldBy == actorId ||
      (ecs.haulable[id].heldBy ? owned(ecs.haulable[id].heldBy) && ecs.stockpile?.[ecs.haulable[id].heldBy] :
        homes.some(home => Hex().fromPoint(ecs.spatial[home]).distance(Hex().fromPoint(ecs.spatial[id])) == 0))) && reachable(id));
  return log || Object.keys(ecs.container || {}).find(id => owned(id) && ecs.container[id].amounts.wood > 0 && reachable(id));
}

export function collectShelterLog(state, actorId, world, dt, firstRun, source) {
  const ecs = state.ecs;
  let log = source;
  if (ecs.container[source]) {
    if (!(ecs.container[source].amounts.wood > 0)) return Task.ABORT;
    if (ecs.holder[actorId].held.length >= ecs.holder[actorId].capacity) return Task.ABORT;
    ecs.container[source].amounts.wood--;
    [log] = newEntities(state, [{ spatial: { ...ecs.spatial[actorId] }, good: { type: "wood", amount: 1 },
      haulable: {}, controllable: { controllerId: topController(ecs, actorId) } }]);
  }
  if (!ecs.haulable[log]) return Task.ABORT;
  const previousHolder = ecs.haulable[log].heldBy;
  if (!give(ecs, log, actorId)) return Task.ABORT;
  removeFromSpace(state, log);
  state.redraws.push(log, actorId, source);
  if (previousHolder) state.redraws.push(previousHolder);
  return Task.FINISH;
}

export function deliverShelterLog(state, actorId, world, dt, firstRun, targetId) {
  const ecs = state.ecs;
  const site = ecs.construction?.[targetId];
  const log = ecs.holder[actorId].held.find(id => ecs.good[id]?.type == "wood");
  if (!site || !log) return Task.ABORT;
  if (site.delivered >= STAGES[site.stage].logs) return Task.FINISH;
  take(ecs, log);
  deleteEntity(state, log);
  site.delivered++;
  const job = ecs.manager[topController(ecs, actorId)].jobs.find(j => j.assignedId == actorId);
  if (job) {
    job.detail = `${site.delivered} of ${STAGES[site.stage].logs} logs`;
    job.progress = site.delivered / STAGES[site.stage].logs / 2;
  }
  state.redraws.push(targetId, actorId);
  return Task.FINISH;
}

// Workers share the site's effort total; helping leaves their own home intact.
export function workOnShelter(state, actorId, world, dt, firstRun, targetId) {
  const ecs = state.ecs;
  const site = ecs.construction?.[targetId];
  if (!site) return ecs.shelter?.[targetId]?.stage ? Task.FINISH : Task.ABORT;
  const stage = STAGES[site.stage];
  if (site.delivered < stage.logs) return Task.ABORT;
  const job = ecs.manager[topController(ecs, actorId)].jobs.find(j => j.targetId == targetId);
  site.work += dt / HOUR * hungerSpeed(ecs.personable[actorId]);
  if (job) {
    job.detail = "Building";
    job.progress = (site.delivered / stage.logs + Math.min(1, site.work / stage.hours)) / 2;
  }
  if (site.work + 1e-9 < stage.hours) return Task.CONTINUE;
  ecs.shelter[targetId].stage = site.stage;
  ecs.nameable[targetId].nickname = site.stage == "lean-to" ? "Lean-to" : site.stage == "hut" ? "Hut" : "House";
  ecs.sleepable[targetId] = { id: targetId, capacity: site.stage == "house" ? 6 : 1, level: 1, occupiers: [] };
  ecs.container[targetId] = { id: targetId, capacity: stage.capacity, amounts: ecs.container[targetId]?.amounts || {} };
  ecs.household ||= {};
  const owner = topController(ecs, targetId);
  ecs.household[owner] = { id: owner, houseId: targetId };
  for (const camp of Object.keys(ecs.camp || {})) if(topController(ecs,camp)==owner)ecs.sleepable[camp].capacity = 0;
  if(site.stage=="house") {
    (ecs.building ||= {})[targetId]={id:targetId,rooms:[],entrance:0};
    (ecs.village ||= {})[targetId] ||= {id:targetId,villageId:null};
    ecs.household[targetId] ||= {id:targetId,fields:[],backyards:[]};
    ecs.household[targetId].storeId = householdStore(state,targetId);
    growthRecord(state,targetId).construction = {timber:stage.logs,workHours:stage.hours};
    recordEvent(state,"house_built",[owner],[targetId],{houseId:targetId,timber:stage.logs,reason:"completed player construction"});
  }
  delete ecs.planner[owner].world.places.sleep;
  delete ecs.construction[targetId];
  state.redraws.push(targetId);
  return Task.FINISH;
}
