import { routeBlocked, tileContents } from "game/land_use";
import { HEX_SIZE } from "game/map";
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

// NOTE: The frontier is a stable minimum heap. Updating a score adds an
// entry; stale entries are skipped when popped, without sorting the frontier.
export class Frontier {
  constructor() { this.entries = []; this.order = 0; }
  before(a, b) { return a.score < b.score || (a.score == b.score && a.order < b.order); }
  push(id, score) {
    const entry = { id, score, order: this.order++ };
    let i = this.entries.length;
    this.entries.push(entry);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(entry, this.entries[parent])) { break; }
      this.entries[i] = this.entries[parent];
      i = parent;
    }
    this.entries[i] = entry;
  }
  pop() {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (this.entries.length > 0) {
      let i = 0;
      while (i * 2 + 1 < this.entries.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.entries.length && this.before(this.entries[child + 1], this.entries[child])) { child++; }
        if (!this.before(this.entries[child], last)) { break; }
        this.entries[i] = this.entries[child];
        i = child;
      }
      this.entries[i] = last;
    }
    return first;
  }
}

// Grey through roads are half price. Dirt tracks slide towards half price as
// they wear, so walkers keep to them. The cap stops costs going negative.
export const ROAD_DISCOUNT = 0.5, MAX_TRACK_DISCOUNT = 0.5;

export function stepCost(state, id) {
  const walk = state.ecs.walkable[id];
  const crowded = tileContents(state, id).length > 1 ? 0.2 : 1;
  const wear = Math.min(1, Object.values(walk.worn || {}).reduce((t, w) => t + w, 0) * 0.01);
  const discount = state.ecs.mappable?.[id]?.throughRoute?.length ? ROAD_DISCOUNT : 1 - MAX_TRACK_DISCOUNT * wear;
  return HEX_SIZE / ((walk.speed || 1) * crowded) * discount;
}

export function path(state, start, goal, stepAllowed = () => true) {
  const openSet = new Frontier();
  const closed = new Set();
  const cameFrom = {};

  const gScore = {};
  const fScore = {};
  const costs = {};
  gScore[start] = 0;

  fScore[start] = h(state.ecs, start, goal);
  openSet.push(start, fScore[start]);

  while (openSet.entries.length > 0) {
    const { id: current, score } = openSet.pop();
    if (closed.has(String(current)) || score != fScore[current]) { continue; }
    if (current == goal) {
      return reconstructPath(cameFrom, current);
    }
    closed.add(String(current));
    for (const side in state.ecs.walkable[current].neighbours) {
      const n = state.ecs.walkable[current].neighbours[side];
      // A route never needs to loop; disconnected searches remain finite.
      if (closed.has(String(n)) || routeBlocked(state,n,start,goal) || !stepAllowed(current,n)) { continue; }
      if (!(n in costs)) costs[n] = stepCost(state, n);
      const tentativeScore = gScore[current] + costs[n];
      if (!(n in gScore) || tentativeScore < gScore[n]) {
        cameFrom[n] = { id: current, exit: +side };
        gScore[n] = tentativeScore;
        fScore[n] = gScore[n] + h(state.ecs, n, goal);
        openSet.push(n, fScore[n]);
      }
    }
  }
  return null;
}
