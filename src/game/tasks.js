import { recordProduction, recordMeetingUse, completeTradeProduction, consumeStored } from "game/settlement_growth";
import { resourcePermission, observeChop, customsVisitTarget, arriveCustoms, customsVisitFailed, openOath } from "game/village_customs";
import { speechPosition, SPEECH_REACH } from "game/conversation";
import { goalEvidence } from "game/guidance";
import { HUMAN_SPEED } from "game/locomotion";
import { fenceFootprints, fenceRevision, fenceRoute, clearFencePoint, fenceHandoffClear } from "game/fences";
import { leaveHome, enterHome, actualHome, nightTime } from "game/home";
import { recordRoadUse } from "game/road_wear";
import { designationPlants } from "game/designation";
import { canPlaceField, reserveFieldPlot, routeBlocked } from "game/land_use";
import { GARDEN_CARE_TIME, GARDEN_GROWTH } from "game/household_routines";
import { exitPoint, tileAt } from "game/travel_geometry";
import { FUEL_TRADES, FUEL_HOURS, householdStore, favourReceiver, favourCargoAvailable, requestForTask, reasonGone, releaseFavourCargo, finishFavour, favourSource } from "game/favours";
import { friendEligible, releaseFriendWork } from "game/friend_help";
import { transferPossession } from "game/possessions";
import { recordEvent } from "game/events";
import { chatTogether, canCourt } from "game/social";
import { Hex, Grid, HEX_SIZE, TRIANGLES, triangleCenters, TRIANGLE_INTERIOR_RADIUS } from "game/map";
import { path } from "game/pathfinding";
import { give, take } from "game/holder";
import * as math from "game/math";
import * as time from "game/time";
import { replan, Task } from "game/htn";
import { removeFromSpace, newEntities, deleteEntity, entitiesInSameLocation } from "game/entities";
import { topController, householdAccess } from "game/playable";
import { jobQueueFor, firstFreeJob, cancelLocalTasksForTravel } from "game/manager";
import { containerHasSpace } from "game/container";
import { forageAvailable } from "game/ecology";
import { eveningPlace } from "game/villages";
import { hungerSpeed } from "game/hunger";
import { workOnShelter, collectShelterLog, deliverShelterLog, deliveryHome } from "game/construction";
import { MAX_SUBTASKS } from "game/primitive";
import { beginInteraction, chat, askAbout, giftOptions, giftGoodwill, addGoodwill, completeConversation, spendPatience, patienceLeft } from "game/people";
import { familyConversation } from "game/family";
import { TALK_MINUTES } from "game/player";

// NOTE: no in-game action, as these are _entirely in the mind_.
export function set_label() {}
export function forget_place() {}
export function find_next_subtask() {}
export function complete_subtask() {}
export function clear_subtasks() {}

const closestSpatialTo = (state, id) => (a, b) =>
  math.squaredDistance(state.ecs.spatial[a], state.ecs.spatial[id]) -
    math.squaredDistance(state.ecs.spatial[b], state.ecs.spatial[id]);

const closestPointTo = (state, id) => (a, b) =>
  math.squaredDistance(a, state.ecs.spatial[id]) -
    math.squaredDistance(b, state.ecs.spatial[id]);

function closestNavPointTo(state, point) {
  const entities = entitiesInSameLocation(state, point).filter(e => state.ecs.walkable[e]);
  if (entities.length == 0) {
    throw "closestNavPointTo: cannot find walkable from point: " + JSON.stringify(point) + " - " + Hex().fromPoint(point) + " - " + JSON.stringify(entitiesInSameLocation(state, point));
  }
  return entities[0];
}

export function walk_to(state, actorId, world, dt, firstRun, target, { plotAccess = false, handoff = false } = {}) {
  const s = state.ecs.spatial[actorId];
  if (state.ecs.haulable?.[target]?.heldBy == actorId) return Task.FINISH;

  world.target = world.places[target] || target;

  if (!world.target) {
    // NOTE: Not passed a targetId and one isn't set for us, cannot continue
    return Task.ABORT;
  }

  let targetPoint;
  if (typeof world.target === "object" && world.target.x != null && world.target.y != null) {
    targetPoint = world.target;
  } else {
    targetPoint = state.ecs.spatial[world.target];
  }
  if (!handoff && state.ecs.personable?.[world.target] && world.capturedAttentionOf == world.target) {
    if (firstRun || world.speechTarget != world.target) {
      world.speechPoint = speechPosition(state,actorId,world.target);
      world.speechTarget = world.target;
    }
    targetPoint = world.speechPoint || targetPoint;
  }
  if (targetPoint == null) {
    delete world.places[target];
    return Task.ABORT;
  }

  if (!s) throw "walk to: Actor " + actorId + " has no spatial";
  leaveHome(state, actorId);
  const fences = fenceFootprints(state), geometry = fenceRevision(fences);
  const revision = state.landUseRevision || 0;
  if (firstRun || world.routeLandUse != revision || world.routeFences != geometry) {
    delete world.fenceWaypoints;
    world.route = path(state, closestNavPointTo(state, s), closestNavPointTo(state, targetPoint));
    world.routeLandUse = revision;
    world.routeFences = geometry;
  }

  let next = world.route && world.route[0];
  if (!world.route) return Task.ABORT;
  if (!next) {
    return Task.FINISH;
  }

  if ("exit" in next) {
    const corners = Hex().corners().map(c => c.add(state.ecs.spatial[next.id]));
    const a = corners[next.exit], b = corners[(next.exit + 1) % 6];
    // An offset yard can cover the usual edge midpoint. Cross the same tile
    // edge through an open part, rather than treating transit as pen access.
    targetPoint = [.5,.3,.7,.15,.85].map(t => math.lerp(a,b,t)).find(p => clearFencePoint(p,fences));
    if (!targetPoint) return Task.ABORT;
  }

  const segmentKey = [next.id, targetPoint.x, targetPoint.y].join(":");
  if (world.fenceSegment != segmentKey || !world.fenceWaypoints) {
    const startTile = closestNavPointTo(state,s), goalTile = closestNavPointTo(state,typeof world.target == "object" ? world.target : state.ecs.spatial[world.target]);
    const canWalk = (a,b) => {
      let previous = null;
      const count = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6));
      for (let i=0; i<=count; i++) {
        const point = math.lerp(a,b,i/count);
        const tile = (state.space[Hex().fromPoint(point)] || []).find(id=>state.ecs.walkable[id]);
        if (!tile || routeBlocked(state,tile,startTile,goalTile)) return false;
        if (previous && previous != tile && !Object.values(state.ecs.walkable[previous].neighbours).includes(tile)) return false;
        previous = tile;
      }
      return true;
    };
    world.fenceWaypoints = fenceRoute(state, s, targetPoint, fences, canWalk);
    world.fenceSegment = segmentKey;
  }
  if (!world.fenceWaypoints) return Task.ABORT;
  while (world.fenceWaypoints.length > 1 && math.squaredDistance(s, world.fenceWaypoints[0]) < .01) world.fenceWaypoints.shift();
  const detouring = world.fenceWaypoints.length > 1;
  targetPoint = world.fenceWaypoints[0] || targetPoint;

  const order = world.ordered && jobQueueFor(state.ecs, actorId).find(j => j.assignedId == actorId && j.job.key == "move_to_here");
  if (order) {
    const distance = Math.sqrt(math.squaredDistance(s, targetPoint));
    if (order.distance == null) order.distance = Math.max(1, distance);
    order.progress = Math.max(0, Math.min(1, 1 - distance / order.distance));
  }
  const terrainCost = state.ecs.walkable[next.id].speed || 1;
  // NOTE: number of hex sides per hour
  const baseHumanSpeed = HUMAN_SPEED;
  const weightCost = state.ecs.holder[actorId].held
    .map(id => state.ecs.haulable[id].speedModifier || 1)
    .reduce((result, x) => result * x, 1);
  const speed = dt * 24 * baseHumanSpeed * HEX_SIZE * terrainCost * weightCost * hungerSpeed(state.ecs.personable && state.ecs.personable[actorId]);
  let dx = targetPoint.x - s.x;
  let dy = targetPoint.y - s.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 10 && !detouring) {
    const enteringPlot = plotAccess && next.id == closestNavPointTo(state,typeof world.target == "object" ? world.target : state.ecs.spatial[world.target]);
    // Self-care releases the assignment before leaving the unfinished plot.
    // Its saved work identifies this departure; through traffic still wears it.
    const leavingPlot = next.entrance == null && world.ordered &&
      jobQueueFor(state.ecs, actorId).some(job => job.job.key == "create_field" && job.targetId == next.id && job.progress > 0 && job.progress < 1);
    // A resource work visit includes collection/haul and automatic care, but
    // only at the journey's endpoints. Crossing that tile still wears it.
    const visitingWork = (next.entrance == null || next.exit == null) && world.ordered &&
      jobQueueFor(state.ecs, actorId).some(job => job.workTileId == next.id &&
        (job.assignedId == actorId || !world.currentJob && (world.feeling?.hungry || world.feeling?.tired)));
    if (!enteringPlot && !leavingPlot && !visitingWork) {
      recordRoadUse(state,next.id,next.entrance,next.exit);
    }

    const newHex = Hex().fromPoint(state.ecs.spatial[next.id]);

    // NOTE: Discover adjacent tiles
    const neighbours = Grid.hexagon({
      radius: 2,
      center: newHex
    });
    const playable = state.ecs.playable[topController(state.ecs, actorId)];
    if (playable) { // NOTE: only explore if we're controlled by the player
      const newTiles = neighbours.filter(hex => !playable.known.find(k => hex.x === k.x && hex.y === k.y));
      playable.known = [ ...playable.known, ...newTiles ];
      newTiles.map(k => state.space[Hex(k)]).flat().forEach(e => e && state.redraws.push(e));
    }

    world.route.shift();
    delete world.fenceWaypoints;

    if (!("exit" in next)) {
      if(target=="meet" && world.target?.id)recordMeetingUse(state,world.target.id,actorId);
      return Task.FINISH;
    }
  } else {
    if (speed > length) {
      s.x = targetPoint.x;
      s.y = targetPoint.y;
    } else {
      dx /= length;
      dy /= length;
      s.x += dx * speed;
      s.y += dy * speed;
    }
  }
  return Task.CONTINUE;
}

export function take_job(state, actorId, world, dt, firstRun, key) {
  const jobs = jobQueueFor(state.ecs, actorId);
  const job = firstFreeJob(jobs, key);
  job.assignedId = actorId;
  // The tree disappears at completion; keep its actual work tile on this job
  // until delivery finishes, including any released assignment for self-care.
  if (["cut_tree_down", "forage"].includes(key) && state.ecs.spatial[job.targetId]) {
    job.workTileId = closestNavPointTo(state, state.ecs.spatial[job.targetId]);
  }
}

export function release_job(state, actorId, world, dt, firstRun, key) {
  const jobs = jobQueueFor(state.ecs, actorId);
  const idx = jobs.findIndex(j => j.job.key == key && j.assignedId == actorId);
  if (idx == -1) {
    console.log("Hang on, we are releasing a job", key,
      "but there is no job assigned to us in", actorId, " controller jobs:", jobs);
    return Task.FINISH;
  }
  jobs[idx].assignedId = null;
}


// NOTE: Not sure about using just the key - we'll have to assume we're talking
// about the first job. take_job will happen in the same frame as the plan
// though, so we're good I think.
export function complete_job(state, actorId, world, dt, firstRun, key) {
  const jobs = jobQueueFor(state.ecs, actorId);
  const idx = jobs.findIndex(j => j.job.key == key && j.assignedId == actorId);
  if (idx == -1) {
    console.log("Hang on, we are completing a job", key,
      "but there is no job assigned to us in", actorId, " controller jobs:", jobs);
    return Task.ABORT;
  }
  jobs[idx].progress = 1;
  jobs.splice(idx, 1);
  if (world.ordered) for (const job of jobs) job.failed = false;
}

export function wait_for(state, actorId, world, dt, firstRun, time) {
  if (firstRun) {
    world.wait_until = state.days + time;
  }
  if (state.days <= world.wait_until) return Task.CONTINUE;
  if (world.ordered && !world.currentJob) for (const job of jobQueueFor(state.ecs, actorId)) job.failed = false;
  return Task.FINISH;
}

// Timed work consumes effort, so a hunger change takes effect mid-task too.
function workComplete(state, actorId, world, dt, firstRun, duration) {
  if (firstRun) world.workRemaining = duration;
  const order = world.ordered && jobQueueFor(state.ecs, actorId).find(j => j.assignedId == actorId);
  if (firstRun && order && order.workRemaining != null) world.workRemaining = order.workRemaining;
  world.workRemaining -= dt * hungerSpeed(state.ecs.personable && state.ecs.personable[actorId]);
  if (order) {
    order.workRemaining = Math.max(0, world.workRemaining);
    order.progress = Math.max(0, 1 - world.workRemaining / duration);
  }
  return world.workRemaining <= 1e-12;
}

export function forage(state, actorId, world, dt, firstRun, target) {
  const targetId = world.places[target] || target;
  const plant = state.ecs.forageable && state.ecs.forageable[targetId];
  if (!forageAvailable(state, plant)) {
    delete world.places[target];
    return Task.ABORT;
  }
  const holder = state.ecs.holder[actorId];
  if (holder.held.length >= holder.capacity ||
    math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[targetId]) > 10 ** 2) return Task.ABORT;
  if (!workComplete(state, actorId, world, dt, firstRun, time.HOUR / 2)) return Task.CONTINUE;
  plant.amount--;
  plant.growth = 0;
  const [food] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[actorId] },
    nameable: { nickname: plant.kind == "berries" ? "Berries" : "Roots" },
    good: { type: "forage", amount: 1 }, haulable: {},
    controllable: { controllerId: topController(state.ecs, actorId) }
  }]);
  give(state.ecs, food, actorId);
  const order = world.ordered && jobQueueFor(state.ecs, actorId).find(j => j.assignedId == actorId && j.job.key == "forage");
  if (order) { order.gathered = [food]; order.gatheredDone = true; order.detail = "Carrying food to camp"; }
  state.redraws.push(actorId, targetId);
  return Task.FINISH;
}

const TIME_TO_DESIGNATE = time.HOUR / 3;
export function create_stockpile(state, actorId, world, dt, firstRun, targetId) {
  const plants = designationPlants(state, actorId, targetId);
  if (plants === null) return Task.ABORT;
  if (workComplete(state, actorId, world, dt, firstRun, TIME_TO_DESIGNATE)) {
    plants.forEach(id => deleteEntity(state, id));
    newEntities(state, [{
      nameable: { nickname: "Stockpile" },
      spatial: { ...state.ecs.spatial[targetId] },
      stockpile: {},
      holder: { capacity: 19, held: [] },
      controllable: { controllerId: topController(state.ecs, actorId) },
    }]).forEach(id => state.redraws.push(id));
    return Task.FINISH;
  }
  return Task.CONTINUE;
}

export function create_field(state, actorId, world, dt, firstRun, targetId) {
  const plants = designationPlants(state, actorId, targetId);
  if (plants === null || !canPlaceField(state,targetId)) return Task.ABORT;
  if (workComplete(state, actorId, world, dt, firstRun, TIME_TO_DESIGNATE)) {
    if (!reserveFieldPlot(state,targetId)) return Task.ABORT;
    plants.forEach(id => deleteEntity(state, id));
    newEntities(state, [{
      nameable: { nickname: "Field" },
      spatial: { ...state.ecs.spatial[targetId] },
      farmable: {
        slots: Array.from({ length: TRIANGLES.length }, () => ({ updated: 0, state: "empty" })),
        id: targetId,
        claimerId: null
      },
      controllable: { controllerId: topController(state.ecs, actorId) },
    }]).forEach(id => state.redraws.push(id));
    return Task.FINISH;
  }
  return Task.CONTINUE;
}

const TIME_TO_CHOP_WOOD = time.HOUR / 2;
export function chop_tree(state, actorId, world, dt, firstRun, targetId) {
  if (!state.ecs.good[targetId]) return Task.ABORT;
  const permission = resourcePermission(state, actorId, targetId);
  if (permission.kind == "private" && !permission.permitted) return Task.ABORT;
  const order = world.ordered && jobQueueFor(state.ecs, actorId).find(j => j.assignedId == actorId);
  observeChop(state, actorId, targetId, order);
  if (workComplete(state, actorId, world, dt, firstRun, TIME_TO_CHOP_WOOD)) {
    world.gathered = newEntities(state, Array.from({length: state.ecs.good[targetId].amount}, () => ({
      spatial: { ...state.ecs.spatial[targetId], immovable: false },
      nameable: { nickname: "Log" },
      good: { type: "wood", amount: 1 },
      haulable: { speedModifier: 0.5 },
      controllable: { controllerId: topController(state.ecs, actorId) }
    })));
    const order = world.ordered && jobQueueFor(state.ecs, actorId).find(j => j.assignedId == actorId);
    if (order) {
      order.gathered = world.gathered;
      // Keep the harvest amount after the tree is removed. The remaining
      // gathered ids already track delivery; no separate UI progress is stored.
      order.gatheredTotal = world.gathered.length;
      order.gatheredDone = true;
      order.detail = "Carrying logs to camp";
    }
    state.redraws.push(...world.gathered);
    deleteEntity(state, targetId);

    return Task.FINISH;
  }
  return Task.CONTINUE;
}

export function create_subtasks(state, actorId, world, dt, firstRun, target, result, candidates, lose) {
  const targetId = world.places[target] || target;
  if (!targetId) {
    // NOTE: Not passed a target and one isn't set for us, cannot continue
    return Task.ABORT;
  }

  const slots = state.ecs.farmable[targetId].slots;
  world.subtasks = triangleCenters(state.ecs.spatial[targetId])
    .map((slot, idx) => ({ ...slot, result, lose, id: targetId, idx }))
    .filter(({ idx }) => slots[idx] && candidates.includes(slots[idx].state) && (!slots[idx].workerId || slots[idx].workerId == actorId))
    .slice(0, MAX_SUBTASKS);
  for (const subtask of world.subtasks) slots[subtask.idx].workerId = actorId;
}

const SUBTASK_TIMES = {
  "ploughed": time.HOUR / 8,
  "sown": time.HOUR / 24,
  "harvested": time.HOUR / 8
};

export function claim_farmable(state, actorId, world, dt, firstRun, target) {
  const targetId = world.places[target] || target;
  if (!targetId) {
    // NOTE: Not passed a target and one isn't set for us, cannot continue
    return Task.ABORT;
  }

  if (!state.ecs.farmable[targetId]) {
    return Task.ABORT;
  }

  if (state.ecs.farmable[targetId].claimerId &&
    state.ecs.farmable[targetId].claimerId != actorId) {
    return Task.ABORT;
  }

  state.ecs.farmable[targetId].claimerId = actorId;
}

export function release_farmable(state, actorId, world, dt, firstRun, target) {
  const targetId = world.places[target] || target;
  if (!targetId) {
    // NOTE: Not passed a target and one isn't set for us, cannot continue
    return Task.ABORT;
  }

  if (!state.ecs.farmable[targetId]) {
    return Task.ABORT;
  }

  if (state.ecs.farmable[targetId].claimerId == actorId) state.ecs.farmable[targetId].claimerId = null;
  for (const slot of state.ecs.farmable[targetId].slots) if (slot.workerId == actorId) delete slot.workerId;
}

export function perform_subtask_in_slot(state, actorId, world, dt, firstRun, target, place) {
  const targetId = world.places[target] || target;
  if (!targetId) {
    // NOTE: Not passed a target and one isn't set for us, cannot continue
    return Task.ABORT;
  }

  const order = world.ordered && jobQueueFor(state.ecs, actorId).find(j => j.assignedId == actorId);
  const request = requestForTask(state, order);
  const assisting = request?.status == "accepted" || world.helpingFriend;
  const subtask = world.places[place];
  const farm = state.ecs.farmable?.[targetId], slot = farm?.slots[subtask?.idx];
  if (!slot || (slot.workerId && slot.workerId != actorId)) return Task.ABORT;
  const candidates = { harvested: ["harvestable"], ploughed: ["empty", "harvested", "rotten"], sown: ["ploughed"] };
  if (!candidates[subtask.result]?.includes(slot.state)) return Task.FINISH;
  if (assisting && math.squaredDistance(state.ecs.spatial[actorId], subtask) > 100) return Task.ABORT;
  slot.workerId = actorId;
  if (workComplete(state, actorId, world, dt, firstRun, SUBTASK_TIMES[subtask.result])) {
    // Consume seed at the actual transition. A meal/replan cannot consume it
    // twice or leave a sown slot waiting for somebody else's old plan.
    if (subtask.lose) {
      const id = state.ecs.holder[actorId].held.find(e => state.ecs.good[e]?.type == subtask.lose && householdAccess(state.ecs, actorId, e));
      if (!id) return Task.ABORT;
      take(state.ecs, id); deleteEntity(state, id);
    }
    slot.state = subtask.result;
    delete slot.workerId;
    if (subtask.result == "harvested") {
      const goods = newEntities(state, Array.from({ length: slot.amount }, () => ({
        spatial: { x: subtask.x, y: subtask.y, immovable: false },
        good: { type: slot.content, amount: 1 }, haulable: { heldBy: null },
        ...(assisting && farm.houseId ? { household: { houseId: farm.houseId } } : {}),
        controllable: { controllerId: topController(state.ecs, assisting ? targetId : actorId) }
      })));
      state.redraws.push(...goods);
      if (farm.houseId) recordProduction(state,farm.houseId,actorId,slot.content,goods.length);
      if (request?.status == "accepted" && request.kind == "harvest" && request.targetId == targetId) {
        for (const id of goods) state.ecs.haulable[id].reservedFor = actorId;
        request.progress++; request.produced += goods.length; request.cargo.push(...goods);
      }
    } else if (subtask.lose) slot.content = subtask.lose;
    slot.updated = state.days;
    slot.growth = 0;
    state.redraws.push(targetId);
    return Task.FINISH;
  }

  return Task.CONTINUE;
}

export function drop_entity_into_stockpile_slot(state, actorId, world, dt, firstRun, place, type) {
  const stockpileId = world.places[place].id;
  const space = state.space[Hex().fromPoint(state.ecs.spatial[stockpileId])];
  if (space.some(e => math.squaredDistance(world.places[place], state.ecs.spatial[e]) <
    TRIANGLE_INTERIOR_RADIUS * TRIANGLE_INTERIOR_RADIUS)) {
    // NOTE: Someone has already taken this slot - replan
    world.places[place] = null;
    return Task.ABORT;
  }

  const droppedId = state.ecs.holder[actorId].held
    .find(e => state.ecs.good[e] && state.ecs.good[e].type == type);

  if (!droppedId) { world.holding[type] = false; return Task.ABORT; }
  if (!give(state.ecs, droppedId, stockpileId)) {
    world.places[place] = null;
    return Task.ABORT;
  }

  state.ecs.spatial[droppedId].x = world.places[place].x;
  state.ecs.spatial[droppedId].y = world.places[place].y;
  space.push(droppedId);

  state.redraws.push(actorId);
  state.redraws.push(stockpileId);
}

export function drop_entity_into_container(state, actorId, world, dt, firstRun, place, type, itemId) {
  const containerId = world.places[place];
  if (!containerHasSpace(state.ecs.container[containerId])) {
    // NOTE: Someone has already taken this slot - replan
    world.places[place] = null;
    return Task.ABORT;
  }

  const droppedId = itemId || state.ecs.holder[actorId].held
    .find(e => state.ecs.good[e] && state.ecs.good[e].type == type);

  if (!droppedId || state.ecs.haulable[droppedId]?.heldBy != actorId) { world.holding[type] = false; return Task.ABORT; }
  if (state.ecs.possession?.[droppedId]) {
    take(state.ecs, droppedId);
    state.ecs.possession[droppedId].carried = true;
    world.holding[type] = false;
    return Task.FINISH;
  }
  take(state.ecs, droppedId);
  deleteEntity(state, droppedId);
  if (state.ecs.container[containerId].amounts[type]) {
    state.ecs.container[containerId].amounts[type] += 1;
  } else {
    state.ecs.container[containerId].amounts[type] = 1;
  }

  state.redraws.push(actorId);
  state.redraws.push(containerId);
}

export function pick_up_entity_with_good(state, actorId, world, dt, firstRun, place) {
  const targetId = world.places[place];
  if (!targetId) {
    return Task.ABORT;
  }

  if (!state.ecs.haulable[targetId] || state.ecs.haulable[targetId].heldBy) {
    // NOTE: someone else has already picked this up!
    world.places[place] = null;
    return Task.ABORT;
  }

  if (math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[targetId]) > 10 * 10) {
    console.error("Error", actorId, " pick_up_entity: not close enough to " + targetId);
    return Task.ABORT;
  }

  if (!give(state.ecs, targetId, actorId)) return Task.ABORT;

  state.redraws.push(actorId);
  state.redraws.push(targetId);
}

export function pick_up_from_stockpile(state, actorId, world, dt, firstRun, place) {
  const slot = world.places[place];
  if (!slot) {
    return Task.ABORT;
  }

  if (!state.ecs.haulable[slot.id] || state.ecs.haulable[slot.id].heldBy != slot.stockpileId) {
    // NOTE: someone else has already picked this up!
    delete world.places[place];
    return Task.ABORT;
  }

  if (math.squaredDistance(state.ecs.spatial[actorId], slot) > 10 * 10) {
    throw actorId + " pick_up_entity: not close enough to " + JSON.stringify(slot);
  }

  if (!give(state.ecs, slot.id, actorId)) return Task.ABORT;

  removeFromSpace(state, slot.id);

  state.redraws.push(actorId);
  state.redraws.push(slot.stockpileId);
}

const FIND_PLACE_DELAY = time.HOUR * 4;

export function find_place(state, actorId, world, dt, firstRun, type, filter, filterParam) {
  let found_place;

  if (filter == "allows_sleep") {
    const available_in_realm = Object.keys(state.ecs.sleepable).filter(id =>
      householdAccess(state.ecs, actorId, id) &&
      state.ecs.sleepable[id].occupiers.length < state.ecs.sleepable[id].capacity);
    const home = actualHome(state, actorId);
    const ownBed = available_in_realm.find(id => state.ecs.interior?.[id]?.buildingId == home);
    available_in_realm.sort(closestSpatialTo(state, actorId));
    found_place = ownBed || available_in_realm[0];
  } else if (filter == "forage_plant") {
    const reached = new Set();
    const queue = [closestNavPointTo(state, state.ecs.spatial[actorId])];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      if (reached.has(id)) continue;
      reached.add(id);
      queue.push(...Object.values(state.ecs.walkable[id].neighbours).filter(id => !reached.has(id)));
    }
    const available = Object.keys(state.ecs.forageable || {}).filter(id =>
      forageAvailable(state, state.ecs.forageable[id]) && reached.has(closestNavPointTo(state, state.ecs.spatial[id])));
    available.sort(closestSpatialTo(state, actorId));
    found_place = available[0];
  } else if (filter == "container_with") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    const available_in_realm = Object.keys(state.ecs.container || {}).filter(id =>
      householdAccess(state.ecs, actorId, id) &&
      state.ecs.container[id].amounts[filterParam] > 0);
    available_in_realm.sort(closestSpatialTo(state, actorId));
    found_place = available_in_realm[0];
  } else if (filter == "container_with_space") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    const available_in_realm = Object.keys(state.ecs.container || {}).filter(id =>
      householdAccess(state.ecs, actorId, id) &&
      containerHasSpace(state.ecs.container[id]));
    available_in_realm.sort(closestSpatialTo(state, actorId));
    found_place = available_in_realm[0];
  } else if (filter == "stockpile_slot_with") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    const available = Object.keys(state.ecs.stockpile || {})
      .filter(id => householdAccess(state.ecs, actorId, id))
      .map(id => !state.ecs.holder[id] ? [] :
        (state.ecs.holder[id].held
          .filter(h =>
            state.ecs.good[h] &&
            state.ecs.good[h].type == filterParam)
          .map(h => ({
            x: state.ecs.spatial[h].x,
            y: state.ecs.spatial[h].y,
            id: h,
            stockpileId: id
          })))).flat();
    available.sort(closestPointTo(state, actorId));
    found_place = available[0];
  } else if (filter == "stockpile_open_slot") {
    const available_in_realm = Object.keys(state.ecs.stockpile || {}).filter(id =>
      householdAccess(state.ecs, actorId, id));
    const points = available_in_realm.map(id => {
      if (state.ecs.interior[id]) {
        return (state.ecs.holder[id].held.length < state.ecs.holder[id].capacity) ?
          state.ecs.spatial[id] : null;
      }
      const space = state.space[Hex().fromPoint(state.ecs.spatial[id])];
      return triangleCenters(state.ecs.spatial[id])
        .filter(point => !space.some(e =>
          math.squaredDistance(point, state.ecs.spatial[e]) <
          TRIANGLE_INTERIOR_RADIUS * TRIANGLE_INTERIOR_RADIUS))
        .map(p => ({ ...p, id }));
    }).flat().filter(p => p);
    points.sort(closestPointTo(state, actorId));
    // NOTE: Set the X/Y to the found_place (as move_to can now handle coords).
    found_place = points[0];
  } else if (filter == "haulable_with_good") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    let available = [];
    if (state.ecs.haulable) {
      available = Object.keys(state.ecs.haulable).filter(id =>
        householdAccess(state.ecs, actorId, id) &&
        state.ecs.good[id] &&
        state.ecs.good[id].type == filterParam &&
        !state.ecs.haulable[id].heldBy && (!state.ecs.haulable[id].reservedFor || state.ecs.haulable[id].reservedFor == actorId));
    }
    available.sort(closestSpatialTo(state, actorId));
    found_place = available[0];
  } else if (filter == "farmable_slot_with") {
    let available = [];
    if (state.ecs.farmable) {
      available = Object.keys(state.ecs.farmable).filter(id =>
        (!state.ecs.farmable[id].claimerId || state.ecs.farmable[id].claimerId == actorId) &&
        householdAccess(state.ecs, actorId, id) &&
        state.ecs.farmable[id].slots.some(s => filterParam.includes(s.state)));
    }
    available.sort(closestSpatialTo(state, actorId));
    found_place = available[0];
  } else if (filter == "space" && time.hour_of_day(state.days) >= 18 && time.hour_of_day(state.days) < 21 && eveningPlace(state, actorId)) {
    found_place = eveningPlace(state, actorId);
  } else if (filter == "space") {
    const spiral = Grid.spiral({
      center: Hex().fromPoint(state.ecs.spatial[actorId]),
      radius: 3
    });
    spiral.shift();
    const options = spiral
      .filter(hex => state.space[hex] && state.space[hex].length == 1)
      .map(hex => state.space[hex].find(e => state.ecs.walkable[e] && state.ecs.walkable[e].speed >= 0.5))
      .filter(e => e);

    if (options.length > 0) {
      found_place = options[Math.floor(math.hashUnit((state.map && state.map.seed || 0) + ":meet:" + actorId + ":" + state.days) * options.length)];
    } else {
      found_place = state.space[Hex().fromPoint(state.ecs.spatial[actorId])].find(e => state.ecs.walkable[e]);
    }
  } else {
    throw "Don't know how to find a place for '" + filter + "'";
  }

  if (!found_place) {
    // NOTE: Prevent AI from looking again this hour
    world.no_place_for[type] = (world.days || 0) + FIND_PLACE_DELAY;
    return Task.ABORT;
  }

  world.places[type] = found_place;
  world.no_place_for[type] = null;
}

// NOTE: compensate for getting tireder through sleep
const SLEEP_REPLENISH = 3 * 1.3333;

export function sleep(state, actorId, world, dt) {
  const person = state.ecs.personable[actorId];
  enterHome(state, actorId, world.places.sleep);
  person.tiredness -= dt * SLEEP_REPLENISH;
  return (person.tiredness >= 0.1 || time.time(world.days) == "night") ? Task.CONTINUE : Task.FINISH;
}

export function pick_up_from_container(state, actorId, world, dt, firstRun, place, thing) {
  const containerId = world.places[place];
  if (!containerId) {
    return Task.ABORT;
  }

  if (!(state.ecs.container[containerId].amounts[thing] > 0)) {
    delete world.places[place];
    return Task.ABORT;
  }
  const holder = state.ecs.holder[actorId];
  if (holder.held.length >= holder.capacity) return Task.ABORT;
  state.ecs.container[containerId].amounts[thing] -= 1;

  const s = state.ecs.spatial[actorId];
  const [ good ] = newEntities(state, [{
    good: { type: thing, amount: 1 },
    haulable: { heldBy: null },
    spatial: { x: s.x, y: s.y },
    controllable: { controllerId: topController(state.ecs, actorId) },
  }]);
  give(state.ecs, good, actorId);
}

export function eat(state, actorId, world, dt, firstRun, thing) {
  if (firstRun) {
    const holder = state.ecs.holder[actorId];
    const id = holder.held.find(e => state.ecs.good[e]?.type == thing && (!state.ecs.controllable[e] || householdAccess(state.ecs, actorId, e)));
    if (!id) {
      world.holding[thing] = false;
      return Task.ABORT;
    }
    take(state.ecs, id, null);
    deleteEntity(state, id);
    world.mealRemaining = time.HOUR;
  }

  world.mealRemaining -= dt;
  if (world.mealRemaining > 1e-12) return Task.CONTINUE;
  state.ecs.personable[actorId].hunger = 0;
  state.ecs.personable[actorId].starving = false;
  return Task.FINISH;
}

export function get_attention(state, actorId, world, dt, firstRun, targetId) {
  const target = state.ecs.planner[targetId];
  if (!target) {
    throw "Cannot get_attention for non-planner " + targetId;
  }
  replan(target);
  target.world.capturedBy = actorId;
}

export function release_attention(state, actorId, world, dt, firstRun, targetId) {
  const target = state.ecs.planner[targetId];
  if (!target) {
    throw "Cannot release_attention for non-planner " + targetId;
  }
  replan(target);

  if (target.world.capturedBy) {
    replan(state.ecs.planner[targetId]);
  }

  target.world.capturedBy = null;
}

export function collect_gift(state, actorId, world, dt, firstRun, sourceId, type) {
  const ecs = state.ecs;
  if (ecs.personable[actorId]?.dead) return Task.ABORT;
  const available = giftOptions(state, actorId).find(g => g.sourceId == sourceId && g.type == type);
  const personal = ecs.possession?.[sourceId];
  const held = ecs.haulable?.[sourceId]?.heldBy == actorId;
  if (personal && personal.ownerId == actorId) {
    if (ecs.holder[actorId].held.length >= ecs.holder[actorId].capacity) return Task.ABORT;
    const order = jobQueueFor(ecs, actorId).find(j => j.assignedId == actorId);
    order.giftItem = sourceId;
    personal.carried = false;
    give(ecs, sourceId, actorId);
    return Task.FINISH;
  }
  if (!available || (!held && math.squaredDistance(ecs.spatial[actorId], ecs.spatial[sourceId]) > 100)) return Task.ABORT;
  const order = jobQueueFor(ecs, actorId).find(j => j.assignedId == actorId);
  if ((!held || ecs.good[sourceId].amount > 1) && ecs.holder[actorId].held.length >= ecs.holder[actorId].capacity) return Task.ABORT;
  let itemId = sourceId;
  if (ecs.container?.[sourceId] || ecs.good[sourceId].amount > 1) {
    if (ecs.container?.[sourceId]) ecs.container[sourceId].amounts[type]--;
    else ecs.good[sourceId].amount--;
    [itemId] = newEntities(state, [{ spatial: { ...ecs.spatial[actorId] }, good: { ...available, sourceId: undefined, amount: 1, type },
      haulable: {}, controllable: { controllerId: actorId } }]);
  }
  if (!held || itemId != sourceId) give(ecs, itemId, actorId);
  removeFromSpace(state, itemId);
  order.giftItem = itemId;
  state.redraws.push(itemId, actorId, sourceId);
  return Task.FINISH;
}

export function talk(state, actorId, world, dt, firstRun, personId, key, aboutId) {
  const ecs = state.ecs;
  if (ecs.personable[actorId]?.dead || !ecs.personable[personId] || ecs.personable[personId].dead) return Task.ABORT;
  if (ecs.interior?.[personId]?.buildingId != ecs.interior?.[actorId]?.buildingId) return Task.ABORT;
  // Attention asks the other planner to wait. If they were already walking,
  // finish approaching their current position before spending conversation time.
  const reach = key == "give_gift" ? 10 : SPEECH_REACH;
  if (math.squaredDistance(ecs.spatial[actorId], ecs.spatial[personId]) > reach ** 2) return Task.ABORT;
  // Recheck the physical handoff on every work tick, including completion.
  if (key == "give_gift" && !fenceHandoffClear(state, ecs.spatial[actorId], ecs.spatial[personId])) return Task.ABORT;
  if (!workComplete(state, actorId, world, dt, firstRun, TALK_MINUTES[key] / 1440)) return Task.CONTINUE;
  let result;
  if (["court", "marry", "play", "invite_home"].includes(key)) result = familyConversation(state,actorId,personId,key);
  if (["village_oath", "village_leave"].includes(key)) {
    result = openOath(state, actorId, personId, key == "village_leave");
    if (result.ok) return Task.CONTINUE;
  }
  if (key == "chat") result = chat(state, actorId, personId);
  if (key == "ask_about") result = askAbout(state, actorId, personId, aboutId);
  if (key == "give_gift") {
    const order = jobQueueFor(ecs, actorId).find(j => j.assignedId == actorId);
    const itemId = order.giftItem, item = ecs.good[itemId];
    if (!item || ecs.haulable[itemId]?.heldBy != actorId) return Task.ABORT;
    beginInteraction(state, actorId, personId);
    const goodwill = giftGoodwill(state, actorId, personId, item);
    take(ecs, itemId);
    ecs.controllable[itemId].controllerId = personId;
    if (ecs.possession?.[itemId]) {
      transferPossession(state, itemId, personId, "gift", actorId);
    } else recordEvent(state, "gift", [actorId, personId], [itemId]);
    if (!ecs.possession?.[itemId] && give(ecs, itemId, personId)) ecs.planner[personId].world.holding[item.type] = true;
    else if (!ecs.possession?.[itemId]) {
      ecs.spatial[itemId] = { ...ecs.spatial[personId], id: itemId };
      state.space[Hex().fromPoint(ecs.spatial[itemId])].push(itemId);
    }
    addGoodwill(state, actorId, personId, goodwill);
    state.redraws.push(personId, actorId, itemId);
    completeConversation(state, actorId, personId);
    result = { ok: true };
  }
  state.ui.talkResult = { personId, message: result.message || (key == "ask_about" ? "They shared family news and their feelings." : key == "chat" ? "You spent some time together." : "They accepted your gift.") };
  return Task.FINISH;
}

export const work_shelter = workOnShelter;
export const collect_log = collectShelterLog;
export const deliver_log = deliverShelterLog;

export function carry_home(state, actorId, world, dt, firstRun) {
  if (!world.ordered) return Task.FINISH;
  const ecs = state.ecs;
  const home = deliveryHome(state,actorId);
  if (!home) return Task.FINISH;
  if (firstRun) world.carryTarget = null;
  // An interrupted favour can leave another household's crop in hand.
  // Gathering carries only goods the player can actually use, keeping that
  // borrowed cargo for its own household delivery. Unique gifts stay in hand;
  // they can never become camp commodity amounts.
  const held = ecs.holder[actorId].held.find(id => !ecs.possession?.[id] && householdAccess(ecs, actorId, id));
  const order = jobQueueFor(ecs, actorId).find(j => j.assignedId == actorId);
  const gathered = order?.gathered || world.gathered || [];
  const next = held || gathered.find(id => ecs.haulable[id] && !ecs.haulable[id].heldBy);
  if (!next) { world.gathered = []; return Task.FINISH; }
  const target = held ? home : next;
  const result = walk_to(state, actorId, world, dt, world.carryTarget != target, target);
  world.carryTarget = target;
  if (result == Task.ABORT) world.carryTarget = null;
  if (result != Task.FINISH) return result;
  world.carryTarget = null;
  if (!held) {
    if (!give(ecs, next, actorId)) return Task.ABORT;
    state.redraws.push(next, actorId);
  } else {
    const type = ecs.good[held].type;
    const container = ecs.container[home];
    take(ecs, held);
    if (container && containerHasSpace(container)) {
      container.amounts[type] = (container.amounts[type] || 0) + 1;
      deleteEntity(state, held);
    } else {
      Object.assign(ecs.spatial[held], { x: ecs.spatial[home].x + 22, y: ecs.spatial[home].y + 16 });
      state.redraws.push(held);
    }
    world.gathered = gathered.filter(id => id != held);
    if (order) order.gathered = world.gathered;
    world.holding[type] = ecs.holder[actorId].held.some(id => ecs.good[id]?.type == type);
    state.redraws.push(home, actorId);
  }
  return Task.CONTINUE;
}

export function trade_work(state, actorId, world, dt, firstRun, workplaceId) {
  if (!state.ecs.workplace?.[workplaceId] || time.hour_of_day(state.days) >= 17 || time.hour_of_day(state.days) < 8) return Task.FINISH;
  if (math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[workplaceId]) > 12 ** 2) return Task.ABORT;
  const w = state.ecs.workplace[workplaceId];
  if (FUEL_TRADES[w.trade]) {
    if (!(w.fuelHours > 0)) {
      if (!consumeStored(state, w.houseId, "wood", 1, householdStore(state, w.houseId))) return Task.ABORT;
      w.fuelHours = FUEL_HOURS;
    }
    const hours = Math.min(w.fuelHours, dt / time.HOUR * hungerSpeed(state.ecs.personable[actorId]));
    w.fuelHours -= hours;
    w.workHours = (w.workHours || 0) + hours;
  }
  if (!workComplete(state, actorId, world, dt, firstRun, time.HOUR / 2)) return Task.CONTINUE;
  completeTradeProduction(state,workplaceId,actorId);
  return Task.FINISH;
}

export function socialise(state, actorId, world, dt, firstRun, partnerId) {
  const v = world.social, other = state.ecs.planner[partnerId]?.world.social;
  if (!v || v.stage == "returning" || !other || other.stage == "returning" || other.capturedBy || state.ecs.planner[partnerId]?.world.capturedBy || state.ecs.personable[partnerId]?.dead || world.feeling.hungry || world.feeling.tired || state.days >= v.expires) return Task.FINISH;
  if (math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[partnerId]) > 85 ** 2) return v.visitor ? Task.FINISH : Task.CONTINUE;
  if (v.stage != "visiting") {
    v.started = other.started ?? state.days; other.started = v.started;
    v.stage = "visiting"; v.courting = canCourt(state, actorId, partnerId);

  }
  const conversations = Math.max(v.conversations || 0, other.conversations || 0);
  if (state.days - v.started < (conversations + 1) * 0.5 / 24) return Task.CONTINUE;
  if (!patienceLeft(state, actorId, partnerId) || !patienceLeft(state, partnerId, actorId)) return Task.FINISH;
  if (!chatTogether(state, actorId, partnerId)) return Task.FINISH;
  if (!conversations) {
    state.social.lastVisits ||= {};
    state.social.lastVisits[[actorId, partnerId].sort().join(":")] = Math.floor(state.days);
    const visitor = v.visitor ? actorId : partnerId, host = v.visitor ? partnerId : actorId;
    recordEvent(state, "visit", [visitor, host], [], { fromVillage: state.ecs.village[visitor]?.villageId, toVillage: state.ecs.village[host]?.villageId });
  }
  for (const [a, b] of [[actorId, partnerId], [partnerId, actorId]]) {
    spendPatience(state, a, b); beginInteraction(state, a, b); completeConversation(state, a, b);
  }
  v.conversations = other.conversations = conversations + 1;
  v.courting = other.courting = canCourt(state, actorId, partnerId);
  // Close partners can spend longer together, within their actual daily patience.
  if (v.conversations < (v.courting ? 5 : 3)) return Task.CONTINUE;
  return Task.FINISH;
}

export function arrive_home() {}
export function return_from_visit() {}
export function end_visit() {}


// An accepted favour advances through ordinary walking, collection, crop work
// and household storage. Persistent cargo IDs survive meals and reordered work.
export function do_favour(state, actorId, world, dt, firstRun, requestId) {
  const ecs = state.ecs, r = state.favours?.requests[requestId];
  if (firstRun && r) r.working = false;
  if (!r || r.status != "accepted" || r.actorId && r.actorId != actorId || ecs.personable[actorId]?.dead) return Task.ABORT;
  const gone = reasonGone(state, r);
  if (gone) { r.status = "expired"; r.outcome = gone + " · no goodwill"; releaseFavourCargo(state, r); return Task.ABORT; }
  const order = jobQueueFor(ecs, actorId).find(j => j.assignedId == actorId);
  const store = householdStore(state, r.householdId);
  const receiver = favourReceiver(state, r);
  const walk = target => {
    const key = typeof target == "object" ? target.x + "," + target.y : target;
    const result = walk_to(state, actorId, world, dt, world.favourWalk != key || firstRun, target);
    world.favourWalk = result == Task.FINISH ? null : key;
    return result;
  };
  r.cargo = r.cargo.filter(id => favourCargoAvailable(state, r, id));
  const cargo = r.cargo[0];
  if (cargo) {
    const holder = ecs.haulable[cargo].heldBy;
    if (holder && holder != actorId) { order.detail = "Harvest cargo no longer available"; return Task.ABORT; }
    const result = walk(holder == actorId ? receiver : cargo);
    if (result != Task.FINISH) return result;
    const target = ecs.spatial[holder == actorId ? receiver : cargo];
    if (math.squaredDistance(ecs.spatial[actorId], target) > 100 || !fenceHandoffClear(state, ecs.spatial[actorId], target)) return Task.ABORT;
    if (!holder) {
      if (!give(ecs, cargo, actorId)) return Task.ABORT;
      removeFromSpace(state, cargo); state.redraws.push(cargo, actorId);
      order.detail = "Carrying the family harvest home";
      return Task.CONTINUE;
    }
    const type = ecs.good[cargo].type, amount = ecs.good[cargo].amount;
    const fromId = topController(ecs, cargo), use = receiver == r.workplaceId ? "fuel" : "stored";
    if (use == "fuel") {
      // The one physical owned log is consumed here, never added beyond store
      // capacity. No fuel is credited until real custody and reach pass above.
      if (type != "wood" || amount != 1) return Task.ABORT;
      take(ecs, cargo); deleteEntity(state, cargo);
      ecs.workplace[receiver].fuelHours = FUEL_HOURS;
      state.redraws.push(actorId, receiver);
    } else {
      if (!containerHasSpace(ecs.container[store])) return Task.ABORT;
      world.places.favourStore = store;
      if (drop_entity_into_container(state, actorId, world, dt, true, "favourStore", type, cargo) == Task.ABORT) return Task.ABORT;
    }
    (r.receipts ||= []).push({ itemId: cargo, fromId, targetId: receiver, type, amount, use, day: state.days });
    const account = ecs.household[r.householdId].estateAccount;
    if (account) {
      account.received ||= {};
      account.received[type] = (account.received[type] || 0) + amount;
      if (use == "fuel") account.consumed[type] = (account.consumed[type] || 0) + amount;
    }
    world.holding[type] = ecs.holder[actorId].held.some(id => ecs.good[id]?.type == type && householdAccess(ecs, actorId, id));
    r.cargo.shift(); r.delivered += amount;
    if (r.kind != "harvest") r.progress += amount;
    order.detail = use == "fuel" ? `Log delivered · ${FUEL_HOURS} hours of workplace fuel` :
      `${r.progress}/${r.quantity} ${r.kind == "harvest" ? "patches harvested" : "delivered"} · ${r.delivered} carried home`;
    order.progress = r.progress / r.quantity;
    if (finishFavour(state, r)) return Task.FINISH;
    return Task.CONTINUE;
  }
  if (finishFavour(state, r)) return Task.FINISH;
  if (r.kind == "harvest") {
    if (r.progress >= r.quantity) { order.detail = "Harvest cargo no longer available"; return Task.ABORT; }
    const farm = ecs.farmable?.[r.targetId];
    if (!farm || claim_farmable(state, actorId, world, dt, true, r.targetId) == Task.ABORT) return Task.ABORT;
    world.claimedFarmable = r.targetId;
    if (r.slot == null || farm.slots[r.slot]?.state != "harvestable") {
      r.slot = farm.slots.findIndex(slot => slot.state == "harvestable" && (!slot.workerId || slot.workerId == actorId));
      delete order.workRemaining;
    }
    if (r.slot < 0) return Task.ABORT;
    farm.slots[r.slot].workerId = actorId;
    const point = { ...triangleCenters(ecs.spatial[r.targetId])[r.slot], idx: r.slot, id: r.targetId, result: "harvested" };
    world.places.favourSlot = point;
    const result = walk(point);
    if (result != Task.FINISH) return result;
    const work = perform_subtask_in_slot(state, actorId, world, dt, !r.working || firstRun, r.targetId, "favourSlot");
    r.working = work == Task.CONTINUE;
    if (work == Task.ABORT) return work;
    if (work == Task.FINISH) {
      r.slot = null; delete order.workRemaining;
      release_farmable(state, actorId, world, dt, true, r.targetId); world.claimedFarmable = null;
    }
    return Task.CONTINUE;
  }
  const source = favourSource(state, r);
  if (!source) return Task.ABORT;
  if (ecs.haulable?.[source.sourceId]?.heldBy != actorId) {
    const result = walk(source.sourceId);
    if (result != Task.FINISH) return result;
  }
  const result = collect_gift(state, actorId, world, dt, true, source.sourceId, source.type);
  if (result == Task.ABORT) return result;
  r.cargo.push(order.giftItem); delete order.giftItem;
  world.holding[source.type] = true;
  order.detail = `Carrying ${source.type} to the household`;
  return Task.CONTINUE;
}

export function begin_friend_help(state, actorId, world, dt, firstRun, offer) {
  if (!friendEligible(state, actorId) || Object.keys(state.ecs.planner).some(id => id != actorId && state.ecs.planner[id].world.helpingFriend?.targetId == offer.targetId)) return Task.ABORT;
  if (offer.kind == "field") {
    const slot = state.ecs.farmable?.[offer.targetId]?.slots[offer.idx];
    if (!slot || slot.workerId && slot.workerId != actorId) return Task.ABORT;
    slot.workerId = actorId;
  }
}
export function help_friend_work(state, actorId, world, dt, firstRun) {
  const offer = world.helpingFriend;
  if (!offer || !friendEligible(state, actorId)) { releaseFriendWork(state, actorId); return Task.ABORT; }
  if (offer.kind == "build") {
    if (!state.ecs.construction?.[offer.targetId]) return Task.FINISH;
    if (math.squaredDistance(state.ecs.spatial[actorId], offer) > 100 || math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[offer.targetId]) > 50 ** 2) return Task.ABORT;
    const before=state.ecs.construction[offer.targetId].work;
    const result=work_shelter(state, actorId, world, dt, firstRun, offer.targetId);
    if(dt>0 && (state.ecs.construction[offer.targetId]?.work>before || result==Task.FINISH))goalEvidence(state,state.ui.playerId).earned.help ||= {helperId:actorId,targetId:offer.targetId,day:state.days};
    return result;
  }
  world.places.friendSlot = offer;
  const before=state.ecs.farmable?.[offer.targetId]?.slots[offer.idx]?.state;
  const result=perform_subtask_in_slot(state, actorId, world, dt, firstRun, offer.targetId, "friendSlot");
  if(result==Task.FINISH && state.ecs.farmable[offer.targetId].slots[offer.idx].state!=before)goalEvidence(state,state.ui.playerId).earned.help ||= {helperId:actorId,targetId:offer.targetId,day:state.days};
  return result;
}
export function end_friend_help(state, actorId) { releaseFriendWork(state, actorId); }

// The final few paces intentionally leave the navigation mesh. The preceding
// walk_to uses the normal pathfinder; transfer happens only after crossing it.
export function leave_edge(state, actorId, world, dt, firstRun, tileId, journey) {
  const target=exitPoint(state,tileId),p=state.ecs.spatial[actorId];
  const dx=target.x-p.x,dy=target.y-p.y,length=Math.hypot(dx,dy),speed=dt*24*HUMAN_SPEED*60*hungerSpeed(state.ecs.personable[actorId]);
  const depart=()=>{
    if(actorId==state.ui.playerId)state.pendingPlayerTravel=journey;
    else (state.pendingNpcDepartures ||= []).push({id:actorId,intent:journey});
    return Task.FINISH;
  };
  if(length<2 || !tileAt(state,p))return depart();
  if(firstRun) {
    if(actorId==state.ui.playerId)cancelLocalTasksForTravel(state,jobQueueFor(state.ecs,actorId).find(job=>job.assignedId==actorId&&job.job.key=="travel")?.id);
    return Task.CONTINUE;
  }
  const step=Math.min(1,speed/length);p.x+=dx*step;p.y+=dy*step;
  return !tileAt(state,p) || step>=1 ? depart() : Task.CONTINUE;
}

export function end_world_arrival(state, actorId, world) { delete world.worldArrival; }

export function tend_garden(state, actorId, world, dt, firstRun, gardenId) {
  const ecs = state.ecs, garden = ecs.backyard?.[gardenId], farm = ecs.farmable?.[gardenId];
  const suitable = garden?.kind == "vegetable" || ecs.personable[actorId].age < 18 && ecs.household[ecs.household[actorId]?.houseId]?.fields?.includes(gardenId);
  if (!suitable || !farm || farm.houseId != ecs.household[actorId]?.houseId || ecs.personable[actorId].age < 6 || time.season(state.days) == "winter" || math.squaredDistance(ecs.spatial[actorId], ecs.spatial[gardenId]) > 12 ** 2) return Task.ABORT;
  const slot = ecs.farmable[gardenId]?.slots.find(slot => slot.state == "sown" && slot.tendedDay != Math.floor(state.days));
  if (!slot) return Task.FINISH;
  if (!workComplete(state, actorId, world, dt, firstRun, GARDEN_CARE_TIME)) return Task.CONTINUE;
  slot.growth = (slot.growth || 0) + GARDEN_GROWTH;
  slot.tendedDay = Math.floor(state.days); slot.tendedBy = actorId;
  world.lastGardenHelp = { gardenId, day: state.days };
  state.redraws.push(gardenId);
  return Task.FINISH;
}

export function play_together(state, actorId, world, dt, firstRun, partnerId) {
  const v = world.social, other = state.ecs.planner[partnerId]?.world.social;
  if (!v || v.kind != "play" || other?.partnerId != actorId || world.capturedBy || state.ecs.planner[partnerId]?.world.capturedBy || state.ecs.planner[partnerId]?.world.feeling.hungry || state.ecs.planner[partnerId]?.world.feeling.tired || state.ecs.personable[partnerId]?.dead || state.ecs.personable[actorId].age >= 18 || state.ecs.personable[partnerId].age >= 18 || world.feeling.hungry || world.feeling.tired || state.days >= v.expires) return Task.FINISH;
  if (!v.started) {
    if (math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[partnerId]) > 85 ** 2) return Task.CONTINUE;
    v.started = other.started = state.days;
  }
  if (state.days - v.started >= time.HOUR / 2) {
    world.lastPlay = { partnerId, started: v.started, ended: state.days };
    state.ecs.planner[partnerId].world.lastPlay = { partnerId: actorId, started: v.started, ended: state.days };
    if (!other.finishedPlay) chatTogether(state, actorId, partnerId);
    v.finishedPlay = true;
    return Task.FINISH;
  }
  // Chase alternates the leader between two surveyed, accessible green spaces.
  const turn = Math.floor((state.days - v.started) / (time.HOUR / 12));
  const point = v.playPoints[(turn + (actorId < partnerId ? 0 : 1)) % 2];
  const phase = turn + ":" + point.x;
  const result = walk_to(state, actorId, world, dt, v.playPhase != phase, point);
  v.playPhase = phase;
  return result == Task.ABORT ? Task.FINISH : Task.CONTINUE;
}

// Arrival and occupancy are real; a changed home invalidates the current routine.
export function home_downtime(state, actorId, world, dt, firstRun, home) {
  if (actorId == state.ui.playerId || actualHome(state, actorId) != home || !nightTime(state.days)) { leaveHome(state, actorId); return Task.FINISH; }
  if (state.ecs.interior?.[actorId]?.buildingId != home) {
    const result = walk_to(state, actorId, world, dt, firstRun, home);
    if (result != Task.FINISH) return result;
    if (!enterHome(state, actorId, home)) return Task.ABORT;
  }
  return Task.CONTINUE;
}

// Follow the moving person through ordinary navigation and fence routing.
export function customs_visit(state, actorId, world, dt) {
  const visit = customsVisitTarget(state, actorId);
  if (!visit) return Task.CONTINUE;
  const target = state.ecs.spatial[visit.target];
  const key = [visit.target, target.x, target.y].join(":");
  if (math.squaredDistance(state.ecs.spatial[actorId], target) > SPEECH_REACH ** 2) {
    const point = speechPosition(state, actorId, visit.target);
    if (!point) { customsVisitFailed(state, actorId); return Task.CONTINUE; }
    const result = walk_to(state, actorId, world, dt, world.customsWalk != key, point);
    world.customsWalk = key;
    if (result == Task.ABORT) customsVisitFailed(state, actorId);
  } else if (arriveCustoms(state, actorId, dt) && !state.customs.dialogue) {
    delete world.customsVisit;
    const p = state.ecs.planner[actorId]; p.task = null; p.plan = null;
  }
  return Task.CONTINUE;
}
