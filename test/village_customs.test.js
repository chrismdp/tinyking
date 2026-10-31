import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { enqueueTask } from "game/manager";
import { householdAccess } from "game/playable";
import { commonLand, resourcePermission, villageElder, observeChop, updateCustoms, answerCustoms, oathEligibility, membership } from "game/village_customs";

function world() {
  const w = peopleWorld(), { state:s, player, person, parent, sibling, tiles } = w;
  const [house, tree, wild] = newEntities(s, [
    { spatial:{...s.ecs.spatial[tiles[2]]}, building:{}, household:{plot:{hexes:["2,0"]}}, village:{villageId:"village"}, controllable:{controllerId:parent} },
    { spatial:{...s.ecs.spatial[tiles[4]]}, tree:{}, good:{type:"wood",amount:10} },
    { spatial:{...s.ecs.spatial[tiles[5]]}, tree:{}, good:{type:"wood",amount:1} }
  ]);
  // Use real hex keys rather than assuming the grid's string representation.
  s.ecs.household[house].plot.hexes = [require("game/hex").Hex().fromPoint(s.ecs.spatial[house]).toString()];
  Object.assign(s.villages.village,{id:"village",houses:[house],sharedPlaces:[]});
  for(const id of [person,parent,sibling]) {
    s.ecs.household[id].houseId=house;
    s.ecs.planner[id].task=["wait_for",1]; s.ecs.planner[id].plan=[];
  }
  s.ecs.spatial[parent]={...s.ecs.spatial[tiles[1]]};
  s.ecs.spatial[sibling]={...s.ecs.spatial[tiles[0]]};
  s.ecs.household[player]={houseId:null};s.ecs.village[player]={villageId:null};
  s.ecs.spatial[player]={...s.ecs.spatial[tree]};
  return {...w,house,tree,wild};
}
function until(w, predicate) {
  for(let i=0;i<900&&!predicate();i++)w.step(.01);
  expect(predicate()).toBeTruthy();
}
function order(w) {return enqueueTask(w.state,{key:"cut_tree_down"},w.tree);}

it("derives a walkable woodland fringe from actual household plots; distant resources are free",()=>{
  const w=world(),s=w.state;
  expect(commonLand(s).get(w.tiles[4])).toBe("village");
  expect(resourcePermission(s,w.player,w.tree)).toMatchObject({kind:"common",permitted:false,villageId:"village"});
  expect(resourcePermission(s,w.player,w.wild)).toMatchObject({kind:"unclaimed",permitted:true});
  delete s.ecs.walkable[w.tiles[3]].neighbours[Object.keys(s.ecs.walkable[w.tiles[3]].neighbours).find(k=>s.ecs.walkable[w.tiles[3]].neighbours[k]==w.tiles[4])];
  expect(commonLand(s).has(w.tiles[4])).toBe(false);
});
it("scopes commons to the village and leaves private trees/stores private even for members",()=>{
  const w=world(),s=w.state;
  s.ecs.village[w.player].memberships={village:{day:s.days}};
  expect(resourcePermission(s,w.player,w.tree).permitted).toBe(true);
  s.ecs.controllable[w.tree]={controllerId:w.person};
  expect(resourcePermission(s,w.player,w.tree)).toMatchObject({kind:"private",permitted:false});
  expect(householdAccess(s.ecs,w.player,w.house)).toBe(false);
  delete s.ecs.controllable[w.tree];
  s.ecs.village[w.player].memberships={elsewhere:{day:s.days}};
  expect(resourcePermission(s,w.player,w.tree).permitted).toBe(false);
});
it("chooses a living resident adult elder consistently and replaces death or departure",()=>{
  const w=world(),s=w.state;
  expect(villageElder(s,"village")).toBe(w.parent);
  s.ecs.personable[w.parent].dead=true;
  expect(villageElder(s,"village")).toBe(w.person);
  s.ecs.village[w.person].villageId="elsewhere";
  expect(villageElder(s,"village")).toBe(w.sibling);
});
it("needs actual nearby observation; no generation, clearance, remote or member offence",()=>{
  for(const mode of ["remote","generation","member","not-player"]){
    const w=world(),s=w.state,job=order(w);
    if(mode=="remote")for(const id of [w.person,w.parent,w.sibling])s.ecs.spatial[id]={x:10000,y:10000};
    if(mode=="generation")s.generatingHistory=true;
    if(mode=="member")s.ecs.village[w.player].memberships={village:{day:s.days}};
    observeChop(s,mode=="not-player"?w.person:w.player,w.tree,job);
    expect(s.customs?.incidents||[]).toHaveLength(0);
    expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
  }
});
it("walks a real witness to the chopping player, interrupts once, and needs explicit acknowledgement",()=>{
  const w=world(),s=w.state,job=order(w),start={...s.ecs.spatial[w.person]};
  until(w,()=>!!s.customs?.dialogue);
  const d=s.customs.dialogue;
  expect(d.speakerId).toBe(w.person);
  expect(Math.hypot(s.ecs.spatial[w.person].x-start.x,s.ecs.spatial[w.person].y-start.y)).toBeGreaterThan(10);
  expect(Math.hypot(s.ecs.spatial[w.person].x-s.ecs.spatial[w.player].x,s.ecs.spatial[w.person].y-s.ecs.spatial[w.player].y)).toBeLessThanOrEqual(70);
  expect(s.ecs.manager[w.player].jobs).not.toContain(job);
  expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
  expect(answerCustoms(s,"acknowledge")).toBe(true);
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBe(-3);
  expect(s.knowledge[w.player].people[w.person].conversation).toBeDefined();
  expect(answerCustoms(s,"acknowledge")).toBe(false);
  w.step(.1);
  expect(s.ecs.manager[w.player].jobs).toEqual([]);
});
it("observes once per explicit order, and repeat deliberate cutting carries the larger loss",()=>{
  const w=world(),s=w.state,job=order(w);
  observeChop(s,w.player,w.tree,job);observeChop(s,w.player,w.tree,job);
  expect(s.customs.incidents).toHaveLength(1);
  until(w,()=>!!s.customs?.dialogue);answerCustoms(s,"refuse");
  until(w,()=>s.customs.incidents[0].status=="done");
  order(w);until(w,()=>!!s.customs?.dialogue);
  const before=s.ecs.relationships[s.customs.dialogue.speakerId].known[w.player]?.goodwill||0;
  const speaker=s.customs.dialogue.speakerId;
  answerCustoms(s,"acknowledge");
  expect(s.ecs.relationships[speaker].known[w.player].goodwill).toBe(before-6);
});
it("elder learns only after a physical timed report; bystanders get no penalty",()=>{
  const w=world(),s=w.state;order(w);
  until(w,()=>!!s.customs?.dialogue);
  expect(s.ecs.relationships[w.parent].known[w.player]).toBeUndefined();
  answerCustoms(s,"acknowledge");
  expect(s.ecs.relationships[w.parent].known[w.player]).toBeUndefined();
  until(w,()=>s.customs.incidents[0].status=="done");
  expect(s.ecs.relationships[w.parent].known[w.player].goodwill).toBeLessThan(-1.8);
  expect(s.ecs.relationships[w.sibling].known[w.player]).toBeUndefined();
  const report=s.events.find(e=>e.type=="commons_report");
  expect(report.people).toEqual([w.person,w.parent,w.player]);
  expect(report.day).toBeGreaterThan(s.events.find(e=>e.type=="commons_warning").day);
  expect(s.knowledge[w.person].people[w.parent].conversation).toBeDefined();
});
it("revalidates dead/moved witnesses and releases a dialogue when its speaker leaves",()=>{
  const w=world(),s=w.state;order(w);until(w,()=>!!s.customs?.dialogue);
  s.ecs.personable[w.person].dead=true;updateCustoms(s);
  expect(s.customs.dialogue).toBeFalsy();
  expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
  expect(s.ecs.planner[w.player].world.customsHold).toBeFalsy();
});
it("requires adult household eligibility, an actual elder conversation and achievable earned trust",()=>{
  const w=world(),s=w.state;
  expect(oathEligibility(s,w.player,"village").ok).toBe(false);
  s.ecs.relationships[w.parent].known[w.player]={ring:"social",goodwill:12};
  s.knowledge={[w.player]:{people:{[w.parent]:{conversation:{day:s.days}}},feelings:{}}};
  expect(oathEligibility(s,w.player,"village").ok).toBe(true);
  s.ecs.household[w.player].houseId=w.house;s.ecs.village[w.player].villageId="elsewhere";s.ecs.village[w.house].villageId="elsewhere";
  expect(oathEligibility(s,w.player,"village").ok).toBe(false);
});
it("recognises actual native households, never copies an oath to another person or another village",()=>{
  const w=world(),s=w.state;
  expect(membership(s,w.person,"village")).toBe("household");
  s.ecs.village[w.player].memberships={village:{day:s.days}};
  expect(membership(s,w.player,"village")).toBe("oath");
  expect(membership(s,w.player,"other")).toBe(null);
  expect(membership(s,w.sibling,"other")).toBe(null);
  const saved=JSON.parse(JSON.stringify(s.ecs.village[w.player]));
  s.ecs.village[w.player]=saved;s.ecs.spatial[w.player]={x:100000,y:0};
  expect(membership(s,w.player,"village")).toBe("oath");
  const [heir]=newEntities(s,[{village:{villageId:null},personable:{age:20}}]);
  expect(membership(s,heir,"village")).toBe(null);
});

it("queues an observed offence through urgent work and reaches an otherwise idle player",()=>{
  const w=world(),s=w.state,job=order(w);
  s.ecs.planner[w.person].world.currentJob={key:"urgent"};
  s.ecs.spatial[w.parent]={...s.ecs.spatial[w.tiles[0]]};
  observeChop(s,w.player,w.tree,job);updateCustoms(s);
  expect(s.customs.incidents[0].status).toBe("queued");
  s.ecs.manager[w.player].jobs=[];
  const position={...s.ecs.spatial[w.player]};
  s.ecs.planner[w.player].task=null;s.ecs.planner[w.player].plan=null;
  s.ecs.planner[w.person].world.currentJob=null;
  until(w,()=>!!s.customs.dialogue);
  expect(s.ecs.spatial[w.player].x).toBe(position.x);
  expect(s.ecs.spatial[w.player].y).toBe(position.y);
});
it("does not complete a blocked approach or a report from a dead witness",()=>{
  const w=world(),s=w.state,job=order(w);
  observeChop(s,w.player,w.tree,job);
  s.ecs.walkable[w.tiles[3]].neighbours={};
  updateCustoms(s);w.step(.05);
  expect(s.customs.dialogue).toBeFalsy();
  expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
  s.ecs.personable[w.person].dead=true;updateCustoms(s);
  expect(s.events.some(e=>e.type=="commons_report")).toBe(false);
});
it("receives and declines an oath through a real visit, then swears and leaves explicitly",()=>{
  const w=world(),s=w.state;
  // Earn trust through real chat actions; no final relationship injection.
  const { chat }=require("game/people");
  for(let day=0;day<3;day++) {s.days=day+.4;chat(s,w.player,w.parent);chat(s,w.player,w.parent);}
  expect(oathEligibility(s,w.player,"village").ok).toBe(true);
  enqueueTask(s,{key:"village_oath"},w.parent);
  until(w,()=>s.customs?.dialogue?.kind=="oath");
  expect(membership(s,w.player,"village")).toBe(null);
  answerCustoms(s,"decline");
  expect(membership(s,w.player,"village")).toBe(null);
  enqueueTask(s,{key:"village_oath"},w.parent);
  until(w,()=>s.customs?.dialogue?.kind=="oath");
  expect(answerCustoms(s,"accept")).toBe(true);
  expect(resourcePermission(s,w.player,w.tree).permitted).toBe(true);
  expect(s.ecs.manager[w.player].jobs).toEqual([]);
  const [permittedTree]=newEntities(s,[{spatial:{...s.ecs.spatial[w.tree]},tree:{},good:{type:"wood",amount:1}}]);
  enqueueTask(s,{key:"cut_tree_down"},permittedTree);until(w,()=>!s.ecs.good[permittedTree]);
  expect(s.customs.incidents).toEqual([]);
  enqueueTask(s,{key:"village_leave"},w.parent);
  until(w,()=>s.customs?.dialogue?.kind=="leave");answerCustoms(s,"leave");
  expect(resourcePermission(s,w.player,w.tree).permitted).toBe(false);
  expect(s.events.filter(e=>e.type=="village_oath")).toHaveLength(1);
  expect(s.events.filter(e=>e.type=="village_leave")).toHaveLength(1);
});
it("preserves factual warning history when a real accepted harvest favour restores goodwill",()=>{
  const w=world(),s=w.state;order(w);until(w,()=>!!s.customs?.dialogue);answerCustoms(s,"acknowledge");
  const { updateFavours,acceptFavour }=require("game/favours");
  const [store,field]=newEntities(s,[
    {spatial:{...s.ecs.spatial[w.house]},container:{amounts:{grain:30},capacity:100},controllable:{controllerId:w.person}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},farmable:{houseId:w.house,slots:[{state:"harvestable",content:"grain",amount:2}]},controllable:{controllerId:w.person}}
  ]);
  s.ecs.household[w.house].storeId=store;s.ecs.household[w.house].fields=[field];
  // The witness is the actual householder requesting help.
  s.ecs.controllable[w.house].controllerId=w.person;
  updateFavours(s);
  const r=Object.values(s.favours.requests).find(r=>r.kind=="harvest");
  expect(r.giverId).toBe(w.person);
  const before=s.ecs.relationships[w.person].known[w.player].goodwill;
  acceptFavour(s,r.id);until(w,()=>r.status=="completed");
  expect(s.ecs.container[store].amounts.grain).toBe(32);
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBeGreaterThan(before+r.goodwill-.2);
  expect(s.events.filter(e=>e.type=="commons_warning")).toHaveLength(1);
});
it("keeps building clearance privileged and creates neither offence nor resource reward",()=>{
  const w=world(),s=w.state;
  const { reserveBuildingClearance }=require("game/tree_clearance");
  const before=Object.keys(s.ecs.haulable || {}).length;
  reserveBuildingClearance(s,w.house,{...s.ecs.spatial[w.tree],halfWidth:10,halfDepth:10,angle:0,door:{halfWidth:10,from:0,to:10}});
  expect(s.ecs.good[w.tree]).toBeUndefined();
  expect(s.customs).toBeUndefined();
  expect(Object.keys(s.ecs.haulable || {})).toHaveLength(before);
});
it("replaces a dead elder during a pending report without a self-conversation or double loss",()=>{
  const w=world(),s=w.state;order(w);until(w,()=>!!s.customs?.dialogue);answerCustoms(s,"acknowledge");
  const before=s.ecs.relationships[w.person].known[w.player].goodwill;
  s.ecs.personable[w.parent].dead=true;updateCustoms(s);
  expect(villageElder(s,"village")).toBe(w.person);
  expect(s.customs.incidents[0].status).toBe("done");
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBe(before);
  expect(s.knowledge[w.person]?.people?.[w.person]?.conversation).toBeUndefined();
});
it("rechecks private tree permission in the actual work task",()=>{
  const w=world(),s=w.state;
  s.ecs.controllable[w.tree]={controllerId:w.parent};
  const job=order(w);w.step(.1);
  expect(s.ecs.good[w.tree].amount).toBe(10);
  expect(job.progress).toBe(0);
  expect(job.waiting).toBeTruthy();
});
it("blocks an oath from a distance, rechecks trust on acceptance, and cancels on elder departure",()=>{
  const w=world(),s=w.state,{openOath}=require("game/village_customs");
  expect(openOath(s,w.player,w.parent).ok).toBe(false);
  const {chat}=require("game/people");
  for(let day=0;day<3;day++){s.days=day+.4;chat(s,w.player,w.parent);chat(s,w.player,w.parent);}
  enqueueTask(s,{key:"village_oath"},w.parent);until(w,()=>s.customs?.dialogue?.kind=="oath");
  s.ecs.relationships[w.parent].known[w.player].goodwill=0;
  expect(answerCustoms(s,"accept")).toBe(false);
  expect(membership(s,w.player,"village")).toBe(null);
  s.ecs.village[w.parent].villageId="elsewhere";updateCustoms(s);
  expect(s.customs.dialogue).toBeFalsy();
  expect(s.ecs.planner[w.player].world.customsHold).toBeFalsy();
});
it("groups observed pre-warning cutting into one warning incident",()=>{
  const w=world(),s=w.state,first=order(w);
  observeChop(s,w.player,w.tree,first);
  const second=order(w);observeChop(s,w.player,w.tree,second);
  expect(s.customs.incidents).toHaveLength(1);
  until(w,()=>!!s.customs?.dialogue);answerCustoms(s,"acknowledge");
  w.step(.2);
  expect(s.customs.dialogue).toBeFalsy();
  expect(s.events.filter(e=>e.type=="commons_warning")).toHaveLength(1);
});
it("routes towards the offender's new position rather than completing contact at the old tree",()=>{
  const w=world(),s=w.state,job=order(w);
  observeChop(s,w.player,w.tree,job);updateCustoms(s);w.step(.01);
  // Movement during an observed visit is a new navigation target.
  s.ecs.manager[w.player].jobs=[];s.ecs.planner[w.player].world.currentJob=null;
  s.ecs.planner[w.player].task=null;s.ecs.planner[w.player].plan=null;
  Object.assign(s.ecs.spatial[w.player],s.ecs.spatial[w.tiles[5]]);
  until(w,()=>!!s.customs?.dialogue);
  const d=s.customs.dialogue,a=s.ecs.spatial[w.player],b=s.ecs.spatial[d.speakerId];
  expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThanOrEqual(70);
  expect(s.knowledge?.[w.player]?.people?.[d.speakerId]?.conversation).toBeUndefined();
});
