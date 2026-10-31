import { roadAllowed } from "game/land_use";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { MAP_CENTRE, MAP_RADIUS, worldPoint, createLandField } from "game/world_terrain";
import { neighbours, worldKey, sideOfHex } from "game/travel_geometry";
import { createHeightField } from "game/height";

export const MAX_WALK_SLOPE = 0.65;
export const ROAD_GRADE = 0.24;
export const ROAD_CROSS_SLOPE = 0.55;
const PAD_EARTHWORK = 35;
const ROAD_EARTHWORK = 55;
const PAD_BLEND = 180;
const grid = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
// Neighbour geometry is independent of seed, grades and land reservations.
const neighbourhoods = new Map();
const around = h => {
  const key=String(h);
  if(!neighbourhoods.has(key))neighbourhoods.set(key,Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES));
  return neighbourhoods.get(key);
};
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
  const walkable=new Set([...main].filter(k=>safeTile(ground,Hex(...k.split(",").map(Number)).toPoint())));
  main=new Set();
  while(walkable.size) {
    const component=new Set(), queue=[Hex(...walkable.values().next().value.split(",").map(Number))];
    for(let i=0;i<queue.length;i++) {
      const h=queue[i];if(!walkable.delete(String(h))) continue;
      component.add(String(h));
      for(const n of around(h)) if(walkable.has(String(n))) queue.push(n);
    }
    if(component.size>main.size) main=component;
  }
  const result={tiles,main,ground}; cache.set(key,result); return result;
}
const fields=new Map();
export function landFieldFor(world) {
  const key=world.landSeed+":"+JSON.stringify(world.geographyFixture || null);
  if(!fields.has(key)) fields.set(key,createLandField(world.landSeed,world.geographyFixture));
  return fields.get(key);
}
export function mainLandKeys(world) {return survey(landFieldFor(world),world.home).main;}
export function naturalGroundFor(world) {return survey(landFieldFor(world),world.home).ground;}
function blendAt(natural, x, y, changed) {
  let total=0,correction=0,strongest=0;
  for(const v of changed) {
    const t=Math.hypot(x-v.x,y-v.y)/PAD_BLEND;
    if(t>=1) continue;
    const w=(1-t*t*(3-2*t))**2;
    correction+=w*(v.height-v.original);total+=w;strongest=Math.max(strongest,w);
  }
  return natural.cornerHeight(x,y)+(total ? correction/total*strongest : 0);
}
export function suitableHouse(ground, p) {
  const {centre,corners}=ground.hex(p), hex=Hex().fromPoint(p);
  if(!corners.every(height=>Math.abs(height-centre)<=PAD_EARTHWORK)) return false;
  const fixed=new Map(Hex().corners().map((o,k)=>[pointKey({x:p.x+o.x,y:p.y+o.y}),{x:p.x+o.x,y:p.y+o.y,original:corners[k],height:centre}]));
  const changed=[...fixed.values()].filter(v=>Math.abs(v.height-v.original)>1e-7);
  const local=createHeightField({seed:0,terrainAt:()=>"grassland",cornerAt:(x,y)=>
    fixed.get(pointKey({x,y}))?.height ?? (ground.cornerHeight(x,y)==0 ? 0 : blendAt(ground,x,y,changed))});
  // Level only a genuinely suitable site: its pad must leave the surrounding
  // naturally walkable apron open, rather than creating an isolated island.
  return around(hex).every(h=>!safeTile(ground,h.toPoint()) || safeTile(local,h.toPoint()));
}
export function roadStep(ground, a, b) {
  const p=a.toPoint(),q=b.toPoint(),dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);
  return [.25,.75].every(t=>{
    const s=ground.slopeAt(p.x+dx*t,p.y+dy*t);
    return Math.abs((s.dx*dx+s.dy*dy)/d)<=ROAD_GRADE+1e-8;
  });
}
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
      h=around(h).filter(n=>data.main.has(String(n)) && safeTile(data.ground,n.toPoint(),ROAD_CROSS_SLOPE) && roadStep(data.ground,h,n) && MAP_CENTRE.distance(n)==MAP_RADIUS-i-1)
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
      if(!safeTile(A.ground,edge.toPoint(),ROAD_CROSS_SLOPE) || !safeTile(B.ground,target.toPoint(),ROAD_CROSS_SLOPE)) continue;
      if(!roadStep(A.ground,edge,n)) continue;
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
function routeTo(start, targets, landscape, settlements, inland, ground, blocked, pinned) {
  const queue=[{h:start,cost:0}], costs=new Map([[String(start),0]]), prev=new Map();
  while(queue.length) {
    queue.sort((a,b)=>a.cost-b.cost); const {h,cost}=queue.shift(), k=String(h);
    if(cost!=costs.get(k)) continue;
    if(targets.has(k)) {const result=[];for(let p=h;p;p=prev.get(String(p))) result.push(p);return result.reverse();}
    for(const n of around(h)) {
      const t=landscape[n]; if(!t || !roadAllowed(t) || settlements[n] || inland && MAP_CENTRE.distance(n)>MAP_RADIUS-2) continue;
      if (blocked.has(String(n)) || !safeTile(ground,n.toPoint(),1.5)) continue;
      if ((pinned.has(k) || pinned.has(String(n))) && !roadStep(ground,h,n)) continue;
      const rise=Math.abs(t.elevation-landscape[h].elevation);
      const step=cost+1+t.elevation/110+rise/14+Math.max(0,rise-Hex().height()*ROAD_GRADE);
      if(step<(costs.get(String(n))??Infinity)){costs.set(String(n),step);prev.set(String(n),h);queue.push({h:n,cost:step});}
    }
  }
  return null;
}
// Each constraint uses the same six-corner fan as heightAt, picking and
// rendering. Alternating projections find a feasible local surface inside
// bounded cut/fill intervals. Houses and canonical boundary corners are fixed.
function gradeRoads(roadHexes, roadSides, initial, natural, settlements, surface, landscape, fixedHexes=[]) {
  const offsets=Hex().corners(), vertices=new Map();
  const boundary=(x,y)=>{
    if(!surface.elevationAt)return false;
    const h=Hex().fromPoint({x,y});
    return [h,...around(h)].some(n=>!landscape[n] && Math.hypot(n.toPoint().x-x,n.toPoint().y-y)<61);
  };
  const vertex=(x,y)=>{
    const key=pointKey({x,y});
    if(!vertices.has(key)) {
      const original=natural.cornerHeight(x,y), fixed=boundary(x,y) || original==0;
      vertices.set(key,{key,x,y,original,height:initial[key],low:fixed?original:original-ROAD_EARTHWORK,high:fixed?original:original+ROAD_EARTHWORK});
    }
    return vertices.get(key);
  };
  for(const h of fixedHexes) {
    const p=h.toPoint();
    for(const o of offsets) {const v=vertex(p.x+o.x,p.y+o.y);v.height=v.low=v.high=v.original;}
  }
  for(const h of Object.values(settlements)) {
    const p=Hex(h).toPoint(), height=natural.hex(p).centre;
    for(const o of offsets) {const v=vertex(p.x+o.x,p.y+o.y);v.height=v.low=v.high=height;}
  }
  const constraints=[];
  for(const hex of roadHexes) {
    const p=hex.toPoint(), vs=offsets.map(o=>vertex(p.x+o.x,p.y+o.y));
    for(let k=0;k<6;k++) {
      const j=(k+1)%6, a=offsets[k], b=offsets[j], det=a.x*b.y-a.y*b.x;
      const dx=Array(6).fill((a.y-b.y)/det/6), dy=Array(6).fill((b.x-a.x)/det/6);
      dx[k]+=b.y/det;dx[j]-=a.y/det;dy[k]-=b.x/det;dy[j]+=a.x/det;
      const along=(roadSides.get(String(hex)) || []).filter(side=>{
        const n=around(hex)[side].toPoint();
        const angle=(Math.atan2(n.y-p.y,n.x-p.x)+Math.PI*2)%(Math.PI*2);
        return Math.floor(angle/(Math.PI/3))==k;
      }).map(side=>{
        const n=around(hex)[side].toPoint(), x=n.x-p.x,y=n.y-p.y,d=Math.hypot(x,y);
        return dx.map((a,i)=>(a*x+dy[i]*y)/d);
      });
      constraints.push({hex,vs,dx,dy,along});
    }
  }
  const project=(vs,coeff,excess)=>{
    const norm=coeff.reduce((sum,c,i)=>sum+(vs[i].low==vs[i].high?0:c*c),0);
    if(!norm) return;
    vs.forEach((v,i)=>{if(v.low!=v.high)v.height=Math.max(v.low,Math.min(v.high,v.height-excess*coeff[i]/norm));});
  };
  const violation=c=>{
    const x=c.dx.reduce((sum,a,i)=>sum+a*c.vs[i].height,0), y=c.dy.reduce((sum,a,i)=>sum+a*c.vs[i].height,0);
    return Math.max(Math.hypot(x,y)-ROAD_CROSS_SLOPE,...c.along.map(coeff=>Math.abs(coeff.reduce((sum,a,i)=>sum+a*c.vs[i].height,0))-ROAD_GRADE));
  };
  let worst;
  for(let iteration=0;iteration<600;iteration++) {
    for(const c of constraints) {
      const x=c.dx.reduce((sum,a,i)=>sum+a*c.vs[i].height,0), y=c.dy.reduce((sum,a,i)=>sum+a*c.vs[i].height,0), length=Math.hypot(x,y);
      if(length>ROAD_CROSS_SLOPE) project(c.vs,c.dx.map((a,i)=>(a*x+c.dy[i]*y)/length),length-ROAD_CROSS_SLOPE);
      for(const coeff of c.along) {
        const grade=coeff.reduce((sum,a,i)=>sum+a*c.vs[i].height,0);
        if(Math.abs(grade)>ROAD_GRADE) project(c.vs,coeff,grade-Math.sign(grade)*ROAD_GRADE);
      }
    }
    worst=constraints.reduce((a,b)=>!a || violation(b)>violation(a)?b:a,null);
    if(!worst || violation(worst)<1e-8) break;
  }
  if(worst && violation(worst)>1e-6) return {blocked:worst.hex,violation:violation(worst)};
  const heights={...initial};
  for(const v of vertices.values()) heights[v.key]=v.height;
  // Blend corrections out into one local neighbourhood. Constrained corners
  // remain exact, including corners shared by a house and a road.
  const changed=[...vertices.values()].filter(v=>Math.abs(v.height-v.original)>1e-7);
  for(const key of Object.keys(heights)) {
    if(vertices.has(key)) continue;
    const [x,y]=key.split(",").map(n=>+n/1000);
    if(boundary(x,y) || natural.cornerHeight(x,y)==0) continue;
    heights[key]=blendAt(natural,x,y,changed);
  }
  return {heights};
}
export function buildGeography(tiles, landscape, settlements, entrances, anchors=[], surface={}) {
  const natural = createHeightField({seed:0,
    terrainAt:k=>landscape[k]?.terrain || surface.terrainAt?.(Hex(...k.split(",").map(Number)).toPoint()),
    elevationAt:surface.elevationAt || ((x,y)=>{
      const h=Hex().fromPoint(x,y), nearby=Grid.hexagon({center:h,radius:1}).filter(n=>landscape[n]);
      let sum=0,total=0;
      for(const n of nearby){const p=landscape[n],w=1/Math.max(1,Math.hypot(x-p.x,y-p.y))**2;sum+=p.elevation*w;total+=w;}
      return sum/total;
    })});
  for(const [key,h] of Object.entries(settlements)) {
    const hex=Hex(h);
    if(!suitableHouse(natural,hex.toPoint()) || surface.elevationAt && around(hex).some(n=>!landscape[n])) delete settlements[key];
  }
  const heights={};
  for(const hex of tiles) for(const o of Hex().corners()) {
    const p=hex.toPoint(),x=p.x+o.x,y=p.y+o.y;
    heights[pointKey({x,y})]=natural.cornerHeight(x,y);
  }
  // Prefer an approach along the local contour. The shared-vertex solver
  // below tests the actual finished door and route triangles together.
  const approaches=new Map();
  const prepareApproach=h=>{
    const hex=Hex(h), p=hex.toPoint();
    const candidates=around(hex).map((n,side)=>({n,side}))
      .filter(({n})=>landscape[n] && !settlements[n] && roadAllowed(landscape[n]))
      .sort((a,b)=>Math.abs(natural.hex(a.n.toPoint()).centre-natural.hex(p).centre)-Math.abs(natural.hex(b.n.toPoint()).centre-natural.hex(p).centre));
    approaches.set(h,candidates);
    if(candidates.length) h.frontDoorSide=candidates.shift().side;
  };
  for(const h of Object.values(settlements)) prepareApproach(h);
  const entranceHexes=()=>Object.values(entrances).flatMap(e=>e.hexes.map(h=>Hex(h)));
  const fixedRoads=()=>[...entranceHexes(),...Object.values(settlements).flatMap(h=>[Hex(h),around(Hex(h))[h.frontDoorSide]])];
  const sidesFor=routes=>{
    const sides=new Map();
    const link=(a,b)=>{
      const side=around(a).findIndex(h=>h.equals(b));
      for(const [h,s] of [[a,side],[b,(side+3)%6]]) {
        const at=sides.get(String(h)) || [];
        if(!at.includes(s)) at.push(s);
        sides.set(String(h),at);
      }
    };
    for(const route of routes) for(let i=1;i<route.length;i++) link(Hex(route[i-1]),Hex(route[i]));
    for(const h of Object.values(settlements)) link(Hex(h),around(Hex(h))[h.frontDoorSide]);
    for(const e of Object.values(entrances)) {
      const hs=e.hexes.map(h=>Hex(h));link(hs[0],hs[1]);link(hs[1],hs[2]);
      const outer=around(hs[0]).filter(h=>!landscape[h]).sort((a,b)=>Math.hypot(a.toPoint().x-e.start.x,a.toPoint().y-e.start.y)-Math.hypot(b.toPoint().x-e.start.x,b.toPoint().y-e.start.y))[0];
      link(hs[0],outer);
    }
    return sides;
  };
  const unsafeApron=heights=>{
    const local=createHeightField({seed:0,terrainAt:k=>landscape[k]?.terrain,
      cornerAt:(x,y)=>heights[pointKey({x,y})] ?? natural.cornerHeight(x,y)});
    return Object.values(settlements).find(h=>around(Hex(h)).some(n=>
      safeTile(natural,n.toPoint()) && !safeTile(local,n.toPoint())));
  };
  const triedSites=new Set(Object.keys(settlements));
  const rejectHouse=house=>{
    // Retain the hamlet's real central neighbour when resolving overlapping
    // aprons. Move the conflicting house to another eligible local site.
    const neighbour=house.villageCentre && Object.values(settlements)
      .filter(h=>h!=house && !h.villageCentre && Hex(h).distance(Hex(house))<=4)
      .sort((a,b)=>Hex(a).distance(Hex(house))-Hex(b).distance(Hex(house)))[0];
    const rejected=neighbour || house, villageId=rejected.villageId;
    delete settlements[Hex(rejected)];
    const centre=Object.values(settlements).find(h=>h.villageId==villageId && h.villageCentre);
    const replacement=centre && surface.settlementSites?.find(h=>!triedSites.has(String(h)) &&
      h.distance(Hex(centre))<=3 && Object.values(settlements).every(other=>h.distance(Hex(other))>=2));
    if(replacement) {
      triedSites.add(String(replacement));
      const placed={...rejected,x:replacement.x,y:replacement.y,villageCentre:false};
      settlements[replacement]=placed;
      for(const h of Grid.hexagon({center:replacement,radius:1})) landscape[h].terrain="grassland";
      prepareApproach(placed);
    } else if(villageId && Object.values(settlements).filter(h=>h.villageId==villageId).length<3) {
      // A hamlet requires three suitable houses. Leave an unbuildable clearing
      // uninhabited instead of placing an isolated fragment of that hamlet.
      for(const [key,h] of Object.entries(settlements)) if(h.villageId==villageId) delete settlements[key];
    }
  };
  // Establish locally feasible occupied sites first. Every failed attempt
  // consumes a door approach or rejects that placement, so this work is finite.
  let base;
  while(true) {
    base=gradeRoads(fixedRoads(),sidesFor([]),heights,natural,settlements,surface,landscape,entranceHexes());
    if(!base.blocked) {
      const house=unsafeApron(base.heights);
      if(!house) break;
      const next=approaches.get(house).shift();
      if(next) house.frontDoorSide=next.side;
      else rejectHouse(house);
      continue;
    }
    const house=Object.values(settlements).find(h=>Hex(h).equals(base.blocked) || around(Hex(h))[h.frontDoorSide].equals(base.blocked)) ||
      Object.values(settlements).find(h=>Hex(h).distance(base.blocked)<=2);
    if(house) {
      const next=approaches.get(house).shift();
      if(next) house.frontDoorSide=next.side;
      else rejectHouse(house);
    } else {
      const [side]=Object.entries(entrances).find(([,e])=>e.hexes.some(h=>Hex(h).equals(base.blocked)));
      // Generated canonical chains are naturally safe. Reject an unsuitable
      // explicit entrance fixture rather than forcing it through a cliff.
      delete entrances[side];
    }
  }
  let final=base.heights;
  // Keep actual compound space available before optional public connections
  // are surveyed. No existing road or later walking wear is removed.
  const yards=new Set(),fixed=new Set(fixedRoads().map(String));
  if(surface.reserveHouseYards) {
    const local=createHeightField({seed:0,terrainAt:k=>landscape[k]?.terrain,
      cornerAt:(x,y)=>final[pointKey({x,y})] ?? natural.cornerHeight(x,y)});
    for(const house of Object.values(settlements)) {
      const candidates=around(Hex(house)).map((h,side)=>({h,side})).filter(({h})=>landscape[h]?.terrain=="grassland" && !fixed.has(String(h)) && !yards.has(String(h)) &&
        anchors.every(camp=>Hex(camp).distance(h)>2) && Object.values(entrances).every(e=>Hex(e.hexes[2]).distance(h)>2) && safeTile(local,h.toPoint()));
      const rear=(house.frontDoorSide+3)%6;
      candidates.sort((a,b)=>Math.min((a.side-rear+6)%6,(rear-a.side+6)%6)-Math.min((b.side-rear+6)%6,(rear-b.side+6)%6) || a.side-b.side);
      if(candidates.length){house.yardHex={x:candidates[0].h.x,y:candidates[0].h.y};yards.add(String(candidates[0].h));}
    }
  }
  const routes=[], network=new Set(), pinned=new Set(entranceHexes().map(String));
  const targets=[...anchors,...Object.values(entrances).map(e=>Hex(e.hexes[2])),
    ...Object.values(settlements).map(h=>around(Hex(h))[h.frontDoorSide])].filter(h=>landscape[h]);
  if(targets.length) network.add(String(targets[0]));
  for(const target of targets.slice(1)) {
    const local=createHeightField({seed:0,terrainAt:k=>landscape[k]?.terrain,
      cornerAt:(x,y)=>final[pointKey({x,y})] ?? natural.cornerHeight(x,y)});
    const route=routeTo(target,network,landscape,settlements,!!surface.elevationAt,local,yards,pinned);
    if(!route) continue;
    const proposal=[...routes,route.map(h=>({x:h.x,y:h.y}))];
    const roadHexes=[...new Map([...fixedRoads(),...proposal.flat().map(h=>Hex(h))].map(h=>[String(h),h])).values()];
    const graded=gradeRoads(roadHexes,sidesFor(proposal),final,natural,settlements,surface,landscape,entranceHexes());
    // A failed optional connection leaves the previous feasible surface intact.
    // Do not repeatedly rebuild every road to force a corridor through a ridge.
    if(graded.blocked || unsafeApron(graded.heights)) continue;
    routes.push(proposal[proposal.length-1]);
    for(const h of route) network.add(String(h));
    final=graded.heights;
  }
  Object.assign(heights,final);
  const mark=(h,side)=>{const t=landscape[h]; t.route ||= []; if(!t.route.includes(side))t.route.push(side); t.terrain="grassland";};
  const connect=(a,b)=>{const side=around(a).findIndex(h=>h.equals(b));mark(a,side);mark(b,(side+3)%6);};
  for(const route of routes) for(let i=1;i<route.length;i++)connect(Hex(route[i-1]),Hex(route[i]));
  for(const entry of Object.values(entrances)) {
    const hs=entry.hexes.map(h=>Hex(h)); connect(hs[0],hs[1]);connect(hs[1],hs[2]);
    const outer=around(hs[0]).map((h,i)=>({h,i,p:h.toPoint()})).filter(v=>MAP_CENTRE.distance(v.h)>MAP_RADIUS)
      .sort((a,b)=>Math.hypot(a.p.x-entry.start.x,a.p.y-entry.start.y)-Math.hypot(b.p.x-entry.start.x,b.p.y-entry.start.y))[0];
    mark(hs[0],outer.i);
  }
  for(const h of Object.values(settlements)) connect(Hex(h),around(Hex(h))[h.frontDoorSide]);
  return {version:1,heights,routes};
}
// Plan before changing ECS ownership, clearance or terrain. Legacy simulation
// fixtures without geography keep their existing flat-band behaviour.
export function shelterSurface(state, point) {
  if(!state.map?.geography) return null;
  const natural=groundForState(state), hex=Hex().fromPoint(point);
  if(!suitableHouse(natural,point) || !safeTile(natural,point)) return null;
  const landscape={}, roadHexes=[], roadSides=new Map(), settlements={};
  for(const id of Object.keys(state.ecs.mappable)) {
    const h=Hex().fromPoint(state.ecs.spatial[id]), t=state.ecs.mappable[id];
    landscape[h]={...state.ecs.spatial[id],...t};
    if(t.route?.length) {roadHexes.push(h);roadSides.set(String(h),t.route);}
  }
  // A new pad cannot change canonical shared corners.
  if(around(hex).some(h=>!landscape[h])) return null;
  for(const id of [...Object.keys(state.ecs.building || {}),...Object.keys(state.ecs.shelter || {})]) {
    const h=Hex().fromPoint(state.ecs.spatial[id]);settlements[h]=h;
  }
  settlements[hex]=hex;roadHexes.push(hex);
  const result=gradeRoads(roadHexes,roadSides,state.map.geography.heights,natural,settlements,{elevationAt:true},landscape);
  if(result.blocked) return null;
  const ground=createHeightField({seed:state.map.seed,terrainAt:k=>landscape[k]?.terrain,
    cornerAt:(x,y)=>result.heights[pointKey({x,y})]});
  // Do not invalidate the existing real walking graph around a new pad.
  for(const id of Object.keys(state.ecs.mappable)) if(state.ecs.walkable[id]?.speed>0 && !safeTile(ground,state.ecs.spatial[id])) return null;
  return {...state.map.geography,heights:result.heights};
}
export function groundForState(state) {
  let geography, field;
  const current=()=>{
    if(!field || geography!==state.map.geography) {
      geography=state.map.geography;
      field=createHeightField({seed:state.map.seed,
        terrainAt:key=>{const id=(state.space[key]||[]).find(e=>state.ecs.mappable[e]);return id && state.ecs.mappable[id].terrain;},
        cornerAt:geography ? (x,y)=>geography.heights[pointKey({x,y})] : undefined});
    }
    return field;
  };
  return Object.fromEntries(["cornerHeight","hex","heightAt","slopeAt"].map(method=>[method,(...args)=>current()[method](...args)]));
}
export function safeTile(ground, p, limit=MAX_WALK_SLOPE) {
  const corners=Hex().corners();
  return corners.every((o,k)=>{const next=corners[(k+1)%6];const {dx,dy}=ground.slopeAt(p.x+(o.x+next.x)*.25,p.y+(o.y+next.y)*.25);return Math.hypot(dx,dy)<=limit+1e-8;});
}
