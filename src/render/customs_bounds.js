import * as THREE from "three";
import { Hex } from "game/hex";
import { commonLand, resourcePermission } from "game/village_customs";

// Plot holes and navigation barriers shape the visible claim; unseen cells
// never reveal geography. Raised, sampled lines follow the rendered ground.
export function commonBoundary(state, ground, villageId, visible) {
  const claims=commonLand(state),cells=new Set([...claims].filter(([id,v])=>v==villageId &&
    resourcePermission(state,state.ui.playerId,id).kind!="private").map(([id])=>id));
  const vertices=[];
  for(const id of cells) {
    const p=state.ecs.spatial[id];if(!visible(p))continue;
    const corners=Hex().corners().map(c=>c.add(p));
    for(let side=0;side<6;side++) {
      const neighbour=state.ecs.walkable[id].neighbours[side];
      if(cells.has(neighbour))continue;
      const a=corners[side],b=corners[(side+1)%6];
      for(let part=0;part<8;part++)for(const t of [part/8,(part+1)/8]) {
        const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        vertices.push(x,ground.heightAt(x,y)+3,y);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe6bc60,transparent:true,opacity:.9,depthTest:false}));
  lines.name="village-common-boundary";lines.renderOrder=3;
  return lines;
}
