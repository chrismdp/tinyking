import { Hex, Grid, ALL_SIDES } from "game/hex";
import { groundForState, safeTile, roadStep, ROAD_CROSS_SLOPE } from "game/geography";

export const roadAllowed = tile => !!tile && !tile.cropPlot && !tile.terrain.includes("water");
export const plotAllowed = (tile, worn = {}) => tile?.terrain == "grassland" && !tile.cropPlot &&
  !tile.route?.length && !Object.values(worn).some(n => n > 0);

export function fieldAtTile(state, tileId) {
  if (!state.ecs.farmable && !state.ecs.mappable?.[tileId]?.cropPlot) return false;
  const point = state.ecs.spatial[tileId];
  return !!state.ecs.mappable?.[tileId]?.cropPlot || !!(point &&
    (state.space?.[Hex().fromPoint(point)] || []).some(id => state.ecs.farmable?.[id]));
}
export function canPlaceField(state, tileId) {
  const { ecs } = state;
  if (!plotAllowed(ecs.mappable?.[tileId], ecs.walkable?.[tileId]?.worn) || ecs.walkable?.[tileId]?.trackReserved || fieldAtTile(state,tileId)) return false;
  const at = Hex().fromPoint(ecs.spatial[tileId]);
  if ((state.space[at] || []).some(id => ecs.building?.[id] || ecs.camp?.[id] || ecs.stockpile?.[id])) return false;
  // Preserve access around neighbouring plots and doors; fields cannot close a
  // one-tile neck. Future organic builders can use this same reservation rule.
  const adjacent = Object.values(ecs.walkable?.[tileId]?.neighbours || {});
  if (adjacent.some(id => fieldAtTile(state,id) && !Object.values(ecs.walkable[id].neighbours)
    .some(n => String(n)!=String(tileId) && !fieldAtTile(state,n)))) return false;
  const neighbours = adjacent.filter(id => !fieldAtTile(state,id));
  if (!neighbours.length) return false;
  const remaining = new Set(neighbours.map(String));
  const reached = new Set(), queue = [neighbours[0]];
  for (let i=0; i<queue.length; i++) {
    const id=queue[i];
    if (String(id)==String(tileId) || reached.has(String(id)) || fieldAtTile(state,id)) continue;
    reached.add(String(id));
    remaining.delete(String(id));
    if (!remaining.size) return true;
    queue.push(...Object.values(ecs.walkable[id].neighbours).filter(n=>!reached.has(String(n))));
  }
  return false;
}

// Reserve before adding the real farm entity. The whole tile is crop work
// space; its neighbours and road network remain the public access lanes.
export function reserveFieldPlot(state, tileId) {
  if (!canPlaceField(state,tileId)) return false;
  state.ecs.mappable[tileId].cropPlot = true;
  state.landUseRevision = (state.landUseRevision || 0) + 1;
  return true;
}

// Atomic reciprocal road reservation. No partial route is left on failure.
export function reserveRoad(state, tileIds) {
  const { ecs } = state;
  if (tileIds.some(id => !roadAllowed(ecs.mappable[id]) || fieldAtTile(state,id))) return false;
  const ground=state.map?.geography && groundForState(state);
  if(ground && tileIds.some(id=>!safeTile(ground,ecs.spatial[id],ROAD_CROSS_SLOPE))) return false;
  const links=[];
  for (let i=1;i<tileIds.length;i++) {
    const a=tileIds[i-1], b=tileIds[i], h=Hex().fromPoint(ecs.spatial[a]);
    const side=Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).findIndex(n=>n.equals(Hex().fromPoint(ecs.spatial[b])));
    if (side<0 || ground && !roadStep(ground,h,Hex().fromPoint(ecs.spatial[b]))) return false;
    links.push([a,side],[b,(side+3)%6]);
  }
  for(const [id,side] of links) {
    const route=ecs.mappable[id].route ||= [];
    if (!route.length && ecs.walkable?.[id]) { ecs.walkable[id].routeWear=100; ecs.walkable[id].wearUpdatedAt=state.days; }
    if(!route.includes(side)) route.push(side);
    state.redraws.push(id);
  }
  return true;
}
