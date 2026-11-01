import {economy} from './support/economy';
import {newEntities} from 'game/entities';
import {enqueueTask} from 'game/manager';
import {give} from 'game/holder';
import {Hex} from 'game/hex';

// The late food order's receipt records these needs and date. No stored food,
// but one public root remains, as proved by the direct Forage & eat recovery.
it('searches all meal sources for the receipt hunger at night before declaring Find food unavailable',()=>{
 const f=economy(),{s,p,camp,tiles}=f;s.days=7.04291666666655;s.ecs.planner[p].world.days=s.days;
 s.ecs.personable[p].hunger=2.125000000000001;s.ecs.personable[p].tiredness=.4770447704007243;s.ecs.container[camp].amounts={};
 const [root]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},forageable:{kind:'roots',biome:'marsh',amount:1,growth:0}}]);
 const job=enqueueTask(s,{key:'find_food'},p);f.step(150);
 expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
 expect(s.ecs.forageable[root].amount).toBe(0);
 expect(s.ecs.manager[p].jobs).not.toContain(job);
});
it('recovers from the timber receipt with full hands, food-source cache misses and reachable roots, then resumes delivery',()=>{
 const f=economy(),{s,p,camp,tiles,world}=f;
 // Translate the real hex spacing to the receipt's camp and timber area.
 for(const at of Object.values(s.ecs.spatial)){at.x+=1980;at.y+=207.84609690826525;}
 s.space={};for(const [id,at] of Object.entries(s.ecs.spatial))(s.space[Hex().fromPoint(at)] ||= []).push(id);
 s.days=6.247499999999968;world.days=s.days;
 s.ecs.personable[p].hunger=1.2916666666666667;s.ecs.personable[p].tiredness=.7603501870673907;s.ecs.container[camp].amounts={};
 const logs=newEntities(s,[1,2].map(()=>({spatial:{x:2461.68645503366,y:211.5116503596945},good:{type:'wood',amount:1},haulable:{},controllable:{controllerId:p}})));
 for(const log of logs)give(s.ecs,log,p);world.holding.wood=true;
 Object.assign(s.ecs.spatial[p],{x:2385,y:233.82685902179838});
 const [root]=newEntities(s,[{spatial:{x:2448.32082006149,y:285.9107819916232},forageable:{kind:'roots',biome:'marsh',amount:1,growth:0}}]);
 const job=enqueueTask(s,{key:'cut_tree_down'},tiles[4],{gatheredDone:true,gathered:logs,gatheredTotal:2});
 f.step(210);
 expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
 expect(s.ecs.forageable[root].amount).toBe(0);
 f.step(180);
 expect(s.ecs.manager[p].jobs).not.toContain(job);
 expect(s.ecs.container[camp].amounts.wood).toBe(2);
});
