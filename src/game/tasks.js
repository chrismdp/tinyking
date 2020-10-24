import { Hex, Grid, HEX_SIZE, triangleCenters, TRIANGLE_INTERIOR_RADIUS } from "game/map";
import { path } from "game/pathfinding";
import { give, take } from "game/holder";
import * as math from "game/math";
import * as time from "game/time";
import { replan } from "game/htn";
import { removeFromSpace, newEntities, deleteEntity, entitiesInSameLocation } from "game/entities";
import { topController } from "game/playable";
import { nothing } from "immer";
import { jobQueueFor, firstFreeJob } from "game/manager";

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
    return nothing;
  }

  let targetPoint;
  if (typeof world.target === "object" && world.target.x && world.target.y) {
    targetPoint = world.target;
  } else {
    targetPoint = state.ecs.spatial[world.target];
  }
  if (targetPoint == null) {
    console.log("Cannot find targetPoint from " + JSON.stringify(world.target));
    return nothing;
  }

  if (firstRun) {
    if (!s) {
      throw "walk to: Actor " + actorId + " has no spatial";
    }
    world.route = path(state.ecs, closestNavPointTo(state, s), closestNavPointTo(state, targetPoint));
  }

  let next = world.route && world.route[0];
  if (!next) {
    return;
  }

  if ("exit" in next) {
    const corners = Hex().corners().map(c => c.add(state.ecs.spatial[next.id]));
    targetPoint = math.lerp(corners[next.exit], corners[(next.exit + 1) % 6], 0.5);
  }

  const terrainCost = state.ecs.walkable[next.id].speed || 1;
  // NOTE: number of hex sides per hour
  const baseHumanSpeed = 20;
  const weightCost = state.ecs.holder[actorId].held
    .map(id => state.ecs.haulable[id].speedModifier || 1)
    .reduce((result, x) => result * x, 1);
  const speed = dt * 24 * baseHumanSpeed * HEX_SIZE * terrainCost * weightCost;
  let dx = targetPoint.x - s.x;
  let dy = targetPoint.y - s.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 10) {
    // NOTE: Wear down the path
    if (next.entrance != null || next.exit != null) {
      const key = [next.entrance ?? "C", next.exit ?? "C"].sort().join();
      if (!(key in state.ecs.mappable[next.id].worn)) {
        state.ecs.mappable[next.id].worn[key] = 0;
      }
      state.ecs.mappable[next.id].worn[key] += 1;
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
      return 0;
    }
  } else {
    dx /= length;
    dy /= length;
    s.x += dx * speed;
    s.y += dy * speed;
    for (const displayObject of state.pixi[actorId]) {
      displayObject.position.set(s.x, s.y);
    }
  }
  return 1;
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
    return nothing;
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
    return nothing;
  }
  jobs.splice(idx, 1);
}

export function wait_for(state, actorId, world, dt, firstRun, time) {
  if (firstRun) {
    world.wait_until = state.days + time;
  }
  return (state.days <= world.wait_until);
}

const TIME_TO_CREATE_STOCKPILE = time.HOUR / 3;
export function create_stockpile(state, actorId, world, dt, firstRun, targetId) {
  if (firstRun) {
    world.wait_until = state.days + TIME_TO_CREATE_STOCKPILE;
  }

  if (state.days > world.wait_until) {
    newEntities(state, [{
      nameable: { nickname: "Stockpile" },
      spatial: { ...state.ecs.spatial[targetId] },
      stockpile: {},
      holder: { capacity: 19, held: [] },
      controllable: { controllerId: topController(state.ecs, actorId) },
    }]).forEach(id => state.redraws.push(id));
    return 0;
  }
  return 1;
}

const TIME_TO_CHOP_WOOD = time.HOUR / 2;
export function chop_tree(state, actorId, world, dt, firstRun, targetId) {
  if (firstRun) {
    world.wait_until = state.days + TIME_TO_CHOP_WOOD;
  }

  if (state.days > world.wait_until) {
    newEntities(state, Array.from({length: state.ecs.good[targetId].amount}, () => ({
      spatial: { ...state.ecs.spatial[targetId], immovable: false },
      nameable: { nickname: "Log" },
      good: { type: "wood", amount: 1 },
      haulable: { speedModifier: 0.5 },
      controllable: { controllerId: topController(state.ecs, actorId) }
    }))).forEach(id => state.redraws.push(id));
    deleteEntity(state, targetId);

    return 0;
  }
  return 1;
}

export function create_ploughing_subtasks(state, actorId, world, dt, firstRun, targetId) {
  if (!state.ecs.farmable) {
    state.ecs.farmable = {};
  }
  if (!state.ecs.farmable[targetId]) {
    state.ecs.farmable[targetId] = { slots: {}, id: targetId };
  }
  const slots = state.ecs.farmable[targetId].slots;
  world.subtasks = triangleCenters(state.ecs.spatial[targetId])
    .map((slot, idx) => ({ ...slot, id: targetId, idx }))
    .filter(({ idx }) => slots[idx] != "ploughed");
}

const TIME_TO_PLOUGH_SLOT = time.HOUR / 8;
const PLOUGHED_SPEED = 0.25;

export function plough_slot(state, actorId, world, dt, firstRun, targetId, place) {
  if (firstRun) {
    world.wait_until = state.days + TIME_TO_PLOUGH_SLOT;
  }

  if (state.days > world.wait_until) {
    const slot = world.places[place];
    if (!state.ecs.farmable[targetId]) {
      throw "Cannot find farmable for " + targetId;
    }
    state.ecs.farmable[targetId].slots[slot.idx] = "ploughed";
    state.ecs.walkable[targetId].speed = PLOUGHED_SPEED;
    state.redraws.push(targetId);
    return 0;
  }

  return 1;
}

export function drop_entity_into_stockpile_slot(state, actorId, world, dt, firstRun, type) {
  const stockpileId = world.places.slot.id;
  const space = state.space[Hex().fromPoint(state.ecs.spatial[stockpileId])];
  if (space.some(e => math.squaredDistance(world.places.slot, state.ecs.spatial[e]) <
    TRIANGLE_INTERIOR_RADIUS * TRIANGLE_INTERIOR_RADIUS)) {
    // NOTE: Someone has already taken this slot - replan
    world.places.slot = null;
    return nothing;
  }

  const droppedId = state.ecs.holder[actorId].held
    .find(e => state.ecs.good[e] && state.ecs.good[e].type == type);

  give(state.ecs, droppedId, stockpileId);

  state.ecs.spatial[droppedId].x = world.places.slot.x;
  state.ecs.spatial[droppedId].y = world.places.slot.y;
  space.push(droppedId);

  state.redraws.push(actorId);
  state.redraws.push(stockpileId);
}

export function pick_up_entity_with_good(state, actorId, world, dt, firstRun, type) {
  const targetId = world.places[type];
  if (!targetId) {
    return nothing;
  }

  if (state.ecs.haulable[targetId].heldBy) {
    // NOTE: someone else has already picked this up!
    world.places[type] = null;
    return nothing;
  }

  if (math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[targetId]) > 10 * 10) {
    console.error("Error", actorId, " pick_up_entity: not close enough to " + targetId);
    return nothing;
  }

  give(state.ecs, targetId, actorId);

  state.redraws.push(actorId);
  state.redraws.push(targetId);
}

export function pick_up_from_stockpile(state, actorId, world, dt, firstRun, type, place) {
  const slot = world.places[place];
  if (!slot) {
    return nothing;
  }

  if (topController(state.ecs, actorId) == state.ui.playerId) {
    console.log(actorId, "PUFS", slot, type, place, world.places);
  }

  if (state.ecs.haulable[slot.id].heldBy != slot.stockpileId) {
    // NOTE: someone else has already picked this up!
    return nothing;
  }

  if (math.squaredDistance(state.ecs.spatial[actorId], slot) > 10 * 10) {
    throw actorId + " pick_up_entity: not close enough to " + JSON.stringify(slot);
  }

  give(state.ecs, slot.id, actorId);

  removeFromSpace(state, slot.id);

  state.redraws.push(actorId);
  state.redraws.push(slot.stockpileId);
}

export function find_place(state, actorId, world, dt, firstRun, type, filter, filterParam) {
  let found_place;

  const realm = topController(state.ecs, actorId);
  if (filter == "allows_sleep") {
    const available_in_realm = Object.keys(state.ecs.sleepable).filter(id =>
      realm == topController(state.ecs, id) &&
      state.ecs.sleepable[id].occupiers.length < state.ecs.sleepable[id].capacity);
    available_in_realm.sort(closestSpatialTo(state, actorId));
    found_place = available_in_realm[0];
  } else if (filter == "container_with") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    const available_in_realm = Object.keys(state.ecs.container || {}).filter(id =>
      realm == topController(state.ecs, id) &&
      state.ecs.container[id].amounts[filterParam] > 0);
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
    if (topController(state.ecs, actorId) == state.ui.playerId) {
      console.log(actorId, "SSW FP", found_place);
    }
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
  } else if (filter == "space") {
    const spiral = Grid.spiral({
      center: Hex().fromPoint(state.ecs.spatial[actorId]),
      radius: 3
    });
    spiral.shift();
    const options = spiral
      .map(hex => state.space[hex] || [])
      .filter(space => !space.some(e =>
        (state.ecs.spatial[e].immovable && !state.ecs.mappable[e]) ||
        (state.ecs.farmable && state.ecs.farmable[e])))
      .map(space => space.find(e => state.ecs.walkable[e] && state.ecs.walkable[e].speed >= 0.5))
      .filter(e => e);

    if (options.length > 0) {
      found_place = options[Math.floor(Math.random() * options.length)];
    }
  } else {
    throw "Don't know how to find a place for '" + filter + "'";
  }

  if (!found_place) {
    // NOTE: Prevent AI from looking again this hour
    world.no_place_for[type] = world.hour || 0;
    return nothing;
  }

  world.places[type] = found_place;
}

// NOTE: compensate for getting tireder through sleep
const SLEEP_REPLENISH = 3 * 1.3333;

export function sleep(state, actorId, world, dt) {
  const person = state.ecs.personable[actorId];
  person.tiredness -= dt * SLEEP_REPLENISH;
  return person.tiredness >= 0.1 || world.time_of_day == "night";
}

const FOOD_REPLENISH = {
  grain: 24, // NOTE: this means we finish eating in about an hour
};

export function get_from_container(state, actorId, world, dt, firstRun, thing, place) {
  const s = state.ecs.spatial[actorId];
  const entities = entitiesInSameLocation(state, s);
  // TODO: the rooms in buildings are the containers. Need to move this to
  // things in the stockpile ideally.
  const rooms = entities.map(e => state.ecs.building[e] ? state.ecs.building[e].rooms : []).flat();
  const containers = [...entities, ...rooms].filter(id =>
    state.ecs.container[id] && state.ecs.container[id].amounts[thing] > 0);
  if (containers.length == 0) {
    // NOTE: This container no longer trusted for this type of thing
    console.log("Oh dear. No container with", thing, "here");
    world.places[place] = null;
    return nothing;
  }
  state.ecs.container[containers[0]].amounts[thing] -= 1;
  const [ grain ] = newEntities(state, [{
    good: { type: thing, amount: 1 },
    haulable: { heldBy: null },
    spatial: { x: s.x, y: s.y },
    controllable: { controllerId: topController(state.ecs, actorId) },
  }]);
  give(state.ecs, grain, actorId);
}

export function eat(state, actorId, world, dt, firstRun, thing) {
  if (firstRun) {
    const holder = state.ecs.holder[actorId];
    const id = holder.held.find(e => state.ecs.good[e] && state.ecs.good[e].type == "grain");
    if (!id) {
      console.log("EAT", actorId, "NO", thing, "to eat");
      return nothing;
    }
    take(state.ecs, id, null);
    deleteEntity(state, id);
  }

  const person = state.ecs.personable[actorId];
  person.hunger -= dt * FOOD_REPLENISH[thing];
  return person.hunger >= 0.1;
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
