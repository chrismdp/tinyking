import { Hex, Grid, HEX_SIZE, TRIANGLES, triangleCenters, TRIANGLE_INTERIOR_RADIUS } from "game/map";
import { path } from "game/pathfinding";
import { give, take } from "game/holder";
import * as math from "game/math";
import * as time from "game/time";
import { replan, Task } from "game/htn";
import { removeFromSpace, newEntities, deleteEntity, entitiesInSameLocation } from "game/entities";
import { topController } from "game/playable";
import { jobQueueFor, firstFreeJob } from "game/manager";
import { containerHasSpace } from "game/container";
import { forageAvailable } from "game/ecology";
import { eveningPlace } from "game/villages";
import { hungerSpeed } from "game/hunger";
import { workOnShelter, collectShelterLog, deliverShelterLog } from "game/construction";
import { MAX_SUBTASKS } from "game/primitive";

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

export function walk_to(state, actorId, world, dt, firstRun, target) {
  const s = state.ecs.spatial[actorId];

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
  if (targetPoint == null) {
    delete world.places[target];
    return Task.ABORT;
  }

  if (firstRun) {
    if (!s) {
      throw "walk to: Actor " + actorId + " has no spatial";
    }
    world.route = path(state, closestNavPointTo(state, s), closestNavPointTo(state, targetPoint));
  }

  let next = world.route && world.route[0];
  if (!world.route) return Task.ABORT;
  if (!next) {
    return Task.FINISH;
  }

  if ("exit" in next) {
    const corners = Hex().corners().map(c => c.add(state.ecs.spatial[next.id]));
    targetPoint = math.lerp(corners[next.exit], corners[(next.exit + 1) % 6], 0.5);
  }

  const order = world.ordered && jobQueueFor(state.ecs, actorId).find(j => j.assignedId == actorId && j.job.key == "move_to_here");
  if (order) {
    const distance = Math.sqrt(math.squaredDistance(s, targetPoint));
    if (order.distance == null) order.distance = Math.max(1, distance);
    order.progress = Math.max(0, Math.min(1, 1 - distance / order.distance));
  }
  const terrainCost = state.ecs.walkable[next.id].speed || 1;
  // NOTE: number of hex sides per hour
  const baseHumanSpeed = 20;
  const weightCost = state.ecs.holder[actorId].held
    .map(id => state.ecs.haulable[id].speedModifier || 1)
    .reduce((result, x) => result * x, 1);
  const speed = dt * 24 * baseHumanSpeed * HEX_SIZE * terrainCost * weightCost * hungerSpeed(state.ecs.personable && state.ecs.personable[actorId]);
  let dx = targetPoint.x - s.x;
  let dy = targetPoint.y - s.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 10) {
    // NOTE: Wear down the path
    if (next.entrance != null || next.exit != null) {
      const key = [next.entrance ?? "C", next.exit ?? "C"].sort().join();
      if (!(key in state.ecs.walkable[next.id].worn)) {
        state.ecs.walkable[next.id].worn[key] = 0;
      }
      state.ecs.walkable[next.id].worn[key] += 1;
      state.redraws.push(next.id);
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

    if (!("exit" in next)) {
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
  if (workComplete(state, actorId, world, dt, firstRun, TIME_TO_DESIGNATE)) {
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
  if (workComplete(state, actorId, world, dt, firstRun, TIME_TO_DESIGNATE)) {
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
    .filter(({ idx }) => candidates.includes(slots[idx].state))
    .slice(0, MAX_SUBTASKS);
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

  state.ecs.farmable[targetId].claimerId = null;
}

export function perform_subtask_in_slot(state, actorId, world, dt, firstRun, target, place) {
  const targetId = world.places[target] || target;
  if (!targetId) {
    // NOTE: Not passed a target and one isn't set for us, cannot continue
    return Task.ABORT;
  }

  if (firstRun) {
    const subtask = world.places[place];
    if (subtask.lose) {
      const holder = state.ecs.holder[actorId];
      const id = holder.held.find(e => state.ecs.good[e] && state.ecs.good[e].type == subtask.lose);
      if (!id) {
        console.log("PERFORM", actorId, "NO", subtask.lose, "to lose");
        return Task.ABORT;
      }
      take(state.ecs, id, null);
      deleteEntity(state, id);
    }

  }

  if (workComplete(state, actorId, world, dt, firstRun, SUBTASK_TIMES[world.places[place].result])) {
    const subtask = world.places[place];
    if (!state.ecs.farmable[targetId]) {
      throw "Cannot find farmable for " + targetId;
    }
    const slot = state.ecs.farmable[targetId].slots[subtask.idx];
    slot.state = subtask.result;
    if (subtask.result == "harvested") {
      newEntities(state, Array.from({ length: slot.amount }, () => ({
        spatial: { x: subtask.x, y: subtask.y, immovable: false },
        good: { type: slot.content, amount: 1 },
        haulable: { heldBy: null },
        controllable: { controllerId: topController(state.ecs, actorId) }
      }))).forEach(id => state.redraws.push(id));
    } else if (subtask.lose) {
      slot.content = subtask.lose;
    }
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

export function drop_entity_into_container(state, actorId, world, dt, firstRun, place, type) {
  const containerId = world.places[place];
  if (!containerHasSpace(state.ecs.container[containerId])) {
    // NOTE: Someone has already taken this slot - replan
    world.places[place] = null;
    return Task.ABORT;
  }

  const droppedId = state.ecs.holder[actorId].held
    .find(e => state.ecs.good[e] && state.ecs.good[e].type == type);

  if (!droppedId) { world.holding[type] = false; return Task.ABORT; }
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

  const realm = topController(state.ecs, actorId);
  if (filter == "allows_sleep") {
    const available_in_realm = Object.keys(state.ecs.sleepable).filter(id =>
      realm == topController(state.ecs, id) &&
      state.ecs.sleepable[id].occupiers.length < state.ecs.sleepable[id].capacity);
    available_in_realm.sort(closestSpatialTo(state, actorId));
    found_place = available_in_realm[0];
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
      realm == topController(state.ecs, id) &&
      state.ecs.container[id].amounts[filterParam] > 0);
    available_in_realm.sort(closestSpatialTo(state, actorId));
    found_place = available_in_realm[0];
  } else if (filter == "container_with_space") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    const available_in_realm = Object.keys(state.ecs.container || {}).filter(id =>
      realm == topController(state.ecs, id) &&
      containerHasSpace(state.ecs.container[id]));
    available_in_realm.sort(closestSpatialTo(state, actorId));
    found_place = available_in_realm[0];
  } else if (filter == "stockpile_slot_with") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    const available = Object.keys(state.ecs.stockpile || {})
      .filter(id => realm == topController(state.ecs, id))
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
      realm == topController(state.ecs, id));
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
        realm == topController(state.ecs, id) &&
        state.ecs.good[id] &&
        state.ecs.good[id].type == filterParam &&
        !state.ecs.haulable[id].heldBy);
    }
    available.sort(closestSpatialTo(state, actorId));
    found_place = available[0];
  } else if (filter == "farmable_slot_with") {
    let available = [];
    if (state.ecs.farmable) {
      available = Object.keys(state.ecs.farmable).filter(id =>
        (!state.ecs.farmable[id].claimerId || state.ecs.farmable[id].claimerId == actorId) &&
        realm == topController(state.ecs, id) &&
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
    const id = holder.held.find(e => state.ecs.good[e] && state.ecs.good[e].type == thing);
    if (!id) {
      console.log("EAT", actorId, "NO", thing, "to eat");
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

export function set_controller_to_me(state, actorId, world, dt, firstRun, targetId) {
  const target = state.ecs.controllable[targetId];
  if (!target) {
    throw "Cannot set_controller_to_me for non-controllable " + targetId;
  }
  target.controllerId = topController(state.ecs, actorId);

  for (const id in state.ecs.controllable) {
    if (topController(state.ecs, id) == actorId) {
      state.redraws.push(id);
    }
  }
}

export const work_shelter = workOnShelter;
export const collect_log = collectShelterLog;
export const deliver_log = deliverShelterLog;

export function carry_home(state, actorId, world, dt, firstRun) {
  if (!world.ordered) return Task.FINISH;
  const ecs = state.ecs;
  const home = Object.keys(ecs.shelter || {}).find(id => ecs.shelter[id].stage) || Object.keys(ecs.camp || {})[0];
  if (!home) return Task.FINISH;
  if (firstRun) world.carryTarget = null;
  const held = ecs.holder[actorId].held[0];
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
  return workComplete(state, actorId, world, dt, firstRun, time.HOUR / 2) ? Task.FINISH : Task.CONTINUE;
}
