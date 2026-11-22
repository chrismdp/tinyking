import { peopleWorld } from "./support/people";
import { enqueueTask, expireChatApproach, readyPlayerTasks } from "game/manager";
import { approach_chat } from "game/tasks";
import { Task } from "game/htn";

it.each(["eat", "trade_work", "walk_to"])("follows a person doing %s and waits to take their attention until they are free", activity=>{
  const {state:s,player:a,person:n,tiles}=peopleWorld();
  const target=s.ecs.planner[n],world=s.ecs.planner[a].world;
  target.task=[activity,tiles[4]];target.plan=[];
  const start={...s.ecs.spatial[a]},order=enqueueTask(s,{key:"chat"},n);
  approach_chat(s,a,world,1/1440,true,n);
  expect(s.ecs.spatial[a]).not.toEqual(start);
  expect(target.world.capturedBy).toBeFalsy();
  s.days+=3/24;expireChatApproach(s);
  expect(s.ecs.manager[a].jobs).toContain(order);
  s.ecs.spatial[a]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  expect(approach_chat(s,a,world,1/1440,false,n)).toBe(Task.CONTINUE);
  expect(target.world.capturedBy).toBeFalsy();
  target.task=null;
  expect(approach_chat(s,a,world,1/1440,false,n)).toBe(Task.FINISH);
  expect(target.world.capturedBy).toBe(a);
});
it.each(["sleep", "gone", "dead", "blocked"])("ends a queued chat when the person becomes unreachable: %s", reason=>{
  const {state:s,player:a,person:n,tiles}=peopleWorld();
  const order=enqueueTask(s,{key:"chat"},n);expireChatApproach(s);
  if(reason=="sleep")s.ecs.planner[n].task=["sleep"];
  if(reason=="gone")delete s.ecs.spatial[n];
  if(reason=="dead")s.ecs.personable[n].dead=true;
  if(reason=="blocked")for(const id of tiles)s.ecs.walkable[id].neighbours={};
  readyPlayerTasks(s);expireChatApproach(s);
  expect(s.ecs.manager[a].jobs).not.toContain(order);
  expect(s.ui.talkResult).toMatchObject({personId:n,message:expect.any(String)});
  expect(s.knowledge?.[a]?.people?.[n]?.conversation).toBeUndefined();
  expect(s.ecs.planner[n].world.capturedBy).toBeFalsy();
});

import { openChat, chatChoices, chooseLine, closeChat } from "game/chat";
import { recordEvent } from "game/events";
import { festivalPeople, updateFestival, seasonLines } from "game/seasons";
import { recogniseMaternalKin } from "game/mother_family";
import { openingGuidance } from "game/guidance";
import { newEntities } from "game/entities";

it.each(["kin","inlaw","friend","hostile","distant"])("answers death news for a %s with that person's identity and the listener's closeness",closeness=>{
  const {state:s,player:a,person:n,parent:dead,sibling}=peopleWorld();
  s.ecs.spatial[a]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  s.ecs.kinship[n]={parents:[],children:[],spouse:null};
  if(closeness=="kin")s.ecs.kinship[n].parents=[dead];
  if(closeness=="inlaw") {s.ecs.kinship[n].parents=["shared-parent"];s.ecs.kinship["shared-parent"]={parents:[],children:[n,sibling]};s.ecs.kinship[sibling].spouse=dead;}
  s.ecs.relationships[n].known[dead]={ring:closeness=="friend"?"personal":"public",goodwill:closeness=="hostile"?-5:closeness=="friend"?40:0};
  s.knowledge={[a]:{people:{[dead]:{traits:[]}}},[n]:{people:{[dead]:{traits:[]}}}};
  const event=recordEvent(s,"death",[dead],[],{audienceIds:[a]});
  expect(openChat(s,a,n)).toBe(true);
  s.chat.active.row=[];delete s.chat.active.expectation;s.chat.active.focus="tell";
  expect(chooseLine(s,chatChoices(s).find(l=>l.b.event?.id==event.id).key)).toBe(true);
  const answer=s.chat.active.transcript.find(l=>l.family=="death_reaction");
  expect(answer).toMatchObject({situation:"new_"+closeness,icons:expect.arrayContaining([{kind:"person",personId:dead}])});
  expect(s.knowledge[n].events).toContain(event.id);
  expect(s.knowledge[n].spokenSources[event.id].speakerId).toBe(a);
  closeChat(s);s.chat.pairs[a+":"+n].resting=0;
  openChat(s,a,n);s.chat.active.row=[];delete s.chat.active.expectation;s.chat.active.focus="tell";
  chooseLine(s,chatChoices(s).find(l=>l.b.event?.id==event.id).key);
  expect(s.chat.active.transcript.find(l=>l.family=="death_reaction").situation).toBe("known_"+closeness);
  expect(s.knowledge[n].events.filter(id=>id==event.id)).toHaveLength(1);
});

it("keeps festival choices through arrivals, changed ranks and attendance, then refreshes for a new festival",()=>{
  const {state:s,player:a,person:n,parent,sibling}=peopleWorld();
  s.days=6.75;s.villages.village={id:"village",centre:{...s.ecs.spatial[n]}};updateFestival(s);
  const extras=newEntities(s,Array.from({length:3},()=>({personable:{age:30},spatial:{...s.ecs.spatial[n]},nameable:{nickname:"Neighbour"}})));
  const offered=festivalPeople(s,[n,parent,sibling,...extras]);
  s.backstories={[a]:{relatives:[{id:extras[2]}]}};s.knowledge={[a]:{people:{[extras[2]]:{nameOnly:true}}}};
  expect(festivalPeople(s,[...extras,n,parent,sibling])).toEqual(offered);
  s.days=13.75;updateFestival(s);
  expect(festivalPeople(s,[...extras,n,parent,sibling])[0]).toBe(extras[2]);
});

it("leads with this season's family reunions and earned milestones, keeps counts later and does not repeat them next season",()=>{
  const {state:s,player:a,person:n,parent,sibling}=peopleWorld();
  s.backstories={[a]:{motherId:parent,relatives:[{id:n,name:"Agnes",term:"aunt",inverse:"niece"},{id:sibling,name:"Alice",term:"aunt",inverse:"niece"}]}};
  s.knowledge={[a]:{people:{},maternalFamily:{met:[]},peopleGoals:{earned:{trust:{day:1,personId:n}}}}};
  s.days=1;recogniseMaternalKin(s,a,n);s.days=2;recogniseMaternalKin(s,a,sibling);
  recordEvent(s,"favour",[a,n]);s.knowledge[a].people[n].conversation={day:2};
  const rows=seasonLines(s,0);
  expect(rows[0]).toMatchObject({id:"maternal-family",section:"player",personIds:[n,sibling],complete:true});
  expect(rows[1].id).toBe("milestone-trust");
  expect(rows.findIndex(r=>r.id=="your-season")).toBeGreaterThan(1);
  expect(seasonLines(s,1).some(r=>r.id=="maternal-family"||r.id=="milestone-trust")).toBe(false);
});
it("keeps the maternal milestone visible within a busy season's six entries",()=>{
  const {state:s,player:a,person:n}=peopleWorld();
  s.backstories={[a]:{relatives:[{id:n,name:"Agnes",term:"aunt"}]}};
  s.knowledge={[a]:{people:{},maternalFamily:{met:[n],reunions:{[n]:{day:2}}}}};
  for(let i=0;i<10;i++)recordEvent(s,"death",[n],[],{audienceIds:[a],day:1});
  const rows=seasonLines(s,0);
  expect(rows).toHaveLength(6);expect(rows[0].id).toBe("maternal-family");
  expect(rows.at(-1).section).toBe("more");
});
it("asks first about the same unvisited relative that the opening hint selects",()=>{
  const {state:s,player:a,person:n,parent,sibling}=peopleWorld();
  s.backstories={[a]:{motherId:n,relatives:[{id:parent,name:"Edith",term:"aunt"},{id:sibling,name:"Alice",term:"aunt"}]}};
  s.knowledge={[a]:{people:{},maternalFamily:{met:[]}}};
  s.intro={active:false};s.ecs.playable[a].known=s.ecs.playable[a].known.concat(require("game/hex").Hex().fromPoint(s.ecs.spatial[n]));
  const hint=openingGuidance(s);expect(hint.relativeId).toBe(parent);
  s.ecs.spatial[a]={...s.ecs.spatial[n]};openChat(s,a,n);
  const question=chatChoices(s).find(l=>l.family=="maternal_search");
  expect(question.b.relative.id).toBe(hint.relativeId);
});
