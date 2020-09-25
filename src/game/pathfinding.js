import { Hex, Grid, HEX_SIZE } from "game/map";
import { entitiesAtLocations } from "game/spatial";

function h(ecs, a, b) {
  const w = ecs.spatial[a].x - ecs.spatial[b].x;
  const h = ecs.spatial[a].y - ecs.spatial[b].y;
  return w * w + h * h;
}

function reconstructPath(cameFrom, current) {
  const result = [current];
  while(cameFrom[current]) {
    current = cameFrom[current];
    result.push(current);
  }
  return result.reverse();
}

const debug = false;

export function path(ecs, start, goal) {
  const openSet = [start];
  const cameFrom = {};

  const gScore = {};
  const fScore = {};
  gScore[start] = 0;

  fScore[start] = h(ecs, start, goal);

  while (openSet.length > 0) {
    openSet.sort((a, b) => (fScore[a] || Infinity) - (fScore[b] || Infinity))
    if (debug) { console.log("P OS", openSet, "GS", gScore, "FS", fScore); }
    const current = openSet[0];
    if (debug) { console.log("P CURRENT", current); }
    if (current == goal) {
      if (debug) { console.log("P HIT", cameFrom, current, goal); }
      return reconstructPath(cameFrom, current);
    }
    openSet.shift();
    const hex = Hex().fromPoint(ecs.spatial[current]);
    for (const n of ecs.walkable[current].neighbours) {
      const tentativeScore = gScore[current] + HEX_SIZE;
      if (debug) { console.log("P n", n, "TS", tentativeScore, "GSN", gScore[n]); }
      if (!(n in gScore) || tentativeScore < gScore[n]) {
        if (debug) { console.log("P cameFrom", n, current); }
        cameFrom[n] = current;
        gScore[n] = tentativeScore;
        fScore[n] = gScore[n] + h(ecs, n, goal);
        if (!openSet.includes(n)) {
          openSet.push(n);
        }
      }
    }
  }
  return null;
}
