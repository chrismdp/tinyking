import { respond, discussOath } from "./support/customs_chat";
import {peopleWorld} from './support/people';
import {newEntities} from 'game/entities';
import {enqueueTask} from 'game/manager';
import {observeChop, updateCustoms, arriveCustoms, customsChatValid } from 'game/village_customs';
import {HOUR} from 'game/time';

function warningWorld(need) {
 const w=peopleWorld(),s=w.state;
 const [house,tree,root]=newEntities(s,[
  {spatial:{...s.ecs.spatial[w.tiles[2]]},building:{},household:{},village:{villageId:'village'},controllable:{controllerId:w.parent}},
  {spatial:{...s.ecs.spatial[w.tiles[4]]},tree:{},good:{type:'wood',amount:3}},
  {spatial:{...s.ecs.spatial[w.tiles[5]]},forageable:{kind:'roots',biome:'marsh',amount:1,growth:0}}
 ]);
 Object.assign(s.villages.village,{id:'village',houses:[house],sharedPlaces:[]});
 for(const id of [w.person,w.parent,w.sibling])s.ecs.household[id].houseId=house;
 for(const id of [w.person,w.sibling])s.ecs.planner[id].world.capturedBy="busy";
 s.ecs.household[w.player]={houseId:null};s.ecs.village[w.player]={villageId:null};
 Object.assign(s.ecs.spatial[w.player],s.ecs.spatial[tree]);
 Object.assign(s.ecs.spatial[w.parent],s.ecs.spatial[tree],{x:s.ecs.spatial[tree].x-45});
 s.ecs.personable[w.player].hunger=need=='hungry'?2.125000000000001:0;
 s.ecs.personable[w.player].tiredness=need=='tired'?1.1768772704007282:0;
 s.ecs.planner[w.player].world.feeling[need]=true;
 const order=enqueueTask(s,{key:'cut_tree_down'},tree);observeChop(s,w.player,tree,order);updateCustoms(s);
 return {...w,tree,root};
}
it.each([['hungry','eat'],['tired','sleep']])('does not repeatedly open and invalidate a warning by interrupting %s care', (need,task)=>{
 const w=warningWorld(need),s=w.state,planner=s.ecs.planner[w.player];
 planner.task=[task,'grain'];planner.plan=[];
 expect(arriveCustoms(s,w.parent,HOUR/60)).toBe(false);
 expect(s.chat?.active?.context).toBeUndefined();
 expect(planner.task).toEqual([task,'grain']);
 expect(s.knowledge?.[w.player]?.people?.[w.parent]?.conversation).toBeUndefined();
});
it('lets the receipt-hungry timber worker finish roots and a meal before a queued warning holds them',()=>{
 const w=warningWorld('hungry'),s=w.state;
 // This is the second replay's failed-care boundary: an already observed cut,
 // no meal in hand, hunger above two, and a witness close enough to keep trying.
 enqueueTask(s,{key:'find_food'},w.player);
 for(let minute=0;minute<180 && s.ecs.personable[w.player].hunger>.3;minute++)w.step(1/60);
 expect(s.ecs.personable[w.player].hunger).toBeLessThan(.3);
 expect(s.ecs.forageable[w.root].amount).toBe(0);
 for(let minute=0;minute<30 && !s.chat?.active?.context;minute++)w.step(1/60);
 expect(s.chat?.active?.context).toMatchObject({kind:'warning'});
 expect(customsChatValid(s)).toBe(true);
 expect(s.knowledge?.[w.player]?.people?.[w.parent]?.conversation).toBeUndefined();
});
