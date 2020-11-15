import { Hex, HEX_SIZE } from "game/map";
import * as math from "game/math";

function opposite(side) {
  return (side + 3) % 6;
}

export function addBidirectionalLink(ecs, source, side, target) {
  ecs.walkable[source].neighbours[side] = target;
  ecs.walkable[target].neighbours[opposite(side)] = source;
}

export function removeBidirectionalLink(ecs, source, side) {
  const target = ecs.walkable[source].neighbours[side];
  if (target && ecs.walkable[target].neighbours[opposite(side)] != source) {
    throw "Inconsistent links between source (" +
      JSON.stringify(ecs.walkable[source]) +
      ") and target (" +
      JSON.stringify(ecs.walkable[target]) +
      ")";
  }
  delete ecs.walkable[source].neighbours[side];
  if (target) {
    delete ecs.walkable[target].neighbours[opposite(side)];
  }
}

function h(ecs, a, b) {
  return Math.sqrt(math.squaredDistance(ecs.spatial[a], ecs.spatial[b]));
}

function reconstructPath(cameFrom, id) {
  let current = { id };
  const result = [current];
  while(cameFrom[current.id]) {
    current = cameFrom[current.id];
    result.push(current);
  }
  result.reverse();
  result.forEach((step, i) => {
    if (i > 0 && i < result.length) {
      result[i].entrance = opposite(result[i - 1].exit);
    }
  });
  return result;
}

const debug = false;

export function path(state, start, goal) {
  const openSet = [start];
  const cameFrom = {};

  const gScore = {};
  const fScore = {};
  gScore[start] = 0;

  fScore[start] = h(state.ecs, start, goal);

  while (openSet.length > 0) {
    openSet.sort((a, b) => (fScore[a] || Infinity) - (fScore[b] || Infinity));
    if (debug) { console.log("P OS", openSet, "GS", gScore, "FS", fScore); }
    const current = openSet[0];
    if (debug) { console.log("P CURRENT", current); }
    if (current == goal) {
      if (debug) { console.log("P HIT", cameFrom, current, goal); }
      return reconstructPath(cameFrom, current);
    }
    openSet.shift();
    for (const side in state.ecs.walkable[current].neighbours) {
      const n = state.ecs.walkable[current].neighbours[side];
      const otherPenalty = state.space[Hex().fromPoint(state.ecs.spatial[n])].length > 1 ?
        0.2 : 1;
      const tentativeScore = gScore[current] +
        (HEX_SIZE / ((state.ecs.walkable[n].speed || 1) * otherPenalty));
      if (debug) { console.log("P n", n, "TS", tentativeScore, "GSN", gScore[n]); }
      if (!(n in gScore) || tentativeScore < gScore[n]) {
        if (debug) { console.log("P cameFrom", n, current); }
        cameFrom[n] = { id: current, exit: +side };
        gScore[n] = tentativeScore;
        fScore[n] = gScore[n] + h(state.ecs, n, goal);
        if (!openSet.includes(n)) {
          openSet.push(n);
        }
      }
    }
  }
  return null;
}
