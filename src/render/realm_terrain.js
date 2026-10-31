import * as THREE from "three";
import { Hex, Grid } from "game/hex";
import { MAP_CENTRE, MAP_RADIUS, createLandField, worldPoint } from "game/world_terrain";
import { createHeightField } from "game/height";
import { snowlineAt } from "game/climate";
import { reachKey } from "game/realm_map";
import { BIOME_COLOURS } from "render/biomes";

const pointKey = p => Math.round(p.x * 1000) + "," + Math.round(p.y * 1000);
const tiles = [...Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS })];
const localCentre = MAP_CENTRE.toPoint();
const corners = Hex().corners();
// The actual stepped perimeter, in connected order. These very same edges
// belong to the adjacent reach; no idealised hex widths or overlapping skirts.
const boundary = (() => {
  const inside = new Set(tiles.map(String)), links = new Map(), points = new Map();
  const link = (a, b) => { const k = pointKey(a); points.set(k, a); if (!links.has(k)) links.set(k, []); links.get(k).push(pointKey(b)); };
  for (const h of tiles) {
    const p = h.toPoint();
    for (let k = 0; k < 6; k++) {
      const a = corners[k], b = corners[(k + 1) % 6];
      if (inside.has(String(Hex().fromPoint({x:p.x+a.x+b.x,y:p.y+a.y+b.y})))) continue;
      const from = {x:p.x+a.x,y:p.y+a.y}, to = {x:p.x+b.x,y:p.y+b.y};
      link(from,to); link(to,from);
    }
  }
  const result = [], start = links.keys().next().value;
  let previous = null, at = start;
  do { result.push(points.get(at)); const next = links.get(at).find(k => k != previous); previous = at; at = next; } while (at != start);
  return result;
})();

export function realmLayout(world) {
  const origin = worldPoint(world.home, localCentre);
  const local = (h, p) => { const q = worldPoint(h, p); return { x:q.x-origin.x+localCentre.x, y:q.y-origin.y+localCentre.y }; };
  const reaches = world.hexes.map(h => ({ h, key:reachKey(h), centre:local(h,localCentre), border:boundary.map(p=>local(h,p)) }));
  const points = reaches.flatMap(r=>r.border);
  const min = { x:Math.min(...points.map(p=>p.x)), y:Math.min(...points.map(p=>p.y)) };
  const max = { x:Math.max(...points.map(p=>p.x)), y:Math.max(...points.map(p=>p.y)) };
  return { reaches, min, max, centre:{x:(min.x+max.x)/2,y:(min.y+max.y)/2}, local,
    radius:Math.hypot(max.x-min.x,max.y-min.y)/2 };
}
export const overviewLevel = distance => ({ people:distance < 2800, props:distance < 6500,
  communities:distance >= 2200 && distance < 15000, reaches:distance >= 6500, overview:distance >= 2200 });

// A triangular lattice plus a short perimeter band, and exact tile fans only
// on the active map. Cached reach meshes are frustum-culled; this reads
// no ECS outside the active map and creates no histories or communities.
export function createRealmTerrain(state, ground) {
  const started = performance.now();
  const layout = realmLayout(state.world);
  const field = createLandField(state.world.landSeed ?? state.map.seed, state.world.geographyFixture);
  const origin = worldPoint(state.world.home, localCentre);
  const global = p => ({x:p.x-localCentre.x+origin.x,y:p.y-localCentre.y+origin.y});
  // Corner sampling asks for the same adjacent canonical tiles repeatedly.
  // Retain that classification rather than re-running its noise/grade survey.
  const terrainTiles = new Map();
  const terrainAt = key => {
    if (!terrainTiles.has(key)) terrainTiles.set(key,field.terrainAt(Hex(...key.split(",").map(Number)).toPoint()));
    return terrainTiles.get(key);
  };
  const natural = createHeightField({seed:state.map.seed,terrainAt,elevationAt:(x,y)=>field.elevationAt({x,y})});
  const shared = new Map(boundary.map(p=>[pointKey(p),ground.heightAt(p.x,p.y)]));
  const geometryHeights = new Map(shared);
  const heightAt = (x,y) => {
    const key = pointKey({x,y});
    if (geometryHeights.has(key)) return geometryHeights.get(key);
    const p = {x,y};
    if (Hex(MAP_CENTRE).distance(Hex().fromPoint(p)) <= MAP_RADIUS) return ground.heightAt(x,y);
    if (shared.has(pointKey(p))) return shared.get(pointKey(p));
    const q = global(p); return natural.heightAt(q.x,q.y);
  };
  // Only mesh vertices enter this cache. Camera movement never grows it.
  const sampleHeight = p => {
    const key=pointKey(p);
    if(!geometryHeights.has(key))geometryHeights.set(key,heightAt(p.x,p.y));
    return geometryHeights.get(key);
  };
  let positions = [], colours = [], samples = [], indices = [], vertices = new Map();
  const boundaries = new Map(), chunks = [];
  const material = new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});
  let mesh;
  const colour = new THREE.Color(), snow = new THREE.Color(0xE8EEF3);
  const shadeFor = (h,p,height) => {
    const terrain = terrainAt(String(Hex().fromPoint(global(p))));
    if (terrain.includes("water")) return colour.setHex(terrain == "deep water" ? 0x2F4999 : 0x3F6FAE);
    const rocky = terrain == "mountain" || height > 780;
    colour.setHex(rocky ? 0x85898D : (BIOME_COLOURS[h.biome == "snowfield" ? "tundra" : h.biome] || 0x86C35F));
    return colour.lerp(snow, Math.max(0,Math.min(1,(height-snowlineAt(h,state.days))/140)));
  };
  const triangle = (a,b,c,h) => {
    // Force upward winding for every band, independently of perimeter order.
    if ((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x) > 0) [b,c]=[c,b];
    for (const p of [a,b,c]) {
      const key=pointKey(p);
      let index=vertices.get(key);
      if(index==null) {
        index=samples.length;vertices.set(key,index);
        const elevation=sampleHeight(p),rgb=shadeFor(h,p,elevation);
        samples.push({h,p,elevation});
        positions.push(p.x,elevation-.12,p.y);colours.push(rgb.r,rgb.g,rgb.b);
      }
      indices.push(index);
    }
  };
  for (const r of layout.reaches) {
    positions=[]; colours=[]; samples=[]; indices=[]; vertices=new Map();
    boundaries.set(r.key,r.border.map(p=>({x:p.x,y:sampleHeight(p),z:p.y})));
    if (r.key == reachKey(state.world.home)) {
      for (const tile of tiles) {
        const p = tile.toPoint();
        for (let k=0;k<6;k++) triangle(p,{x:p.x+corners[k].x,y:p.y+corners[k].y},{x:p.x+corners[(k+1)%6].x,y:p.y+corners[(k+1)%6].y},r.h);
      }
    } else {
      // An equilateral triangular lattice carries the relief. Only the short
      // outer band joins it to the exact stepped border; no long radial fans.
      const interior=new Map(), n=7, step=3;
      // Use separate axial variable names: r is the reach record here.
      const pointAt=(q,t)=>({x:r.centre.x+q*step*90,y:r.centre.y+(t+q/2)*step*Hex().height()});
      for(let q=-n;q<=n;q++)for(let t=-n;t<=n;t++)if(Math.max(Math.abs(q),Math.abs(t),Math.abs(q+t))<=n)interior.set(q+","+t,pointAt(q,t));
      for(let q=-n;q<=n;q++)for(let t=-n;t<=n;t++) {
        const a=interior.get(q+","+t),b=interior.get((q+1)+","+t),c=interior.get(q+","+(t+1)),d=interior.get((q+1)+","+(t+1));
        if(a&&b&&c)triangle(a,b,c,r.h);
        if(b&&c&&d)triangle(b,d,c,r.h);
      }
      const angle=p=>(Math.atan2(p.y-r.centre.y,p.x-r.centre.x)+Math.PI*2)%(Math.PI*2);
      const inner=[...interior].filter(([key])=>{const [q,t]=key.split(",").map(Number);return Math.max(Math.abs(q),Math.abs(t),Math.abs(q+t))==n;}).map(([,p])=>p).sort((a,b)=>angle(a)-angle(b));
      const outer=[...r.border].sort((a,b)=>angle(a)-angle(b));
      let i=0,j=0;
      while(i<inner.length || j<outer.length) {
        const nextInner=i<inner.length ? angle(inner[(i+1)%inner.length])+(i+1==inner.length?Math.PI*2:0) : Infinity;
        const nextOuter=j<outer.length ? angle(outer[(j+1)%outer.length])+(j+1==outer.length?Math.PI*2:0) : Infinity;
        if(nextInner<nextOuter) {triangle(inner[i%inner.length],inner[(i+1)%inner.length],outer[j%outer.length],r.h);i++;}
        else {triangle(inner[i%inner.length],outer[j%outer.length],outer[(j+1)%outer.length],r.h);j++;}
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colours,3));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const chunk = new THREE.Mesh(geometry,material);
    chunk.userData.reachKey=r.key;
    chunks.push({chunk,samples});
    if(r.key==reachKey(state.world.home))mesh=chunk;
  }
  for(const {chunk} of chunks)if(chunk!=mesh)mesh.add(chunk);
  mesh.name="realm-terrain";
  const triangles=chunks.reduce((n,{chunk})=>n+chunk.geometry.index.count/3,0);
  const constructionMs=performance.now()-started;
  performance.measure?.("tinyking-realm-terrain",{start:started,end:performance.now(),detail:{triangles,chunks:chunks.length,constructionMs}});
  return {mesh,layout,boundaries,heightAt,triangles,constructionMs,
    fitDistance(aspect,fov,yaw,pitch,heightFraction=.8) {
      const target=heightAt(layout.centre.x,layout.centre.y), tan=Math.tan(fov*Math.PI/360);
      let distance=1000;
      for(const {chunk} of chunks) {
        const box=chunk.geometry.boundingBox;
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]) {
          const dx=x-layout.centre.x,dy=y-target,dz=z-layout.centre.y;
          const right=Math.cos(yaw)*dx-Math.sin(yaw)*dz;
          const up=-Math.sin(yaw)*Math.sin(pitch)*dx+Math.cos(pitch)*dy-Math.cos(yaw)*Math.sin(pitch)*dz;
          const along=Math.sin(yaw)*Math.cos(pitch)*dx+Math.sin(pitch)*dy+Math.cos(yaw)*Math.cos(pitch)*dz;
          distance=Math.max(distance,along+Math.abs(right)/(tan*aspect*.92),along+Math.abs(up)/(tan*heightFraction));
        }
      }
      return distance;
    },
    refreshGround() {
      geometryHeights.clear();
      for (const p of boundary) {
        const key=pointKey(p),height=ground.heightAt(p.x,p.y);
        shared.set(key,height);geometryHeights.set(key,height);
      }
      for (const {chunk} of chunks) {
        const geometry=chunk.geometry, array=geometry.attributes.position;
        for(let i=0;i<array.count;i++) {
          const x=array.getX(i),y=array.getZ(i);
          if(Hex(MAP_CENTRE).distance(Hex().fromPoint({x,y}))<=MAP_RADIUS || shared.has(pointKey({x,y})))array.setY(i,sampleHeight({x,y})-.12);
        }
        array.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
      }
    },
    refreshSnow() {
      for(const {chunk,samples} of chunks) {
        const geometry=chunk.geometry, array=geometry.attributes.color.array;
        samples.forEach(({h,p,elevation},i)=>{const rgb=shadeFor(h,p,elevation);array.set([rgb.r,rgb.g,rgb.b],i*3);});
        geometry.attributes.color.needsUpdate=true;
      }
    },
    dispose() {for(const {chunk} of chunks)chunk.geometry.dispose();material.dispose();}
  };
}
