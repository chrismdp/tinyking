import * as THREE from "three";
import { Hex } from "game/hex";
import { reachKey, knownCommunities, mapLayers } from "game/realm_map";
import { label } from "render/labels";

export function windSegments(point, wind, height) {
  const length = 240 + 700 * wind.strength;
  const x = wind.x * length, y = wind.y * length;
  const a = [point.x-x/2,height,point.y-y/2], b = [point.x+x/2,height,point.y+y/2];
  return [...a,...b, ...b,b[0]-x*.3-y*.18,height,b[2]-y*.3+x*.18,
    ...b,b[0]-x*.3+y*.18,height,b[2]-y*.3-x*.18];
}
export function createRealmOverlay(state, terrain) {
  const mesh = new THREE.Group();mesh.name="realm-overlay";
  const labels = new Map(), communities = new THREE.Group();mesh.add(communities);
  const lineMaterial = new THREE.LineBasicMaterial({color:0xF0DB9A,transparent:true,opacity:.12});
  const edges = [];
  for (const r of terrain.layout.reaches) {
    const border = terrain.boundaries.get(r.key);
    if (r.h.ocean) continue;
    for (let i=0;i<border.length;i++) {
      const a=border[i],b=border[(i+1)%border.length];
      edges.push(a.x,a.y+4,a.z,b.x,b.y+4,b.z);
    }
  }
  const boundaryGeometry = new THREE.BufferGeometry();boundaryGeometry.setAttribute("position",new THREE.Float32BufferAttribute(edges,3));
  const borders = new THREE.LineSegments(boundaryGeometry,lineMaterial);mesh.add(borders);
  const highlightGeometry = new THREE.BufferGeometry();
  highlightGeometry.setAttribute("position",new THREE.Float32BufferAttribute(new Float32Array(Math.max(...[...terrain.boundaries.values()].map(b=>b.length))*3),3));
  const highlight = new THREE.LineLoop(highlightGeometry,new THREE.LineBasicMaterial({color:0xFFE29A,depthTest:false}));highlight.renderOrder=3;mesh.add(highlight);
  const windGeometry = new THREE.BufferGeometry();
  windGeometry.setAttribute("position",new THREE.Float32BufferAttribute(new Float32Array(terrain.layout.reaches.length*18),3));
  const winds = new THREE.LineSegments(windGeometry,new THREE.LineBasicMaterial({color:0xF3F1DA,depthTest:false,transparent:true,opacity:.8}));winds.name="realm-wind";winds.renderOrder=4;mesh.add(winds);
  const release = sprite => {sprite.material.map?.dispose();sprite.material.dispose();};
  const setLabel = (key,text,point,options) => {
    let item=labels.get(key);
    if(item?.text!=text) {
      if(item) {mesh.remove(item.sprite);release(item.sprite);}
      const sprite=label(text,{height:24,cached:false,...options});mesh.add(sprite);
      item={text,sprite,aspect:sprite.scale.x/sprite.scale.y};labels.set(key,item);
    }
    item.sprite.position.set(point.x,terrain.heightAt(point.x,point.y)+130,point.y);
    return item.sprite;
  };
  let revision = null, lastWeather = Symbol("initial"), lastHighlight = null;
  const updateData = () => {
    const key=[state.ui.playerId,state.ecs.playable?.[state.ui.playerId]?.known?.length,Math.floor(state.days*24+1e-7),Object.keys(state.knowledge?.[state.ui.playerId]?.people || {}).length,state.landUseRevision].join(":");
    if(revision!=key) {
      revision=key;
      for(const object of [...communities.children]) {communities.remove(object);object.geometry?.dispose();object.material?.dispose();}
      const retained=new Set();
      for(const r of terrain.layout.reaches) for(const v of knownCommunities(state,r.key)) {
        const id="v:"+v.id, point=terrain.layout.local(r.h,v.point);
        const sprite=setLabel(id,v.name,point,{colour:"#ffe29a",background:"rgba(37,47,39,.94)"});
        sprite.userData.selection={reachKey:r.key,villageId:v.id};sprite.userData.kind="community";retained.add(id);
        // Discovered household plots are actual owned parcels, not a political title.
        const area=[];
        for(const local of v.area) {
          const h=terrain.layout.local(r.h,local);
          const corners=Hex().corners();
          for(let i=0;i<6;i++) {const a=corners[i],b=corners[(i+1)%6];area.push(h.x+a.x,terrain.heightAt(h.x+a.x,h.y+a.y)+3,h.y+a.y,h.x+b.x,terrain.heightAt(h.x+b.x,h.y+b.y)+3,h.y+b.y);}
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(area,3));
        communities.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xDFCA83})));
      }
      for(const [id,item] of labels) if(id.startsWith("v:") && !retained.has(id)) {mesh.remove(item.sprite);release(item.sprite);labels.delete(id);}
    }
    if(lastWeather!=state.weather) {
      lastWeather=state.weather;
      const segments=[];
      for(const r of terrain.layout.reaches) {
        const weather=state.weather?.[r.key];
        if(weather?.wind)segments.push(...windSegments(r.centre,weather.wind,terrain.heightAt(r.centre.x,r.centre.y)+300));
        const text="Reach "+r.h.x+", "+r.h.y;
        const sprite=setLabel(r.key,text+(mapLayers(state).weather && weather ? " · "+weather.type : ""),r.centre,{colour:r.key==reachKey(state.world.home)?"#ffe29a":"#f1eddd",background:r.key==reachKey(state.world.home)?"rgba(37,47,39,.85)":"rgba(37,47,39,.4)"});
        sprite.userData.selection={reachKey:r.key,villageId:null};sprite.userData.kind="reach";sprite.userData.ocean=!!r.h.ocean;
      }
      windGeometry.attributes.position.array.set(segments);windGeometry.attributes.position.needsUpdate=true;
      windGeometry.setDrawRange(0,segments.length/3);windGeometry.computeBoundingSphere();
    }
    const selected=state.ui.realmSelection?.reachKey || reachKey(state.world.home);
    if(lastHighlight!=selected) {
      lastHighlight=selected;
      const points=terrain.boundaries.get(selected)||[];
      highlightGeometry.attributes.position.array.set(points.flatMap(p=>[p.x,p.y+8,p.z]));highlightGeometry.attributes.position.needsUpdate=true;
      highlightGeometry.setDrawRange(0,points.length);highlightGeometry.computeBoundingSphere();
    }
  };
  let weatherLayer;
  return {mesh,winds,
    update(camera,canvas,lod) {
      const layers=mapLayers(state);
      if(weatherLayer!=layers.weather) {weatherLayer=layers.weather;lastWeather=Symbol("layers");}
      updateData();
      mesh.visible=lod.overview;
      borders.visible=lod.reaches;highlight.visible=lod.overview;
      communities.visible=layers.communities && lod.communities;
      winds.visible=layers.wind;
      const occupied=[];
      const sorted=[...labels.values()].sort((a,b)=>Number(b.sprite.userData.selection?.reachKey==reachKey(state.world.home))-Number(a.sprite.userData.selection?.reachKey==reachKey(state.world.home)));
      for(const {sprite,aspect} of sorted) {
        const isCommunity=sprite.userData.kind=="community";
        sprite.visible=lod.overview && (isCommunity ? layers.communities && lod.communities : lod.reaches && (!sprite.userData.ocean || sprite.userData.selection.reachKey==state.ui.realmSelection?.reachKey || sprite.userData.selection.reachKey==reachKey(state.world.home)));
        if(!sprite.visible)continue;
        const depth=-sprite.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
        const p=sprite.position.clone().project(camera);
        const height=22, width=height*aspect;
        const x=(p.x+1)*canvas.clientWidth/2, y=(1-p.y)*canvas.clientHeight/2;
        const spacing=isCommunity ? [width,height] : [Math.max(width,canvas.clientWidth<700?130:180),75];
        const box=[x-spacing[0]/2,y-spacing[1]/2,x+spacing[0]/2,y+spacing[1]/2];
        sprite.visible=depth>0 && p.z<1 && box[0]>=4 && box[2]<=canvas.clientWidth-4 && box[1]>=110 && box[3]<=canvas.clientHeight-90 && !occupied.some(b=>box[0]<b[2]+6 && box[2]>b[0]-6 && box[1]<b[3]+5 && box[3]>b[1]-5);
        if(sprite.visible)occupied.push(box);
        const scale=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/canvas.clientHeight;
        sprite.scale.set(width*scale,height*scale,1);
      }
    },
    pick(raycaster) {
      for(const hit of raycaster.intersectObjects([...labels.values()].filter(i=>i.sprite.visible && mesh.visible).map(i=>i.sprite)))return hit.object.userData.selection;
      const hit=raycaster.intersectObject(terrain.mesh,true)[0];
      if(!hit)return null;
      const point=hit.point;
      // Each coarse reach is star-shaped around its real centre; nearest centre
      // agrees away from the stepped edge. Resolve the edge with the real polygon.
      const contains=(r)=>{let inside=false;for(let i=0,j=r.border.length-1;i<r.border.length;j=i++) {const a=r.border[i],b=r.border[j];if((a.y>point.z)!=(b.y>point.z) && point.x<(b.x-a.x)*(point.z-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
      const reach=terrain.layout.reaches.find(contains);
      return reach?{reachKey:reach.key,villageId:null}:null;
    },
    dispose() {
      for(const {sprite} of labels.values())release(sprite);labels.clear();
      for(const object of communities.children) {object.geometry.dispose();object.material.dispose();}
      boundaryGeometry.dispose();lineMaterial.dispose();highlightGeometry.dispose();highlight.material.dispose();windGeometry.dispose();winds.material.dispose();
    }
  };
}
