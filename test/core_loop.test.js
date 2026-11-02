import { rowOfTiles } from './support/world';
import { newEntities } from 'game/entities';
import { give } from 'game/holder';
import { Task, solve } from 'game/htn';
import { eat, sleep, chop_tree } from 'game/tasks';
import { updateNeeds } from 'game/needs';
import { careSpeed } from 'game/hunger';
import { ensureEnergy, playerDay, foodChoices, eatOwnedFood } from 'game/energy';
import { DAYS_IN_SEASON, HOUR, full } from 'game/time';
import { enqueueTask, readyPlayerTasks } from 'game/manager';

export function playerFixture() {
  const f=rowOfTiles(4), s=f.state, a=f.villager;
  s.ui.playerId=a;s.game_speed='normal';s.days=.4;
  s.ecs.personable={[a]:{age:24,hunger:.5,tiredness:.2}};
  s.ecs.planner={[a]:{id:a,world:{actorId:a,ordered:true,stationaryPlayer:true,places:{},no_place_for:{},feeling:{},holding:{},days:s.days}}};
  s.ecs.manager={[a]:{ordered:true,jobs:[]}};
  s.ecs.personality={[a]:{traits:[],likes:[],dislikes:[]}};s.opinionThresholds={hate:-1,love:1};s.peopleSeed=13;
  ensureEnergy(s);
  return f;
}
it('converts legacy hunger once to an energy budget without survival flags or orders',()=>{
  const {state:s,villager:a}=playerFixture();
  expect(s.ecs.personable[a].energy).toBe(80);
  expect(s.ecs.personable[a].hunger).toBeUndefined();
  s.ecs.personable[a].energy=34;ensureEnergy(s);expect(s.ecs.personable[a].energy).toBe(34);
  expect(enqueueTask(s,{key:'find_food'},a)).toBeNull();
});
it('spends energy on actual physical effort and slows low energy work',()=>{
  const {state:s,villager:a}=playerFixture();
  const [tree]=newEntities(s,[{spatial:{...s.ecs.spatial[a]},good:{type:'wood',amount:2}}]);
  const p=s.ecs.personable[a];p.energy=100;
  chop_tree(s,a,{},HOUR/4,true,tree);expect(p.energy).toBeLessThan(100);
  expect(careSpeed({energy:10})).toBe(.5);expect(careSpeed({energy:0})).toBe(.25);
  p.energy=0;enqueueTask(s,{key:'cut_tree_down'},tree);
  expect(readyPlayerTasks(s)).toEqual([]);expect(s.ecs.manager[a].jobs[0].waiting).toMatch(/energy/i);
});
it('has no player care hunt and leaves conversation free at zero energy',()=>{
  const {state:s,villager:a}=playerFixture(),w=s.ecs.planner[a].world;
  w.feeling={hungry:true,tired:true};
  const [plan]=solve(w,[],[['player']]);
  expect(plan.some(t=>['find_food','recover_meal','eat','sleep'].includes(t[0]))).toBe(false);
  s.ecs.personable[a].energy=0;
  expect(enqueueTask(s,{key:'chat'},a)).toBeTruthy();
});
it('eats only real accessible owned food, preserving the rest of a stack',()=>{
  const {state:s,villager:a}=playerFixture();
  const [meal]=newEntities(s,[{spatial:{...s.ecs.spatial[a]},good:{type:'grain',amount:3},haulable:{},controllable:{controllerId:a}}]);give(s.ecs,meal,a);
  s.ecs.personable[a].energy=20;
  expect(foodChoices(s)).toEqual(expect.arrayContaining([expect.objectContaining({sourceId:meal,type:'grain'})]));
  expect(eatOwnedFood(s,meal,'grain')).toBe(true);
  expect(s.ecs.personable[a].energy).toBe(55);expect(s.ecs.good[meal].amount).toBe(2);
  expect(eatOwnedFood(s,'missing','grain')).toBe(false);
});
it('keeps work available at dusk and returns to the owned fire only when exhausted',()=>{
  const {state:s,villager:a,tiles}=playerFixture();
  const [camp]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},camp:{ownerId:a},controllable:{controllerId:a}}]);
  s.ecs.household={[a]:{houseId:camp}};
  enqueueTask(s,{key:'create_stockpile'},tiles[2]);s.days=18/24;
  playerDay(s);expect(readyPlayerTasks(s)).toHaveLength(1);
  expect(s.ecs.planner[a].world.fireHome).toBeUndefined();
  s.ecs.personable[a].energy=0;playerDay(s);expect(readyPlayerTasks(s)).toEqual([]);
  expect(s.ecs.planner[a].world.fireHome).toBe(camp);
  expect(s.ecs.manager[a].jobs[0].waiting).toMatch(/energy/i);
});
it('sleep restores more in a bed; a late night lowers the next morning',()=>{
  const run=(bed,hour)=>{const {state:s,villager:a}=playerFixture();s.days=hour/24;s.ecs.personable[a].energy=0;
    s.ecs.sleepable=bed?{bed:{capacity:2,occupiers:[]}}:{};
    const w={places:bed?{sleep:'bed'}:{}};sleep(s,a,w,HOUR,true);return s.ecs.personable[a].energy;};
  expect(run(true,22)).toBeGreaterThan(run(false,22));
  const {state:s,villager:a}=playerFixture();s.days=1+2/24;s.ecs.personable[a].energy=0;s.ecs.sleepable={bed:{capacity:2,occupiers:[]}};
  sleep(s,a,{places:{sleep:'bed'}},8*HOUR,true);expect(s.ecs.personable[a].energy).toBeLessThan(100);
});
it('NPC neglect cannot cause a starvation death, while meals still consume real food',()=>{
  const {state:s,villager:a}=playerFixture();const [npc]=newEntities(s,[{personable:{hunger:99,tiredness:0},controllable:{}}]);
  updateNeeds(s,2);expect(s.ecs.personable[npc].dead).toBeFalsy();expect(s.ecs.personable[npc].hunger).toBeGreaterThan(99);
  expect(s.ecs.personable[a].hunger).toBeUndefined();
});
it('uses seven numbered days with no undefined clock labels',()=>{
  expect(DAYS_IN_SEASON).toBe(7);expect(full(6.5)).toContain('day 7');expect(full(7.5)).toContain('summer');
});
it('a thank-you meal comes from a surplus larder exactly once',()=>{
 const {state:s,villager:a}=playerFixture();
 const [house,npc]=newEntities(s,[{spatial:{...s.ecs.spatial[a]},container:{capacity:30,amounts:{bread:12}}},{spatial:{...s.ecs.spatial[a]},personable:{age:30},controllable:{},household:{houseId:'unused'},personality:{traits:[],likes:[],dislikes:[]},relationships:{known:{}}}]);
 s.ecs.controllable[npc].controllerId=npc;
 s.ecs.household={[npc]:{houseId:house},[house]:{storeId:house}};
 const r={kind:'wood',status:'accepted',actorId:a,giverId:npc,householdId:house,progress:1,quantity:1,produced:1,delivered:1,cargo:[],goodwill:12};
 const {finishFavour}=require('game/favours');expect(finishFavour(s,r)).toBe(true);
 expect(r.thanksFood).toMatchObject({type:'bread',amount:1});expect(s.ecs.container[house].amounts.bread).toBe(11);
 expect(foodChoices(s).some(x=>x.type=='bread')).toBe(true);expect(finishFavour(s,r)).toBe(false);expect(s.ecs.container[house].amounts.bread).toBe(11);
});
it.each(['recover_meal','walk_to'])('loads legacy %s care without inventing food or continuing the search',task=>{
 const {state:s,villager:a}=playerFixture();delete s.ecs.personable[a].energy;s.ecs.personable[a].hunger=3;
 s.ecs.manager[a].jobs=[{job:{key:'find_food'},targetId:a}];s.ecs.planner[a].task=[task];s.ecs.planner[a].plan=[['eat','meal']];
 const {serialiseGame,restoreGame}=require('game/save_game'),loaded=restoreGame(serialiseGame(s));ensureEnergy(loaded);
 expect(loaded.ecs.personable[a].energy).toBe(0);expect(loaded.ecs.personable[a].hunger).toBeUndefined();
 expect(loaded.ecs.manager[a].jobs).toEqual([]);expect(loaded.ecs.planner[a].task).toBeNull();expect(Object.keys(loaded.ecs.good || {})).toHaveLength(0);
});
it('retires a consumed owned meal through explicit six-minute simulation steps',()=>{
 const {state:s,villager:a}=playerFixture();s.ecs.personable[a].energy=20;
 const [meal]=newEntities(s,[{spatial:{...s.ecs.spatial[a]},good:{type:'forage',amount:1},haulable:{},controllable:{controllerId:a}}]);
 const job=enqueueTask(s,{key:'eat_food'},meal,{foodType:'forage'}),sim=require('game/simulation').createSimulation(s);
 for(let i=0;i<10;i++)sim.step(10*(6), 0);
 expect(s.ecs.manager[a].jobs).not.toContain(job);expect(s.ecs.good[meal]).toBeUndefined();expect(s.ecs.personable[a].energy).toBe(55);
});
it('retires an already consumed meal when Rest interrupts its remaining time',()=>{
 const {state:s,villager:a}=playerFixture();s.ecs.personable[a].energy=20;
 const [meal]=newEntities(s,[{spatial:{...s.ecs.spatial[a]},good:{type:'grain',amount:2},haulable:{},controllable:{controllerId:a}}]);
 const order=enqueueTask(s,{key:'eat_food'},meal,{foodType:'grain'}),sim=require('game/simulation').createSimulation(s);sim.step(10*(6), 0);
 expect(s.ecs.personable[a].energy).toBe(55);expect(s.ecs.good[meal].amount).toBe(1);
 enqueueTask(s,{key:'rest'},a);sim.step(10*(6), 0);
 expect(s.ecs.manager[a].jobs).not.toContain(order);expect(s.ecs.good[meal].amount).toBe(1);
});
it('lets a collapsed player keep walking home instead of restarting that walk every frame',()=>{
 const {state:s,villager:a,tiles}=playerFixture();
 const [camp]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},camp:{ownerId:a},controllable:{controllerId:a}}]);
 s.ecs.household={[a]:{houseId:camp}};s.ecs.personable[a].tiredness=2;
 playerDay(s);const p=s.ecs.planner[a];expect(p.world.forcedRest).toBe(true);
 p.task=['walk_to',camp];p.plan=[['sleep']];playerDay(s);
 expect(p.task).toEqual(['walk_to',camp]);expect(p.plan).toEqual([['sleep']]);
});
it('reaches home and sleeps after collapse with another ready order queued',()=>{
 const {state:s,villager:a,tiles}=playerFixture();
 const [camp]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[3]]},camp:{ownerId:a},controllable:{controllerId:a}}]);
 s.ecs.household={[a]:{houseId:camp}};s.ecs.personable[a].tiredness=2;s.ecs.personable[a].energy=10;
 const order=enqueueTask(s,{key:'move_to_here'},tiles[1]),sim=require('game/simulation').createSimulation(s);
 for(let i=0;i<45;i++)sim.step(10*(6), 0);
 expect(Math.hypot(s.ecs.spatial[a].x-s.ecs.spatial[camp].x,s.ecs.spatial[a].y-s.ecs.spatial[camp].y)).toBeLessThan(10);expect(s.ecs.personable[a].energy).toBeGreaterThan(10);
 expect(s.ecs.planner[a].task[0]).toBe('sleep');expect(s.ecs.manager[a].jobs).toContain(order);
});
