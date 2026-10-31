import { Hex, Grid, ALL_SIDES } from "game/hex";
import { groundForState, safeTile, roadStep, ROAD_CROSS_SLOPE } from "game/geography";

export const roadAllowed = tile => !!tile && !tile.cropPlot && !tile.buildingPlot && !tile.terrain.includes("water");
export const plotAllowed = (tile, worn = {}) => tile?.terrain == "grassland" && !tile.cropPlot &&
  !tile.buildingPlot && !tile.route?.length && !Object.values(worn).some(n => n > 0);

export const transitBlocked = (state,id) => !!state.ecs.mappable?.[id]?.buildingPlot || fieldAtTile(state,id);
export function canReserveWorkYard(state,tileId,houseId) {
  const tile=state.ecs.mappable[tileId],walk=state.ecs.walkable[tileId];
  if(!tile || !walk || fieldAtTile(state,tileId))return false;
  if(tile.buildingPlot)return tile.buildingPlot==houseId;
  const occupied=(state.space[Hex().fromPoint(state.ecs.spatial[tileId])] || []).some(id=>
    state.ecs.building?.[id] || state.ecs.camp?.[id] || state.ecs.stockpile?.[id] || state.ecs.meetingPlace?.[id] ||
    state.ecs.pasture?.[id] || state.ecs.workplace?.[id] && state.ecs.workplace[id].houseId!=houseId);
  return !occupied && plotAllowed(tile,walk?.worn) && !walk?.trackReserved && preservesPublicAccess(state,tileId,houseId);
}
export function reserveWorkYard(state,tileId,houseId) {
  if(!canReserveWorkYard(state,tileId,houseId))return false;
  if(state.ecs.mappable[tileId].buildingPlot==houseId)return true;
  state.ecs.mappable[tileId].buildingPlot=houseId;
  state.landUseRevision=(state.landUseRevision || 0)+1;
  return true;
}

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
  return preservesPublicAccess(state,tileId);
}

// Removing a public tile must leave its public neighbours connected and every
// neighbouring work endpoint with an exit. Private property can have connected
// interior tiles, but cannot serve as the public bypass around another plot.
function preservesPublicAccess(state,tileId,houseId) {
  const {ecs}=state;
  const adjacent=Object.values(ecs.walkable?.[tileId]?.neighbours || {});
  const publicTile=id=>String(id)!=String(tileId) && !transitBlocked(state,id);
  const neighbours=adjacent.filter(publicTile);
  if(!neighbours.length)return false;
  for(const id of adjacent.filter(id=>transitBlocked(state,id))) {
    if(fieldAtTile(state,id)) {
      if(!Object.values(ecs.walkable[id].neighbours).some(publicTile))return false;
    } else {
      const owner=ecs.mappable[id].buildingPlot;
      if(owner==houseId)continue;
      const seen=new Set(),queue=[id];let exit=false;
      for(let i=0;i<queue.length && !exit;i++) {
        const next=queue[i];
        if(seen.has(next))continue;
        seen.add(next);
        for(const n of Object.values(ecs.walkable[next].neighbours)) {
          if(publicTile(n)){exit=true;break;}
          if(String(n)!=String(tileId) && !fieldAtTile(state,n) && ecs.mappable[n].buildingPlot==owner && !seen.has(n))queue.push(n);
        }
      }
      if(!exit)return false;
    }
  }
  const remaining=new Set(neighbours.map(String)),reached=new Set(),queue=[neighbours[0]];
  for(let i=0;i<queue.length;i++) {
    const id=queue[i];
    if(!publicTile(id) || reached.has(String(id)))continue;
    reached.add(String(id));remaining.delete(String(id));
    if(!remaining.size)return true;
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
