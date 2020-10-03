import { Hex, Grid, HEX_SIZE } from "game/map";
import { path } from "game/pathfinding";
import * as math from "game/math";
import { newEntities, deleteEntity } from "game/entities";
import { topController } from "game/playable";

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

    // NOTE: Discover adjacent tiles
    const neighbours = Grid.hexagon({
      radius: 1,
      center: Hex().fromPoint(state.ecs.spatial[next.id])
    });
    const playable = state.ecs.playable[topController(state.ecs, actorId)];
    const newTiles = neighbours.filter(hex => !playable.known.find(k => hex.x === k.x && hex.y === k.y));
    playable.known = [ ...playable.known, ...newTiles ];
    newTiles.map(k => state.space[Hex(k)]).flat().forEach(e => state.redraws.push(e));
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

export function complete_job() {
  // NOTE: no in-game action, as jobs are currently only in the world rep.
}

export function chop_tree(state, actorId, targetId) {
  newEntities(state, Array.from({length: state.ecs.workable[targetId].jobs[0].amount}, () => ({
    spatial: state.ecs.spatial[targetId], // TODO: pick the nearby triangular intra-hex locations
    nameable: { nickname: "Log" },
    haulable: { speedModifier: 0.5 }
  }))).forEach(id => state.redraws.push(id));
  deleteEntity(state, targetId);
}
