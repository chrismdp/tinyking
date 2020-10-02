import { Hex, HEX_SIZE } from "game/map";
import { path } from "game/pathfinding";
import * as math from "game/math";
import { topController } from "game/playable";
import { newEntities, deleteEntity } from "game/entities";

import TWEEN from "@tweenjs/tween.js";

function closestNavPointTo(state, id) {
  return state.space[Hex().fromPoint(state.ecs.spatial[id])].filter(e => state.ecs.walkable[e])[0];
}

export function walk_to(state, actorId, targetId) {
  const m = state.ecs.moveable[actorId];
  const s = state.ecs.spatial[actorId];
  if (m.targetId != targetId ) {
    m.targetId = targetId;
    if (!s) {
      throw "walk to: Actor " + actorId + " has no spatial";
    }
    if (!state.ecs.spatial[targetId]) {
      throw "walk to: Target " + targetId + " has no spatial";
    }
    const route = path(state.ecs, closestNavPointTo(state, actorId), closestNavPointTo(state, targetId));
    state.ecs.moveable[actorId].route = route;
    if (state.pixi[actorId].tween) {
      state.pixi[actorId].tween.stop();
    }
  }

  let next = m.route[0];
  let target;
  if ("exit" in next) {
    const hex = Hex().fromPoint(target);
    const corners = hex.corners().map(c => c.add(state.ecs.spatial[next.id]));
    target = math.lerp(corners[next.exit], corners[(next.exit + 1) % 6], 0.5);
  } else {
    target = state.ecs.spatial[targetId];
  }

  // NOTE: 2.5 Hex sides per second, modified by the terrain cost
  const speed = HEX_SIZE * 2.5 * (state.ecs.walkable[next.id].speed || 1);
  if (!state.pixi[actorId].tween) {
    // TODO: Move this to onComplete so it's the end of the line
    if (next.entrance != null && next.exit != null) {
      const key = [next.entrance, next.exit].sort().join();
      if (!(key in state.ecs.mappable[next.id].worn)) {
        state.ecs.mappable[next.id].worn[key] = 0;
      }
      state.ecs.mappable[next.id].worn[key] += 1;
      state.redraws.push(next.id);
    }
    state.pixi[actorId].tween = new TWEEN.Tween(s)
      .to(target, Math.sqrt(math.squaredDistance(s, target)) / (speed * 0.001))
      .onUpdate(() => state.pixi[actorId].position.set(s.x, s.y))
      .onStop(() => delete state.pixi[actorId].tween)
      .onComplete(() => delete state.pixi[actorId].tween)
      .start();
  }

  if (math.squaredDistance(s, target) < 10) {
    m.route.shift();
  }

  const dSq = math.squaredDistance(state.ecs.spatial[actorId], state.ecs.spatial[targetId]);
  return dSq > 10 * 10;
}

export function idle() {
  return 1; // NOTE: This prevents us instantly moving on
}

// NOTE: This *should* happen automatically in the same frame after a plan,
// before others are able to take it.
export function take_job(state, id, key) {
  const topId = topController(state.ecs, id);
  const idx = state.ecs.manager[topId].jobs.findIndex(j => j.job.key == key);
  state.ecs.manager[topId].jobs.splice(idx, 1);
}

export function chop_tree(state, actorId, targetId) {
  newEntities(state, Array.from({length: state.ecs.workable[targetId].jobs[0].amount}, () => ({
    spatial: state.ecs.spatial[targetId], // TODO: pick the nearby triangular intra-hex locations
    nameable: { nickname: "Log" },
    haulable: { speedModifier: 0.5 }
  }))).forEach(id => state.redraws.push(id));
  deleteEntity(state, targetId);
}
