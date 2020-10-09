import { Hex, Grid, HEX_SIZE } from "game/map";
import { path } from "game/pathfinding";
import * as math from "game/math";
import * as time from "game/time";
import { newEntities, deleteEntity, entitiesInSameLocation } from "game/entities";
import { topController } from "game/playable";
import { nothing } from "immer";

function closestNavPointTo(state, id) {
  return entitiesInSameLocation(state, id).filter(e => state.ecs.walkable[e])[0];
}

export function walk_to(state, actorId, world, dt, firstRun, target) {
  const s = state.ecs.spatial[actorId];

  world.targetId = world.places[target] || target;

  if (!world.targetId) {
    // NOTE: Not passed a targetId and one isn't set for us, cannot continue
    return nothing;
  }

  if (!(actorId in state.pixi)) {
    // NOTE: we aren't on the map -- just teleport
    const t = state.ecs.spatial[world.targetId];
    s.x = t.x;
    s.y = t.y;
    return;
  }

  if (firstRun) {
    if (!s) {
      throw "walk to: Actor " + actorId + " has no spatial";
    }
    if (!state.ecs.spatial[world.targetId]) {
      throw "walk to: Target " + world.targetId + " has no spatial";
    }
    world.route = path(state.ecs, closestNavPointTo(state, actorId), closestNavPointTo(state, world.targetId));
    if (state.pixi[actorId].tween) {
      state.pixi[actorId].tween.stop();
    }
  }

  let next = world.route && world.route[0];
  if (!next) {
    return;
  }

  let targetPoint;
  if ("exit" in next) {
    const hex = Hex().fromPoint(targetPoint);
    const corners = hex.corners().map(c => c.add(state.ecs.spatial[next.id]));
    targetPoint = math.lerp(corners[next.exit], corners[(next.exit + 1) % 6], 0.5);
  } else {
    targetPoint = {
      x: state.ecs.spatial[world.targetId].x,
      y: state.ecs.spatial[world.targetId].y
    };
  }

  const terrainCost = state.ecs.walkable[next.id].speed || 1;
  // NOTE: number of hex sides per hour
  const baseHumanSpeed = 20;
  const speed = dt * 24 * baseHumanSpeed * HEX_SIZE * terrainCost;
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

    // NOTE: Move on the state.space map
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
    state.pixi[actorId].position.set(s.x, s.y);
  }
  return 1;
}

// NOTE: no in-game action, as this is _entirely in the mind_.
export function set_label() {
}

// NOTE: no in-game action, as jobs are currently only in the world rep.
export function complete_job() {}

// NOTE: no in-game action, as this is _entirely in the mind_.
export function forget_place() {}

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
      spatial: state.ecs.spatial[targetId],
      stockpile: { capacity: 24, amounts: {} },
      controllable: { controllerId: topController(state.ecs, actorId) },
    }]).forEach(id => state.redraws.push(id));
    state.ecs.workable[targetId].jobs =
      state.ecs.workable[targetId].jobs.filter(j => j.key != "create_stockpile");
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
    newEntities(state, Array.from({length: state.ecs.workable[targetId].jobs[0].amount}, () => ({
      spatial: state.ecs.spatial[targetId], // TODO: pick the nearby triangular intra-hex locations
      nameable: { nickname: "Log" },
      haulable: { speedModifier: 0.5 }
    }))).forEach(id => state.redraws.push(id));
    deleteEntity(state, targetId);
    return 0;
  }
  return 1;
}

export function find_place(state, actorId, world, dt, firstRun, type, filter, filterParam) {
  let found_place;

  const realm = topController(state.ecs, actorId);
  if (filter == "allows_sleep") {
    const available_in_realm = Object.keys(state.ecs.sleepable).filter(id =>
      realm == topController(state.ecs, id) &&
      state.ecs.sleepable[id].occupiers.length < state.ecs.sleepable[id].capacity);
    available_in_realm.sort((a, b) =>
      math.squaredDistance(state.ecs.spatial[a], state.ecs.spatial[actorId]) -
      math.squaredDistance(state.ecs.spatial[b], state.ecs.spatial[actorId]));
    found_place = available_in_realm[0];
  } else if (filter == "has") {
    if (!filterParam) { throw "For this filter of " + filter + " we need a filterParam"; }
    const available_in_realm = Object.keys(state.ecs.stockpile).filter(id =>
      realm == topController(state.ecs, id) &&
      state.ecs.stockpile[id].amounts[filterParam] > 0);
    available_in_realm.sort((a, b) =>
      math.squaredDistance(state.ecs.spatial[a], state.ecs.spatial[actorId]) -
      math.squaredDistance(state.ecs.spatial[b], state.ecs.spatial[actorId]));
    found_place = available_in_realm[0];
  } else if (filter == "space") {
    const spiral = Grid.spiral({
      center: Hex().fromPoint(state.ecs.spatial[actorId]),
      radius: 3
    });
    spiral.shift();
    const options = spiral
      .map(hex => state.space[hex] || [])
      .filter(space => !space.some(e => state.ecs.building[e] || state.ecs.stockpile[e]))
      .map(space => space.find(e => state.ecs.walkable[e] && state.ecs.walkable[e].speed > 0))
      .filter(e => e);

    if (options.length > 0) {
      found_place = options[Math.floor(Math.random() * options.length)];
    }
  } else {
    throw "Don't know how to find a place for '" + filter + "'";
  }

  if (!found_place) {
    // NOTE: Prevent AI from looking again this hour
    world.no_place_for[type] = world.hour;
    return nothing;
  }

  world.places[type] = found_place;
}

export function wander(state, actorId, world) {
  const neighbours = Grid.hexagon({
    radius: 1,
    center: Hex().fromPoint(state.ecs.spatial[actorId])
  });

  const tiles = neighbours
    .map(hex => state.space[hex])
    .flat()
    .filter(e => state.ecs.walkable[e]);

  world.targetId = tiles[Math.floor(Math.random() * tiles.length)];
}

// NOTE: compensate for getting tireder through sleep
const SLEEP_REPLENISH = 3 * 1.3333;

export function sleep(state, actorId, world, dt) {
  const person = state.ecs.personable[actorId];
  person.tiredness -= dt * SLEEP_REPLENISH;
  return person.tiredness >= 0.1;
}

const FOOD_REPLENISH = {
  grain: 24, // NOTE: this means we finish eating in about an hour
};

export function pick_up(state, actorId, world, dt, firstRun, thing, place) {
  const stockpiles = entitiesInSameLocation(state, actorId).filter(id => state.ecs.stockpile[id] && state.ecs.stockpile[id].amounts[thing] > 0);
  if (stockpiles.length == 0) {
    // NOTE: This stockpile no longer trusted for this type of thing
    world.places[place] = null;
    return nothing;
  }
  state.ecs.stockpile[stockpiles[0]].amounts[thing] -= 1;
  state.ecs.holder[actorId].holding[thing] = 1;
}

export function eat(state, actorId, world, dt, firstRun, thing) {
  const holder = state.ecs.holder[actorId];
  if (firstRun) {
    if (holder.holding[thing] <= 0) {
      console.log("EAT", actorId, "NO", thing, "to eat");
      return nothing;
    }
    holder.holding[thing] -= 1;
  }

  const person = state.ecs.personable[actorId];
  person.hunger -= dt * FOOD_REPLENISH[thing];
  return person.hunger >= 0.1;
}
