import { Hex, Grid, WorldHex, WorldGrid, ALL_SIDES } from "game/hex";
export const worldKey = h => h.x + "," + h.y;
export const SIDE_NAMES = ["east", "south-east", "south-west", "west", "north-west", "north-east"];
export const neighbours = h => WorldGrid.hexagon({
  center: WorldHex(h),
  radius: 1
}).neighborsOf(WorldHex(h), ALL_SIDES);
const directions = neighbours({
  x: 0,
  y: 0
}).map(h => h.toPoint()).map(p => {
  const c = WorldHex(0, 0).toPoint(),
    d = Math.hypot(p.x - c.x, p.y - c.y);
  return {
    x: (p.x - c.x) / d,
    y: (p.y - c.y) / d
  };
});
export function sideOfHex(hex, centre, radius) {
  if (Hex(centre).distance(hex) != radius) return null;
  const p = hex.toPoint(),
    c = Hex(centre).toPoint();
  let side = 0,
    best = -Infinity;
  directions.forEach((v, i) => {
    const score = (p.x - c.x) * v.x + (p.y - c.y) * v.y;
    if (score > best + 1e-7) {
      side = i;
      best = score;
    }
  });
  return side;
}
export const tileAt = (s, p) => (s.space[Hex().fromPoint(p)] || []).find(id => s.ecs.mappable[id]);
export const edgeSide = (s, id) => s.ecs.mappable?.[id] && s.ecs.walkable?.[id]?.speed > 0 ? sideOfHex(Hex().fromPoint(s.ecs.spatial[id]), s.map.centre, s.map.radius) : null;
export function destinationFor(s, id) {
  const side = edgeSide(s, id);
  if (side == null) return null;
  const coordinates = neighbours(s.world.home)[side],
    hex = s.world.hexes.find(h => worldKey(h) == worldKey(coordinates));
  return {
    side,
    arrivalSide: (side + 3) % 6,
    hex,
    key: worldKey(coordinates),
    name: hexName(coordinates),
    blocked: !hex ? "The edge of the known world cannot be crossed." : hex.ocean ? "This neighbour is ocean. You cannot cross the sea on foot." : null
  };
}
export const hexName = h => "Reach " + h.x + ", " + h.y;

// Land neighbours get a deterministic pass. The pass clears two inward tiles,
// a farm-sized clearing and, if necessary, a narrow path to an existing village.
// All six are prepared before resources, so arrival direction cannot reroll a map.
export function prepareEntrances(grid, landscape, settlements, world, centre, radius) {
  const result = {},
    home = world.hexes.find(h => worldKey(h) == worldKey(world.home));
  const houses = Object.values(settlements).map(h => Hex(h));
  for (const [side, n] of neighbours(home).entries()) {
    const next = world.hexes.find(h => worldKey(h) == worldKey(n));
    if (!next || next.ocean) continue;
    const candidates = [];
    for (const goal of grid.filter(h => Hex(centre).distance(h) == radius - 2)) for (const [out, middle] of Grid.hexagon({
      center: goal,
      radius: 1
    }).neighborsOf(goal, ALL_SIDES).entries()) {
      const edge = Grid.hexagon({
        center: middle,
        radius: 1
      }).neighborsOf(middle, ALL_SIDES)[out];
      if (sideOfHex(edge, centre, radius) != side || Hex(centre).distance(middle) != radius - 1) continue;
      const patch = Grid.hexagon({
        center: goal,
        radius: 2
      });
      if (patch.some(h => !landscape[h] || settlements[h])) continue;
      const p = edge.toPoint(),
        c = Hex(centre).toPoint(),
        v = directions[side];
      const score = patch.reduce((sum, h) => sum + (landscape[h].terrain == "grassland" ? 0 : 10), 0) + Math.abs((p.x - c.x) * v.y - (p.y - c.y) * v.x) / 100;
      candidates.push({
        goal,
        middle,
        edge,
        out,
        score
      });
    }
    candidates.sort((a, b) => a.score - b.score || a.goal.x - b.goal.x || a.goal.y - b.goal.y);
    const entry = candidates[0];
    if (!entry) throw new Error("No land pass on side " + side);
    for (const h of Grid.hexagon({
      center: entry.goal,
      radius: 2
    })) landscape[h].terrain = "grassland";
    // Dijkstra prefers natural paths; it cuts a path only when terrain isolates a pass.
    const targets = new Set(houses.flatMap(h => Grid.hexagon({
      center: h,
      radius: 1
    }).neighborsOf(h, ALL_SIDES)).filter(h => landscape[h] && !settlements[h]).map(String));
    const queue = [{
        h: entry.goal,
        cost: 0
      }],
      costs = new Map([[String(entry.goal), 0]]),
      previous = new Map();
    let end;
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const {
        h,
        cost
      } = queue.shift();
      if (cost != costs.get(String(h))) continue;
      if (targets.has(String(h))) {
        end = h;
        break;
      }
      for (const n of Grid.hexagon({
        center: h,
        radius: 1
      }).neighborsOf(h, ALL_SIDES)) {
        if (!landscape[n] || settlements[n]) continue;
        const step = cost + (["grassland", "stone"].includes(landscape[n].terrain) ? 1 : 30);
        if (step < (costs.get(String(n)) ?? Infinity)) {
          costs.set(String(n), step);
          previous.set(String(n), h);
          queue.push({
            h: n,
            cost: step
          });
        }
      }
    }
    if (!end) throw new Error("Land pass cannot reach a village");
    for (let h = end; h; h = previous.get(String(h))) if (!["grassland", "stone"].includes(landscape[h].terrain)) landscape[h].terrain = "grassland";
    const outside = Grid.hexagon({
        center: entry.edge,
        radius: 1
      }).neighborsOf(entry.edge, ALL_SIDES)[entry.out].toPoint(),
      at = entry.edge.toPoint();
    result[side] = {
      hexes: [entry.edge, entry.middle, entry.goal].map(h => ({
        x: h.x,
        y: h.y
      })),
      start: {
        x: at.x + (outside.x - at.x) * 0.72,
        y: at.y + (outside.y - at.y) * 0.72
      },
      campPoint: entry.goal.toPoint(),
      villageReachable: true
    };
  }
  return result;
}
export function exitPoint(s, id) {
  const h = Hex().fromPoint(s.ecs.spatial[id]),
    at = h.toPoint(),
    centre = Hex(s.map.centre).toPoint();
  const outside = Grid.hexagon({
    center: h,
    radius: 1
  }).neighborsOf(h, ALL_SIDES).filter(n => Hex(s.map.centre).distance(n) > s.map.radius).sort((a, b) => {
    const p = a.toPoint(),
      q = b.toPoint();
    return (q.x - at.x) * (at.x - centre.x) + (q.y - at.y) * (at.y - centre.y) - (p.x - at.x) * (at.x - centre.x) - (p.y - at.y) * (at.y - centre.y);
  })[0].toPoint();
  return {
    x: at.x + (outside.x - at.x) * .72,
    y: at.y + (outside.y - at.y) * .72
  };
}
