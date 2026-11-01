import { respond, discussOath } from "./support/customs_chat";
import { peopleWorld } from './support/people';
import { newEntities } from 'game/entities';
import { completeConversation } from 'game/people';
import { openChat, chatChoices, chooseLine, previewLine, patience } from 'game/chat';
import { enqueueTask, expireChatApproach } from 'game/manager';
import { updateFavours, acceptFavour, favourWaiting } from 'game/favours';
import { observeChop, updateCustoms, oathEligibility } from 'game/village_customs';
import { learnEvent } from 'game/events';

function harvestWorld() {
  const w=peopleWorld(),s=w.state,h=w.tiles[3];
  s.ecs.household[h]={fields:[],storeId:h};s.ecs.container={[h]:{capacity:20,amounts:{grain:2}}};
  const [field]=newEntities(s,[{spatial:{...s.ecs.spatial[w.tiles[2]]},farmable:{houseId:h,slots:Array.from({length:3},()=>({state:'harvestable',content:'grain',amount:6}))},controllable:{controllerId:w.parent}}]);
  s.ecs.household[h].fields=[field];
  for(const id of [w.person,w.parent,w.sibling])delete s.ecs.planner[id];
  s.knowledge={[w.player]:{people:{[w.parent]:{traits:[],conversation:{day:s.days}}},favours:[],offers:{}}};
  updateFavours(s);
  const r=Object.values(s.favours.requests).find(r=>r.kind=='harvest');
  if(r){s.knowledge[w.player].favours.push(r.id);s.knowledge[w.player].offers[r.id]={speakerId:w.parent,day:s.days};}
  return {...w,h,field,r};
}
function oathWorld() {
  const w=peopleWorld(),s=w.state;
  Object.assign(s.villages.village,{id:'village',houses:[w.tiles[3]],centre:{x:3,y:0},sharedPlaces:[]});
  s.ecs.village[w.tiles[3]]={villageId:'village'};s.ecs.building={[w.tiles[3]]:{}};
  s.ecs.household[w.player]={houseId:null};s.ecs.village[w.player]={villageId:null};
  s.ecs.relationships[w.parent].known[w.player]={ring:'social',goodwill:10.1};
  s.knowledge={[w.player]:{people:{[w.parent]:{traits:[],conversation:{day:s.days}}}}};
  return w;
}
it('contact alone never copies family history or earns a family story',()=>{
  const {state:s,player:p,parent:n,person:child}=peopleWorld();
  s.ecs.relationships[n].known[p]={ring:'social',goodwill:16};
  const event={id:'old-birth',type:'birth',people:[child,n],day:-3};s.events=[event];learnEvent(s,n,event);
  completeConversation(s,p,n);
  expect(s.knowledge[p].people[n].conversation).toBeDefined();
  expect(s.knowledge[p].events||[]).not.toContain(event.id);
  expect(s.peopleGoals?.[p]?.earned?.story).toBeUndefined();
});
it('an oath response records contact and rights without unspoken family events',()=>{
  const w=oathWorld(),s=w.state;
  s.ecs.spatial[w.player]={...s.ecs.spatial[w.parent],x:s.ecs.spatial[w.parent].x-45};
  const event={id:'old-marriage',type:'marriage',people:[w.parent,w.person],day:-20};s.events=[event];learnEvent(s,w.parent,event);
  expect(discussOath(s,w.player,w.parent).ok).toBe(true);
  expect(respond(s,'accept')).toBe(true);
  expect(s.knowledge[w.player].events||[]).not.toContain(event.id);
});
it('offers no harvest beyond capacity, and limits a smaller offer to whole patches that fit',()=>{
  const w=harvestWorld(),s=w.state;
  expect(w.r.quantity).toBe(3);
  s.favours.requests={};s.ecs.container[w.h].amounts.grain=13;updateFavours(s);
  expect(Object.values(s.favours.requests).find(r=>r.kind=='harvest')?.quantity).toBe(1);
  s.favours.requests={};s.ecs.container[w.h].amounts.grain=19;updateFavours(s);
  expect(Object.values(s.favours.requests).some(r=>r.kind=='harvest')).toBe(false);
});
it('finishes an accepted harvest if the pantry fills, with owned crop beside the store and conserved yield',()=>{
  const w=harvestWorld(),s=w.state,r=w.r;
  const task=acceptFavour(s,r.id);expect(task).toBeTruthy();
  s.ecs.container[w.h].amounts={wood:20};
  expect(favourWaiting(s,task)).toBeNull();
  w.step(12);
  expect(r).toMatchObject({status:'completed',progress:3});
  expect(r.delivered+(r.gleaned?.length||0)).toBe(18);
  expect(s.ecs.container[w.h]).toMatchObject({capacity:20,amounts:{wood:20}});
  expect(r.receipts).toHaveLength(r.delivered);
  for(const receipt of r.receipts){
    expect(receipt.use).toBe('handed_over');
    expect(s.ecs.good[receipt.itemId]).toMatchObject({type:'grain',amount:1});
    expect(s.ecs.household[receipt.itemId].houseId).toBe(w.h);
    expect(s.ecs.haulable[receipt.itemId].heldBy).toBeFalsy();
    expect(s.ecs.haulable[receipt.itemId].reservedFor).toBeFalsy();
  }
});
it('checks oath eligibility again at enqueue instead of starting an ineligible approach',()=>{
  const w=oathWorld(),s=w.state;
  expect(oathEligibility(s,w.player,'village').ok).toBe(true);
  s.ecs.relationships[w.parent].known[w.player].goodwill=9.9;
  const job=enqueueTask(s,{key:"chat"},w.parent,{chatIntent:"oath"});
  expect(s.ecs.manager[w.player].jobs).not.toContain(job);
  expect(s.ui.talkResult.message).toMatch(/9.9.*10 goodwill/);
});
it('ends an oath approach within the same one hour bound as Chat, releasing attention',()=>{
  const w=oathWorld(),s=w.state;
  const job=enqueueTask(s,{key:"chat"},w.parent,{chatIntent:"oath"});expireChatApproach(s);
  s.days+=1.1/24;expireChatApproach(s);
  expect(s.ecs.manager[w.player].jobs).not.toContain(job);
  expect(s.ui.talkResult.message).toMatch(/within an hour|rest|meal/);
  expect(s.ecs.planner[w.parent].world.capturedBy).toBeFalsy();
});
it.each(['help','family','season','village'])('has a usable reply after the name-first rebuff, including %s focus',focus=>{
  const {state:s,player:p,person:n}=peopleWorld();
  s.ecs.personality[n]={traits:['proud'],likes:[],dislikes:['generous','proud','brave']};s.opinionThresholds={hate:1000,love:2000};
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  expect(openChat(s,p,n)).toBe(true);
  const help=chatChoices(s).find(l=>l.family=='help_offer');expect(help).toBeDefined();chooseLine(s,help.key);
  const intro=chatChoices(s).find(l=>l.family=='introduction');expect(intro).toBeDefined();chooseLine(s,intro.key);
  const c=s.chat.active;c.focus=focus;
  expect(patience(s,p,n).max-c.row.length).toBeGreaterThan(0);
  expect(chatChoices(s).filter(l=>previewLine(s,l).fits).length).toBeGreaterThan(0);
});
it('offers a polite goodbye if every topic has been spent with free slots',()=>{
 const {state:s,player:p,person:n}=peopleWorld();s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};openChat(s,p,n);
 const c=s.chat.active;
 for(const row of require('data/conversation_lines.json').default || require('data/conversation_lines.json')) c.usedIds.push(row.id);
 c.row=[];c.focus='family';
 const goodbye=chatChoices(s).find(l=>l.family=='leave_taking');
 expect(goodbye).toBeDefined();expect(previewLine(s,goodbye).fits).toBe(true);
 expect(chooseLine(s,goodbye.key)).toBe(true);expect(c.endReason).toBeTruthy();
});

it('keeps an actual Social-trust woodland warning out of family news and milestones',()=>{
 const w=oathWorld(),s=w.state;
 const [tree]=newEntities(s,[{spatial:{...s.ecs.spatial[w.tiles[4]]},tree:{},good:{type:'wood',amount:3}}]);
 s.ecs.spatial[w.player]={...s.ecs.spatial[tree]};
 s.ecs.relationships[w.parent].known[w.player]={ring:'social',goodwill:16,base:16};
 for(const id of [w.person,w.sibling])s.ecs.planner[id].world.capturedBy="busy";
 const birth={id:'henry-old-birth',type:'birth',people:[w.person,w.parent],day:-200};s.events=[birth];learnEvent(s,w.parent,birth);
 const order=enqueueTask(s,{key:'cut_tree_down'},tree);observeChop(s,w.player,tree,order);updateCustoms(s);
 for(let minute=0;minute<60 && !s.chat?.active?.context;minute++)w.step(1/60);
 expect(s.chat?.active?.context).toMatchObject({kind:'warning',speakerId:w.parent});
 expect(respond(s,'acknowledge')).toBe(true);
 expect(s.knowledge[w.player].events).not.toContain(birth.id);
 expect(require('game/guidance').peopleGoals(s).completed).not.toContain('story');
 expect(s.knowledge[w.player].people[w.parent].conversation).toBeDefined();
 expect(s.events.some(e=>e.type=='commons_warning')).toBe(true);
});
it('rechecks pantry room before accepting a stale spoken harvest offer',()=>{
 const w=harvestWorld(),s=w.state;s.ecs.container[w.h].amounts.grain=20;
 expect(acceptFavour(s,w.r.id)).toBeNull();
 expect(w.r).toMatchObject({status:'expired',outcome:expect.stringMatching(/room/)});
 expect(s.ecs.manager[w.player].jobs).toEqual([]);
});
it('receives the oath at the receipt trust of 10.1 before normal drift removes eligibility',()=>{
 const w=oathWorld(),s=w.state,start=s.days;
 const order=enqueueTask(s,{key:"chat"},w.parent,{chatIntent:"oath"});
 for(let minute=0;minute<60 && !s.chat?.active?.context;minute++)w.step(1/60);
 expect(s.chat?.active?.context).toMatchObject({kind:'oath',speakerId:w.parent});
 expect(s.days-start).toBeLessThan(1/24);
 expect(respond(s,'accept')).toBe(true);
 expect(s.ecs.village[w.player].memberships.village).toBeDefined();
 expect(s.ecs.manager[w.player].jobs).not.toContain(order);
});
