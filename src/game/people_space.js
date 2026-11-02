import { Hex, Grid, hexAtPoint } from "game/hex";

// The terrain index contains immovable entities only. This equivalent hex
// lookup tracks bodies separately, without adding them to terrain/work pools.
// It is transient: a new ECS/spatial map (load or travel) builds it once.
const indexes=new WeakMap();
export function indexPeople(s) {
  const index={cells:new Map(),locations:new Map()};
  indexes.set(s.ecs.spatial,index);
  for(const id of Object.keys(s.ecs.spatial||{}))if(s.ecs.personable?.[id])updatePersonCell(s,id);
  return index;
}
export function updatePersonCell(s,id) {
  const index=indexes.get(s.ecs.spatial),point=s.ecs.spatial?.[id];
  if(!index)return;
  const key=point && s.ecs.personable?.[id] ? String(hexAtPoint(point)) : null,old=index.locations.get(id);
  if(old==key)return;
  if(old!=null)index.cells.get(old)?.delete(id);
  if(key!=null) {
    if(!index.cells.has(key))index.cells.set(key,new Set());
    index.cells.get(key).add(id);index.locations.set(id,key);
  } else index.locations.delete(id);
}
export function nearbyPeople(s,point,reach) {
  if(!point)return [];
  const index=indexes.get(s.ecs.spatial)||indexPeople(s);
  // Hex centres are 104 units apart. Two rings cover an 85-unit circle
  // even when its centre lies on a hex corner.
  const cells=Grid.hexagon({center:Hex().fromPoint(point),radius:Math.ceil(reach/90)+1});
  return cells.flatMap(h=>[...(index.cells.get(String(h))||[])]).filter(id=>{
    const p=s.ecs.spatial[id];return p && (p.x-point.x)**2+(p.y-point.y)**2<=reach**2;
  });
}
