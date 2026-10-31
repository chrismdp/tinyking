import { gardenHelp, withGardenHelpIndex, refreshGardenHelpIndex } from 'game/household_routines';
import { fenceFootprints, fenceRevision, withFenceCache } from 'game/fences';

it('indexes garden workers once and tracks claims and releases within the same planner frame', () => {
  const ecs={personable:{},planner:{},household:{},backyard:{},farmable:{}};
  const s={ecs,days:10/24}; let reads=0;
  for(let n=0;n<100;n++) {
    const id='p'+n,home='h'+n,garden='g'+n;
    ecs.personable[id]={age:20}; ecs.household[id]={houseId:home};
    ecs.household[home]={backyards:[garden]};ecs.backyard[garden]={kind:'vegetable'};
    ecs.farmable[garden]={slots:[{state:'sown'}]};
    ecs.planner[id]={id,world:{get gardenHelp(){reads++;return this.garden;},set gardenHelp(v){this.garden=v;}}};
  }
  const scan=()=>{for(const id of Object.keys(ecs.planner))expect(gardenHelp(s,id)).toBe('g'+id.slice(1));};
  // The reviewer's scaling fixture: separate untended gardens for every adult.
  if(withGardenHelpIndex) withGardenHelpIndex(s,scan); else scan();
  expect(reads).toBeLessThanOrEqual(200);
  withGardenHelpIndex(s,()=>{
    ecs.planner.p1.world.gardenHelp='g0';refreshGardenHelpIndex(s,'p1');
    expect(gardenHelp(s,'p0')).toBeNull();
    delete ecs.planner.p1.world.garden;refreshGardenHelpIndex(s,'p1');
    expect(gardenHelp(s,'p0')).toBe('g0');
  });
});

it('shares fence footprints/revision within a frame and refreshes geometry on the next frame', () => {
  let reads=0; const shape={get halfWidth(){reads++;return this.width;},width:20,halfDepth:15};
  const s={ecs:{spatial:{pen:{x:10,y:20}},pasture:{pen:shape}}};
  const frame=fn=>withFenceCache ? withFenceCache(s,fn) : fn();
  let old;
  frame(()=>{
    old=fenceFootprints(s);const version=fenceRevision(old);
    for(let i=0;i<100;i++) {expect(fenceFootprints(s)).toBe(old);expect(fenceRevision(fenceFootprints(s))).toBe(version);}
  });
  expect(reads).toBe(1);
  shape.width=40;s.ecs.spatial.pen.x=25;
  frame(()=>{const next=fenceFootprints(s);expect(next[0]).toMatchObject({x:25,halfWidth:40});expect(fenceRevision(next)).not.toBe(fenceRevision(old));});
  delete s.ecs.pasture.pen;
  frame(()=>expect(fenceFootprints(s)).toEqual([]));
  s.ecs={spatial:{newPen:{x:0,y:0}},fence:{newPen:{halfWidth:10,halfDepth:10}}};
  frame(()=>expect(fenceFootprints(s).map(f=>f.id)).toEqual(['newPen']));
});
