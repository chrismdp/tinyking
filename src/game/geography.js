import { roadAllowed } from "game/land_use";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { MAP_CENTRE, MAP_RADIUS, worldPoint, createLandField } from "game/world_terrain";
import { neighbours, worldKey, sideOfHex } from "game/travel_geometry";
import { createHeightField } from "game/height";

export const MAX_WALK_SLOPE = 0.65;
const grid = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
const around = h => Grid.hexagon({ center:h, radius:1 }).neighborsOf(h,ALL_SIDES);
const land = t => t && !t.includes("water");
const pointKey = p => Math.round(p.x*1000)+","+Math.round(p.y*1000);
const surveys = new WeakMap();
function survey(field, home) {
  if(!surveys.has(field)) surveys.set(field,new Map());
  const cache=surveys.get(field), key=worldKey(home);
  if(cache.has(key)) return cache.get(key);
  const tiles=new Map(grid.map(h=>[String(h),field.terrainAt(worldPoint(home,h.toPoint()))]));
  const remaining=new Set([...tiles].filter(([,t])=>land(t)).map(([k])=>k));
  let main=new Set();
  while(remaining.size) {
    const component=new Set(), queue=[Hex(...remaining.values().next().value.split(",").map(Number))];
    for(let i=0;i<queue.length;i++) {
      const h=queue[i], k=String(h); if(!remaining.delete(k)) continue;
      component.add(k); for(const n of around(h)) if(remaining.has(String(n))) queue.push(n);
    }
    if(component.size>main.size) main=component;
  }
  const ground=createHeightField({seed:0,
    terrainAt:k=>field.terrainAt(worldPoint(home,Hex(...k.split(",").map(Number)).toPoint())),
    elevationAt:(x,y)=>field.elevationAt?.(worldPoint(home,{x,y})) || 0});
  const result={tiles,main,ground}; cache.set(key,result); return result;
}
const fields=new Map();
export function landFieldFor(world) {
  const key=world.landSeed+":"+JSON.stringify(world.geographyFixture || null);
  if(!fields.has(key)) fields.set(key,createLandField(world.landSeed,world.geographyFixture));
  return fields.get(key);
}
export function mainLandKeys(world) {return survey(landFieldFor(world),world.home).main;}

// Canonical undirected edge contract. Both callers survey the SAME two cheap
// terrain grids, rank the SAME pairs, and select the SAME physical crossing.
// No map, history, entities or resources are generated or aged by this API.
export function routeCrossing(world, side, field=landFieldFor(world)) {
  const from=world.hexes.find(h=>worldKey(h)==worldKey(world.home));
  const next=world.hexes.find(h=>worldKey(h)==worldKey(neighbours(world.home)[side]));
  if(!from || !next || from.ocean || next.ocean) return null;
  const [a,b]=[from,next].sort((x,y)=>worldKey(x).localeCompare(worldKey(y)));
  const sa=neighbours(a).findIndex(h=>worldKey(h)==worldKey(b)), sb=(sa+3)%6;
  const A=survey(field,a), B=survey(field,b), centre=MAP_CENTRE.toPoint();
  const originA=worldPoint(a,centre), originB=worldPoint(b,centre);
  const bTiles=new Map(grid.map(h=>[pointKey(worldPoint(b,h.toPoint())),h]));
  const inward=(edge, data) => {
    const steps=[edge]; let h=edge;
    for(let i=0;i<2;i++) {
      h=around(h).filter(n=>data.main.has(String(n)) && MAP_CENTRE.distance(n)==MAP_RADIUS-i-1)
        .sort((x,y)=> x.x-y.x || x.y-y.y)[0];
      if(!h) return null; steps.push(h);
    }
    if(Grid.hexagon({center:h,radius:2}).some(n=>!land(data.tiles.get(String(n))))) return null;
    return steps;
  };
  const candidates=[];
  for(const edge of grid.filter(h=>sideOfHex(h,MAP_CENTRE,MAP_RADIUS)==sa && A.main.has(String(h)))) {
    for(const n of around(edge).filter(h=>MAP_CENTRE.distance(h)>MAP_RADIUS)) {
      const target=bTiles.get(pointKey(worldPoint(a,n.toPoint())));
      if(!target || sideOfHex(target,MAP_CENTRE,MAP_RADIUS)!=sb || !B.main.has(String(target))) continue;
      const left=inward(edge,A), right=inward(target,B); if(!left || !right) continue;
      if(!safeTile(A.ground,edge.toPoint()) || !safeTile(B.ground,target.toPoint())) continue;
      const p=worldPoint(a,edge.toPoint()), q=worldPoint(b,target.toPoint());
      const crossing={x:(p.x+q.x)/2,y:(p.y+q.y)/2};
      const score=(field.elevationAt?.(crossing)||0)*5+Math.hypot(crossing.x-(originA.x+originB.x)/2,crossing.y-(originA.y+originB.y)/2)*.12;
      candidates.push({left,right,crossing,score});
    }
  }
  candidates.sort((x,y)=>x.score-y.score || x.crossing.x-y.crossing.x || x.crossing.y-y.crossing.y);
  const chosen=candidates[0]; if(!chosen) return null;
  const mine=worldKey(from)==worldKey(a)?chosen.left:chosen.right;
  const peer=worldKey(from)==worldKey(a)?chosen.right:chosen.left;
  return {key:worldKey(a)+"/"+worldKey(b), crossing:chosen.crossing,
    hexes:mine.map(h=>({x:h.x,y:h.y})), facingHexes:peer.map(h=>({x:h.x,y:h.y}))};
}
export function sharedEntrances(landscape, world) {
  const entries={};
  for(const side of ALL_SIDES) {
    const contract=routeCrossing(world,side); if(!contract) continue;
    const [edge,middle,goal]=contract.hexes.map(h=>Hex(h));
    for(const h of Grid.hexagon({center:goal,radius:2})) landscape[h].terrain="grassland";
    const at=edge.toPoint(), c=worldPoint(world.home,at), v={x:contract.crossing.x-c.x,y:contract.crossing.y-c.y};
    entries[side]={...contract,start:{x:at.x+v.x*1.44,y:at.y+v.y*1.44},campPoint:goal.toPoint()};
    landscape[edge].terrain=landscape[middle].terrain="grassland";
  }
  return entries;
}
function routeTo(start, targets, landscape, settlements, inland) {
  const queue=[{h:start,cost:0}], costs=new Map([[String(start),0]]), prev=new Map();
  while(queue.length) {
    queue.sort((a,b)=>a.cost-b.cost); const {h,cost}=queue.shift(), k=String(h);
    if(cost!=costs.get(k)) continue;
    if(targets.has(k)) {const result=[];for(let p=h;p;p=prev.get(String(p))) result.push(p);return result.reverse();}
    for(const n of around(h)) {
      const t=landscape[n]; if(!t || !roadAllowed(t) || settlements[n] || inland && MAP_CENTRE.distance(n)>MAP_RADIUS-2) continue;
      const rise=Math.abs(t.elevation-landscape[h].elevation);
      const step=cost+1+t.elevation/110+rise/14;
      if(step<(costs.get(String(n))??Infinity)){costs.set(String(n),step);prev.set(String(n),h);queue.push({h:n,cost:step});}
    }
  }
  return null;
}
export function buildGeography(tiles, landscape, settlements, entrances, anchors=[], surface={}) {
  const routes=[], network=new Set(), controls=[];
  const targets=[...anchors, ...Object.values(entrances).map(e=>Hex(e.hexes[2])),
    ...Object.values(settlements).map(h=>around(Hex(h))[h.frontDoorSide])].filter(h=>landscape[h]);
  if(targets.length) network.add(String(targets[0]));
  for(const target of targets.slice(1)) {
    const route=routeTo(target,network,landscape,settlements,!!surface.elevationAt); if(!route) continue;
    routes.push(route.map(h=>({x:h.x,y:h.y})));
    for(const h of route) network.add(String(h));
  }
  const mark=(h,side)=>{const t=landscape[h]; t.route ||= []; if(!t.route.includes(side))t.route.push(side); t.terrain="grassland";};
  const connect=(a,b)=>{const side=around(a).findIndex(h=>h.equals(b));mark(a,side);mark(b,(side+3)%6);};
  for(const route of routes) for(let i=1;i<route.length;i++)connect(Hex(route[i-1]),Hex(route[i]));
  for(const entry of Object.values(entrances)) {
    const hs=entry.hexes.map(h=>Hex(h)); connect(hs[0],hs[1]);connect(hs[1],hs[2]);
    const at=hs[0].toPoint(); const outer=around(hs[0]).map((h,i)=>({h,i,p:h.toPoint()})).filter(v=>MAP_CENTRE.distance(v.h)>MAP_RADIUS)
      .sort((a,b)=>Math.hypot(a.p.x-entry.start.x,a.p.y-entry.start.y)-Math.hypot(b.p.x-entry.start.x,b.p.y-entry.start.y))[0];
    mark(hs[0],outer.i);
    for(const h of Grid.hexagon({center:hs[2],radius:2})) controls.push({...h.toPoint(),height:landscape[h].elevation,flat:65});
    network.add(String(hs[0]));network.add(String(hs[1]));
    controls.push({...at,height:landscape[hs[0]].elevation,flat:65});
  }
  for(const h of Object.values(settlements)) {
    const hex=Hex(h), door=around(hex)[h.frontDoorSide];
    connect(hex,door);
    network.add(String(hex)); network.add(String(door));
    controls.push({...hex.toPoint(),height:landscape[hex].elevation,flat:155});
  }
  for(const h of anchors) controls.push({...h.toPoint(),height:landscape[h].elevation,flat:155});
  // Lower the road's grade towards low points, in both directions through the
  // whole network. No stairs or isolated cone cutouts at mountain tile borders.
  const grades=new Map([...network].map(k=>[k,landscape[k].elevation]));
  for(const c of controls) for(const [k,h] of grades) {const p=landscape[k];grades.set(k,Math.min(h,c.height+Math.max(0,Math.hypot(p.x-c.x,p.y-c.y)-c.flat)*.24));}
  const queue=[...grades].map(([k,height])=>({k,height}));
  while(queue.length){queue.sort((a,b)=>a.height-b.height);const {k,height}=queue.shift();if(height!=grades.get(k))continue;
    for(const n of around(Hex(...k.split(",").map(Number)))) {const nk=String(n);if(!grades.has(nk))continue;const next=height+Hex().height()*.24;if(next<grades.get(nk)){grades.set(nk,next);queue.push({k:nk,height:next});}}
  }
  for(const [k,height] of grades)controls.push({...landscape[k],height,flat:65});
  const natural=createHeightField({seed:0,terrainAt:k=>landscape[k]?.terrain || surface.terrainAt?.(Hex(...k.split(",").map(Number)).toPoint()),elevationAt:surface.elevationAt || ((x,y)=>{
    const h=Hex().fromPoint(x,y), nearby=Grid.hexagon({center:h,radius:1}).filter(n=>landscape[n]);
    let sum=0,total=0;for(const n of nearby){const p=landscape[n],w=1/Math.max(1,Math.hypot(x-p.x,y-p.y))**2;sum+=p.elevation*w;total+=w;}return sum/total;
  })});
  const heights={};
  for(const hex of tiles) for(const o of Hex().corners()) {
    const p=hex.toPoint(), x=p.x+o.x,y=p.y+o.y,key=pointKey({x,y});if(key in heights)continue;
    let height=natural.cornerHeight(x,y);
    // Both regions retain the exact natural shared corners. Local pads cannot
    // lower an elevated border into a sea-level trench.
    const boundary = surface.elevationAt && Grid.hexagon({center:Hex().fromPoint({x,y}),radius:1})
      .some(h=>!landscape[h] && Math.hypot(h.toPoint().x-x,h.toPoint().y-y)<61);
    if (!boundary) for(const c of controls)height=Math.min(height,c.height+Math.max(0,Math.hypot(x-c.x,y-c.y)-c.flat)*.55);
    heights[key]=height;
  }
  return {version:1,heights,routes};
}
export function groundForState(state) {
  return createHeightField({seed:state.map.seed,
    terrainAt:key=>{const id=(state.space[key]||[]).find(e=>state.ecs.mappable[e]);return id && state.ecs.mappable[id].terrain;},
    cornerAt:state.map.geography ? (x,y)=>state.map.geography.heights[pointKey({x,y})] : undefined});
}
export function safeTile(ground, p) {
  const corners=Hex().corners();
  return corners.every((o,k)=>{const next=corners[(k+1)%6];const {dx,dy}=ground.slopeAt(p.x+(o.x+next.x)*.25,p.y+(o.y+next.y)*.25);return Math.hypot(dx,dy)<=MAX_WALK_SLOPE;});
}
