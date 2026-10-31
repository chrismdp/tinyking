import { browserClickPoint } from '../scripts/click-selection';

it('finds the drawn canopy when the trunk centre line is occluded', () => {
  const canvas={clientWidth:1280,clientHeight:800};
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const vector=()=>({x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});return this;}});
  const tree={userData:{anchorHeight:1},position:{clone:vector},geometry:{boundingBox:{min:{x:.2,y:.2,z:0},max:{x:.8,y:.8,z:.2}}},updateMatrixWorld(){},localToWorld:v=>v};
  const pick=(x,y)=>x>700&&y<350?'tree':'foreground';
  global.window={tinyking:{ecs:{spatial:{tree:{x:0,y:0}},mappable:{},tree:{tree:{stage:'mature'}}},renderer:{camera:{matrixWorldInverse:{elements:identity},projectionMatrix:{elements:identity}},ground:{heightAt:()=>0},objectOf:()=>tree,pick}}};
  global.document={querySelector:()=>canvas,elementFromPoint:()=>canvas};
  try {
    const point=browserClickPoint('tree');
    expect(point).not.toBeNull();
    expect(pick(point.x,point.y)).toBe('tree');
  } finally {delete global.window;delete global.document;}
});
