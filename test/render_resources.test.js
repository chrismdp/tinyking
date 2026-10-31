jest.mock('three', () => process.getBuiltinModule('module')._load(process.cwd() + '/node_modules/three/build/three.module.js'));
import { label } from 'render/labels';
import { disposeObject, person } from 'render/models';

beforeEach(()=>{
  global.document={createElement:()=>({getContext:()=>({measureText:t=>({width:t.length*20}),beginPath(){},moveTo(){},arcTo(){},fill(){},fillText(){}})})};
});
afterEach(()=>{delete global.document;});

it('releases text texture/material after the last label user, and creates fresh resources on reuse', () => {
  const a=label('Working with Agnes'),b=label('Working with Agnes');
  expect(a.material).toBe(b.material);
  const material=jest.spyOn(a.material,'dispose'),texture=jest.spyOn(a.material.map,'dispose');
  disposeObject(a);expect(material).not.toHaveBeenCalled();
  disposeObject(b);expect(material).toHaveBeenCalledTimes(1);expect(texture).toHaveBeenCalledTimes(1);
  disposeObject(b);expect(material).toHaveBeenCalledTimes(1);
  const c=label('Working with Agnes');expect(c.material).not.toBe(a.material);disposeObject(c);
});

it('releases uncached realm text too, without sharing different label heights', () => {
  const a=label('Reach',{cached:false}),b=label('Reach',{height:24});
  expect(a.material).not.toBe(b.material);
  const texture=jest.spyOn(a.material.map,'dispose');disposeObject(a);expect(texture).toHaveBeenCalledTimes(1);disposeObject(b);
});

it('disposes each owned player ring material when that player model is replaced', () => {
  const s={ui:{playerId:'p'},ecs:{personable:{p:{}},nameable:{p:{nickname:'Player'}}}};
  const e={id:'p',personable:{size:20,body:0x777777,hair:0}};
  const a=person(s,e,()=>'',{realm:0xffffff}),b=person(s,e,()=>'',{realm:0xffffff});
  const old=a.getObjectByName('controlled-ring').material,next=b.getObjectByName('controlled-ring').material;
  const dispose=jest.spyOn(old,'dispose');expect(old).not.toBe(next);
  disposeObject(a);expect(dispose).toHaveBeenCalledTimes(1);disposeObject(b);
});
