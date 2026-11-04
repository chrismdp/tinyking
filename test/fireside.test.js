import { openingGuidance } from 'game/guidance';
import { economy } from './support/economy';
import { enqueueTask, readyPlayerTasks } from 'game/manager';
import { playerDay } from 'game/energy';
import { createSimulation } from 'game/simulation';
import { currentActivity } from 'game/person_activity';
import { updateJourney } from 'game/travel';

it('keeps physical work available after dark while energy remains',()=>{
  const {s,p,tiles,world}=economy();s.days=19/24;
  enqueueTask(s,{key:'create_stockpile'},tiles[2]);playerDay(s);
  expect(readyPlayerTasks(s)).toHaveLength(1);expect(world.duskHome).toBeUndefined();
  const sim=createSimulation(s);for(let i=0;i<100&&!s.ecs.stockpile?.[Object.keys(s.ecs.stockpile || {})[0]];i++)sim.step(60,0);
  expect(Object.keys(s.ecs.stockpile || {})).toHaveLength(1);expect(s.ecs.personable[p].energy).toBeLessThan(100);
});
it('walks to the owned fire at zero, preserving unfinished work, then stays visibly seated',()=>{
  const {s,p,camp,tiles,world}=economy();s.days=19/24;
  Object.assign(s.ecs.spatial[p],s.ecs.spatial[tiles[4]]);
  s.ecs.personable[p].energy=0;
  const order=enqueueTask(s,{key:'create_stockpile'},tiles[7]);
  const sim=createSimulation(s),start=s.ecs.spatial[p].x;sim.step(60,0);
  expect(s.ecs.planner[p].task).toEqual(['walk_to',camp]);
  expect(s.ecs.spatial[p].x).toBeLessThan(start);expect(s.ecs.spatial[p].x).toBeGreaterThan(s.ecs.spatial[camp].x);
  for(let i=0;i<1000&&s.ecs.planner[p].task?.[0]!='settle_fire';i++)sim.step(60,0);
  expect(s.ecs.planner[p].task?.[0]).toBe('settle_fire');expect(world.byFire).toBe(camp);
  expect(currentActivity(s.ecs,p,k=>k)).toBe('Sitting by the fire');
  expect(s.ecs.manager[p].jobs).toContain(order);expect(order.progress).toBe(0);
  const at={...s.ecs.spatial[p]};for(let i=0;i<10;i++)sim.step(60,0);
  expect(s.ecs.spatial[p]).toEqual(at);expect(s.nightSleep).toBeFalsy();
});
it('defers automatic bedtime while attention is held, then sleeps and skips to dawn',()=>{
  const {s,p,world}=economy();s.days=23/24;s.ecs.personable[p].energy=10;
  world.capturedBy='visitor';const sim=createSimulation(s);for(let i=0;i<10;i++)sim.step(1,0);
  expect(s.nightSleep).toBeFalsy();expect(world.forcedRest).toBeFalsy();
  world.capturedBy=null;
  for(let i=0;i<1000&&!s.ui.dayMessage?.startsWith('Morning');i++)sim.step(1);
  expect(s.days).toBeCloseTo(1.25,3);
  expect(s.ecs.personable[p].energy).toBeGreaterThan(10);expect(world.byFire).toBeUndefined();
});
it('does not interrupt an active conversation on exhaustion or at bedtime',()=>{
  const {s,p,world}=economy();s.days=23/24;s.ecs.personable[p].energy=0;
  s.chat={active:{}};playerDay(s);expect(world.fireHome).toBeUndefined();expect(world.forcedRest).toBeFalsy();
  delete s.chat;world.currentJob='chat';playerDay(s);expect(world.forcedRest).toBeFalsy();
});
it('lets food and an explicit new order interrupt sitting and resume saved work',()=>{
  const {s,p,camp,tiles}=economy();s.days=19/24;s.ecs.personable[p].energy=0;
  const sim=createSimulation(s);for(let i=0;i<5;i++)sim.step(60,0);
  expect(s.ecs.planner[p].task?.[0]).toBe('settle_fire');
  enqueueTask(s,{key:'eat_food'},camp,{foodType:'grain'});for(let i=0;i<30&&s.ecs.manager[p].jobs.length;i++)sim.step(60,0);
  expect(s.ecs.personable[p].energy).toBeGreaterThan(0);
  enqueueTask(s,{key:'create_stockpile'},tiles[2]);for(let i=0;i<100&&!Object.keys(s.ecs.stockpile || {}).length;i++)sim.step(60,0);
  expect(Object.keys(s.ecs.stockpile || {})).toHaveLength(1);
});
it('keeps a journey walking after dusk and uses its camp fire only on exhaustion',()=>{
  const {s,p,tiles}=economy();s.days=19/24;
  const order=enqueueTask(s,{key:'travel'},tiles[12]);order.assignedId=p;
  s.travel={season:0,transit:[],journey:{actorId:p,orderId:order.id,route:['1,1']}};
  updateJourney(s);expect(s.travel.journey.campId).toBeUndefined();
  s.ecs.personable[p].energy=0;updateJourney(s);
  const camp=s.travel.journey.campId;expect(camp).toBeDefined();expect(s.ecs.camp[camp].journey).toBe(true);
  const sim=createSimulation(s);sim.tick();
  expect(s.ecs.planner[p].task?.[0]).toBe('settle_fire');expect(s.nightSleep).toBeFalsy();
});

it('keeps a daytime journey rest on its camp bedroll until the sleep is complete',()=>{
  const {s,p,tiles}=economy();s.days=12/24;s.ecs.personable[p].energy=0;
  const order=enqueueTask(s,{key:'travel'},tiles[12]);order.assignedId=p;
  s.travel={season:0,transit:[],journey:{actorId:p,orderId:order.id,route:['1,1']}};
  updateJourney(s);const camp=s.travel.journey.campId;
  const planner=s.ecs.planner[p];planner.task=['sleep'];planner.world.sleepHours=1;planner.world.forcedRest=true;
  s.ecs.personable[p].energy=8;updateJourney(s);
  expect(s.travel.journey.campId).toBe(camp);expect(planner.task[0]).toBe('sleep');
  planner.world.sleepHours=6;updateJourney(s);expect(s.travel.journey.campId).toBeUndefined();
});
it('uses the camp bedroll when Rest replaces a journey order',()=>{
  const {s,p,tiles}=economy();s.days=19/24;s.ecs.personable[p].energy=0;
  const order=enqueueTask(s,{key:'travel'},tiles[12]);order.assignedId=p;
  s.travel={season:0,transit:[],journey:{actorId:p,orderId:order.id,route:['1,1']}};
  updateJourney(s);const camp=s.travel.journey.campId;
  enqueueTask(s,{key:'rest'},p);const sim=createSimulation(s);for(let i=0;i<10;i++)sim.step(1,0);
  expect(s.ecs.planner[p].world.restHome).toBe(camp);expect(s.ecs.planner[p].world.places.sleep).toBe(camp);
  expect(s.ecs.planner[p].task[0]).toBe('sleep');
  for(let i=0;i<1000&&!s.ui.dayMessage?.startsWith('Morning');i++)sim.step(1);
  expect(s.ecs.planner[p].world.restCamp).toBeUndefined();
});

it('explains that work remains available after dark',()=>{
  const {s,p}=economy();s.intro={active:false};s.days=19/24;s.ecs.personable[p].energy=80;
  expect(openingGuidance(s).key).toBe("evening");
});
