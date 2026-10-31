// One footprint for visible boards and local walking. Coordinates follow ECS
// spatial, with the gate on the positive-y side. No tile becomes unwalkable.
export const FENCE_CLEARANCE = 5;
export function fenceFootprints(state) {
  const ecs = state.ecs;
  const ids = new Set([...Object.keys(ecs.pasture || {}), ...Object.keys(ecs.fence || {})]);
  return [...ids].filter(id => ecs.spatial[id]).map(id => {
    const source = ecs.fence?.[id] || ecs.pasture[id];
    return { id, x: ecs.spatial[id].x, y: ecs.spatial[id].y,
      halfWidth: source.halfWidth, halfDepth: source.halfDepth,
      gateHalfWidth: source.gateHalfWidth ?? Math.min(12, source.halfWidth * .65) };
  });
}
export const fenceRevision = fences => fences.map(f => [f.id,f.x,f.y,f.halfWidth,f.halfDepth,f.gateHalfWidth].join(":")).join("|");
export function fenceSegments(f) {
  const { x, y, halfWidth:w, halfDepth:d, gateHalfWidth:g } = f;
  const p = (a,b) => ({ x:x+a, y:y+b });
  return [[p(-w,-d),p(w,-d)],[p(-w,-d),p(-w,d)],[p(w,-d),p(w,d)],
    [p(-w,d),p(-g,d)],[p(g,d),p(w,d)]];
}
const inside = (p,f) => Math.abs(p.x-f.x)<f.halfWidth && Math.abs(p.y-f.y)<f.halfDepth;
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

// A small visibility graph only around fences touched by this walking segment.
// Access routes may cross a gate; ordinary transit treats the interior as solid.
export function fenceRoute(state, start, end, footprints = fenceFootprints(state), canWalk = () => true) {
  const margin = FENCE_CLEARANCE;
  const fences = footprints.filter(f => f.x+f.halfWidth+margin >= Math.min(start.x,end.x)-100 &&
    f.x-f.halfWidth-margin <= Math.max(start.x,end.x)+100 &&
    f.y+f.halfDepth+margin >= Math.min(start.y,end.y)-100 && f.y-f.halfDepth-margin <= Math.max(start.y,end.y)+100);
  if (!fences.length) return [end];
  const access = new Set(fences.filter(f=>inside(start,f)||inside(end,f)).map(f=>f.id));
  const clear = (a,b) => canWalk(a,b) && fences.every(f => {
    const w=f.halfWidth+margin,d=f.halfDepth+margin;
    // Clip against the expanded rectangle. A nonzero interior interval is an obstruction.
    let lo=0,hi=1;
    for(const [v,delta,size] of [[a.x-f.x,b.x-a.x,w],[a.y-f.y,b.y-a.y,d]]) {
      if(Math.abs(delta)<1e-9) { if(Math.abs(v)>=size) return true; }
      else { const t1=(-size-v)/delta,t2=(size-v)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2)); }
    }
    if(hi-lo<1e-8) return true;
    if(!access.has(f.id)) return false;
    // Interior motion is fine; every entry/exit must cross the real gate corridor.
    for(const t of [lo,hi]) {
      if(t<=1e-8 || t>=1-1e-8) continue;
      const x=a.x+(b.x-a.x)*t-f.x,y=a.y+(b.y-a.y)*t-f.y;
      if(Math.abs(y-d)>1e-6 || Math.abs(x)>f.gateHalfWidth-margin) return false;
    }
    return true;
  });
  if(clear(start,end)) return [end];
  const nodes=[start,end];
  for(const f of fences) {
    for(const x of [-1,1])for(const y of [-1,1])nodes.push({x:f.x+x*(f.halfWidth+margin+.1),y:f.y+y*(f.halfDepth+margin+.1)});
    if(access.has(f.id)) nodes.push({x:f.x,y:f.y+f.halfDepth+margin+.1},{x:f.x,y:f.y+f.halfDepth-margin-.1});
  }
  const costs=nodes.map(()=>Infinity),previous=[],done=new Set();costs[0]=0;
  while(done.size<nodes.length) {
    let i=-1;
    for(let k=0;k<nodes.length;k++)if(!done.has(k)&&(i<0||costs[k]<costs[i]))i=k;
    if(i<0||!Number.isFinite(costs[i]))return null;
    if(i==1) {const result=[];for(let k=1;k!=0;k=previous[k])result.unshift(nodes[k]);return result;}
    done.add(i);
    for(let k=0;k<nodes.length;k++)if(!done.has(k)&&clear(nodes[i],nodes[k])) {
      const cost=costs[i]+distance(nodes[i],nodes[k]);if(cost<costs[k]){costs[k]=cost;previous[k]=i;}
    }
  }
  return null;
}

// Tile crossings stay in the existing land/door graph. Fences add local detail.
export function clearFencePoint(point, footprints) {
  return footprints.every(f => Math.abs(point.x-f.x) >= f.halfWidth+FENCE_CLEARANCE || Math.abs(point.y-f.y) >= f.halfDepth+FENCE_CLEARANCE);
}
