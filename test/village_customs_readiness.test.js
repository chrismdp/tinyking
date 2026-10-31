jest.mock("components/contexts",()=>require("../src/components/contexts"),{virtual:true});
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { VillageMembership, CustomsEncounter } from "../src/components/village_customs";
import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { enqueueTask } from "game/manager";
import { talk } from "game/tasks";
import { Task } from "game/htn";
import { SPEECH_REACH } from "game/conversation";
import { oathEligibility, openOath, dialogueValid, answerCustoms, updateCustoms, membership, resourcePermission } from "game/village_customs";

function readyWorld({party,need,member=false,child=false,distant=false}={}) {
  const w=peopleWorld(),s=w.state;
  // INITIAL home, old spoken contact and trust. No oath outcome is assigned.
  const [house,tree]=newEntities(s,[
    {spatial:{...s.ecs.spatial[w.tiles[2]]},building:{},household:{},village:{villageId:"village"},controllable:{controllerId:w.parent}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},good:{type:"wood",amount:5},tree:{}}
  ]);
  Object.assign(s.villages.village,{id:"village",houses:[house],sharedPlaces:[]});
  for(const id of [w.person,w.parent,w.sibling])s.ecs.household[id].houseId=house;
  s.ecs.household[w.player]={houseId:null};s.ecs.village[w.player]={villageId:null};
  s.ecs.relationships[w.parent].known[w.player]={ring:"social",goodwill:12};
  s.knowledge={[w.player]:{people:{[w.parent]:{traits:[],conversation:{day:-1}}},feelings:{}}};
  s.ecs.spatial[w.parent]={...s.ecs.spatial[w.tiles[3]]};
  s.ecs.spatial[w.player]={...s.ecs.spatial[distant?w.tiles[0]:w.tiles[3]],x:s.ecs.spatial[distant?w.tiles[0]:w.tiles[3]].x-30};
  // INITIAL needs use the same latched planner feelings as native dialogue.
  for(const id of [w.player,w.person,w.parent,w.sibling]) {
    s.ecs.personable[id].hunger=0;s.ecs.personable[id].tiredness=0;
    s.ecs.planner[id].world.feeling={hungry:false,tired:false};
    if(id!=w.player){s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];}
  }
  if(party) {
    const id=party=="actor"?w.player:w.parent;
    s.ecs.planner[id].world.feeling[need]=true;
    s.ecs.personable[id][need=="hungry"?"hunger":"tiredness"]=1.1;
  }
  if(member)s.ecs.village[w.player].memberships={village:{day:-2}};
  if(child)s.ecs.personable[w.player].age=12;
  s.ui.actions={talk_to:jest.fn()};
  return {...w,house,tree};
}
function completeTalk(w,key) {
  const s=w.state,world=s.ecs.planner[w.player].world;
  let result;
  for(let minute=0;minute<60;minute++) {
    result=talk(s,w.player,world,1/1440,minute==0,w.parent,key);
    if(result!=Task.CONTINUE || s.customs?.dialogue)return result;
  }
  throw new Error("The real timed conversation did not finish");
}
const facts=s=>JSON.stringify({knowledge:s.knowledge,bonds:s.ecs.relationships,rights:s.ecs.village,events:s.events,patience:s.talking,needs:s.ecs.personable});
const render=(s,child)=>renderToStaticMarkup(<GameState.Provider value={s}>{child}</GameState.Provider>);

it.each([["elder","tired","The elder needs rest"],["elder","hungry","The elder needs food"],["actor","hungry","You need food"],["actor","tired","You need rest"]])("refuses %s %s at eligibility, panel and actual timed oath completion",(party,need,message)=>{
  const w=readyWorld({party,need}),s=w.state,before=facts(s);
  expect(oathEligibility(s,w.player,"village")).toMatchObject({ok:false,reason:expect.stringContaining(message)});
  const html=render(s,<VillageMembership personId={w.parent}/>);
  expect(html).toContain(message);expect(html).toContain("disabled=\"\"");
  expect(completeTalk(w,"village_oath")).toBe(Task.FINISH);
  expect(s.ui.talkResult.message).toContain(message);
  expect(s.customs?.dialogue).toBeUndefined();
  for(const id of [w.player,w.parent])expect(s.ecs.planner[id].world.customsHold).toBeFalsy();
  expect(facts(s)).toBe(before);
  expect(resourcePermission(s,w.player,w.tree).permitted).toBe(false);
  expect(s.knowledge?.[w.parent]?.people?.[w.player]?.conversation).toBeUndefined();
});

it("opens a valid ready dialogue and earns only common rights through the actual answer",()=>{
  const w=readyWorld(),s=w.state;
  const before=JSON.stringify({contact:s.knowledge[w.player].people[w.parent].conversation,rights:s.ecs.village,events:s.events});
  expect(oathEligibility(s,w.player,"village").ok).toBe(true);
  expect(completeTalk(w,"village_oath")).toBe(Task.CONTINUE);
  expect(dialogueValid(s)).toBe(true);
  expect(JSON.stringify({contact:s.knowledge[w.player].people[w.parent].conversation,rights:s.ecs.village,events:s.events})).toBe(before);
  expect(answerCustoms(s,"accept")).toBe(true);
  expect(membership(s,w.player,"village")).toBe("oath");
  expect(resourcePermission(s,w.player,w.tree).permitted).toBe(true);
  expect(resourcePermission(s,w.player,w.house)).toMatchObject({kind:"private",permitted:false});
  expect(s.events.filter(e=>e.type=="village_oath")).toHaveLength(1);
  expect(s.knowledge[w.parent].people[w.player].conversation).toBeDefined();
});

it.each([["elder","tired","The elder needs rest"],["actor","hungry","You need food"]])("keeps membership and contact unchanged when %s is %s at leave completion",(party,need,message)=>{
  const w=readyWorld({party,need,member:true,child:true}),s=w.state,before=facts(s);
  const html=render(s,<VillageMembership personId={w.parent}/>);
  expect(html).toContain(message);expect(html).toContain("disabled=\"\"");
  expect(completeTalk(w,"village_leave")).toBe(Task.FINISH);
  expect(s.ui.talkResult.message).toContain(message);
  expect(s.customs?.dialogue).toBeUndefined();expect(facts(s)).toBe(before);
});

it("still lets a ready child member leave through the existing dialogue policy",()=>{
  const w=readyWorld({member:true,child:true}),s=w.state;
  expect(openOath(s,w.player,w.parent,true).ok).toBe(true);
  expect(answerCustoms(s,"leave")).toBe(true);
  expect(membership(s,w.player,"village")).toBe(null);
});

it("returns a clear refusal when a real queued approach reaches an elder who became tired",()=>{
  const w=readyWorld({distant:true}),s=w.state;
  // INITIAL elder is near the native fatigue boundary; the simulation changes
  // their feeling while the queued player walks to the actual speaker.
  s.ecs.personable[w.parent].tiredness=.8999;
  w.step(.98); // The first native hourly needs update is one minute away.
  expect(oathEligibility(s,w.player,"village").ok).toBe(true);
  const before=JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events});
  const job=enqueueTask(s,{key:"village_oath"},w.parent);
  for(let i=0;i<900 && s.ecs.manager[w.player].jobs.includes(job);i++)w.step(.01);
  expect(s.ecs.manager[w.player].jobs).not.toContain(job);
  expect(s.ecs.planner[w.parent].world.feeling.tired).toBe(true);
  expect(s.ui.talkResult.message).toContain("The elder needs rest");
  const a=s.ecs.spatial[w.player],b=s.ecs.spatial[w.parent];
  expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThanOrEqual(SPEECH_REACH);
  for(const id of [w.player,w.parent]) {
    expect(s.ecs.planner[id].world.customsHold).toBeFalsy();
    expect(s.ecs.planner[id].world.capturedBy).toBeFalsy();
  }
  expect(s.customs?.dialogue).toBeUndefined();
  expect(JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events})).toBe(before);
});

it.each(["update","answer"])("explains native fatigue cancellation via %s without awarding an oath or contact",path=>{
  const w=readyWorld(),s=w.state;
  // INITIAL fatigue is below the native sensor boundary at opening.
  s.ecs.personable[w.parent].tiredness=.8999;
  expect(openOath(s,w.player,w.parent).ok).toBe(true);
  const before=JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events});
  w.step(61/60); // Native sensor has fired; the next customs tick is pending.
  expect(s.ecs.planner[w.parent].world.feeling.tired).toBe(true);
  expect(s.customs.dialogue).toBeDefined();
  if(path=="answer")expect(answerCustoms(s,"accept")).toBe(false);
  else updateCustoms(s);
  expect(s.customs.dialogue).toBeUndefined();
  expect(render(s,<CustomsEncounter/>)).toContain("The elder needs rest");
  for(const id of [w.player,w.parent])expect(s.ecs.planner[id].world.customsHold).toBeFalsy();
  expect(JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events})).toBe(before);
});
