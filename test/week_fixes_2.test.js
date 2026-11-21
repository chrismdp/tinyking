/* global jest, it, expect, require */
import { economy } from "./support/economy";
import { peopleWorld } from "./support/people";
import { createSimulation } from "game/simulation";
import { enqueueTask } from "game/manager";
import { openChat, lineCandidates, speakLine, chooseLine } from "game/chat";
import { seedMotherFamily, recogniseMaternalKin } from "game/mother_family";
import { knownFamilyTree } from "game/people";
import { personComponent } from "game/residents";
import { newEntities } from "game/entities";
import { peaceUnavailable, makePeace } from "game/social_interventions";
import { recordEvent, learnEvent } from "game/events";
import { completeConversation } from "game/people";
import { socialHour } from "game/social_visits";

jest.mock("game/name",()=>({name:n=>n?.nickname||"?",firstName:n=>n?.nickname||"?",familyName:()=>"?",uniquePersonName:(s,n)=>n}));

it("hands off two consecutive nights at exactly dawn with matching energy and an awake player",()=>{
  const {s,p}=economy();s.days=4+23/24;s.ecs.personable[p].energy=10;
  const sim=createSimulation(s);
  for(let day=5;day<=6;day++) {
    delete s.ui.dayMessage;
    for(let i=0;i<3000&&!s.ui.dayMessage?.startsWith("Morning");i++)sim.step(10);
    expect(s.ui.dayMessage).toMatch(/^Morning/);
    expect(s.days).toBeGreaterThanOrEqual(day+6/24);
    const energy=s.ecs.personable[p].energy;
    expect(Number(s.ui.dayMessage.match(/Energy (\d+)/)[1])).toBe(Math.round(energy));
    for(let i=0;i<120;i++)sim.step(10,0);
    expect(s.ecs.planner[p].task?.[0]).not.toBe("sleep");
    expect(s.ecs.personable[p].energy).toBe(energy);
    while(s.days<day+23/24)sim.step(60,0);
  }
});

it("a movement order wakes automatic sleep immediately and runs instead of waiting for sleep",()=>{
  const {s,p,tiles,world}=economy();s.days=23/24;
  const sim=createSimulation(s);
  for(let i=0;i<100&&!s.nightSleep;i++)sim.step(10,0);
  expect(s.ecs.planner[p].task?.[0]).toBe("sleep");
  const energy=s.ecs.personable[p].energy,from={...s.ecs.spatial[p]};
  enqueueTask(s,{key:"move_to_here"},tiles[2]);
  expect(s.ecs.planner[p].task?.[0]).not.toBe("sleep");
  expect(world.forcedRest).toBeFalsy();
  for(let i=0;i<10;i++)sim.step(10,0);
  expect(s.ecs.spatial[p]).not.toEqual(from);
  expect(s.ecs.personable[p].energy).toBeLessThanOrEqual(energy);
  expect(s.nightSleep).toBeFalsy();
});

function chat() {
  const w=peopleWorld(),{state:s,player:p,person:n}=w;
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  s.ecs.relationships[n].known[p]={ring:"personal",goodwill:40};
  s.ecs.personality[n].traits=["proud","greedy","gloomy"];s.ecs.personality[n].likes=[];s.ecs.personality[n].dislikes=[];
  openChat(s,p,n);s.chat.active.row=[];delete s.chat.active.expectation;s.chat.active.phase="player_turn";
  return w;
}
it("sympathy clears a guarded pair without charging the listener for their own guardedness",()=>{
  const {state:s,player:p,person:n}=chat();const c=s.chat.active;
  c.row=[{kind:"mood",key:"guarded"},{kind:"topic",key:"village"}];
  const line=lineCandidates(s,c,"mood_reply","player").find(l=>l.situation=="guarded");
  const before=s.ecs.relationships[n].known[p].goodwill;
  chooseLine(s,line.key);
  expect(s.ecs.relationships[n].known[p].goodwill).toBeGreaterThanOrEqual(before);
  expect(c.row.some(i=>i.kind=="mood"&&i.key=="guarded")).toBe(false);
});
it("accepting an offered ask and its thanks never charge negative help, family or person matches",()=>{
  const {state:s,player:p,person:n}=chat();const c=s.chat.active;
  s.favours={requests:{visit:{id:"visit",kind:"visit",status:"offered",giverId:n,actorId:p,householdId:s.ecs.household[n].houseId,targetId:s.ecs.kinship[n].parents[0],quantity:1,progress:0}}};
  s.knowledge[p].offers={visit:{speakerId:n,day:s.days}};s.knowledge[p].favours=["visit"];
  s.knowledge[p].people[n].conversation={day:s.days};
  c.pendingOfferId="visit";c.expectation="offer";c.tags.push("offered_help");
  const line=lineCandidates(s,c,"favour_accept","player").find(l=>l.b.request?.id=="visit");
  expect(line).toBeDefined();c.row=line.icons.map(i=>({...i}));
  const before=s.ecs.relationships[n].known[p].goodwill;
  expect(chooseLine(s,line.key)).toBe(true);
  expect(s.favours.requests.visit.status).toBe("accepted");
  expect(s.ecs.relationships[n].known[p].goodwill).toBeGreaterThanOrEqual(before);
});
it.each([false,true])("a disliked mood gets a spoken objection whichever speaker matches it (player matches=%s)",playerMatches=>{
  const {state:s,player:p,person:n}=chat();const c=s.chat.active;
  const line=lineCandidates(s,c,"mood_talk","player").find(l=>l.situation=="cheerful");
  if(playerMatches)c.row=[{kind:"mood",key:"cheerful"}];
  c.focus="mood";
  const before=s.ecs.relationships[n].known[p].goodwill;
  expect(chooseLine(s,line.key)).toBe(true);
  const spoken=c.transcript.at(-1);
  expect(spoken.speaker).toBe("npc");
  if(s.ecs.relationships[n].known[p].goodwill<before)expect(spoken.displeasure).toContain("mood:cheerful");
  else expect(c.lastPops.every(p=>p.amount>=0)).toBe(true);
});
it("an ordinary disliked topic still costs regard and the listener says why",()=>{
  const {state:s,player:p,person:n}=chat(),c=s.chat.active;
  const icon={kind:"topic",key:"help"};c.row=[icon];
  const before=s.ecs.relationships[n].known[p].goodwill;
  speakLine(s,{id:"help",key:"help",useKey:"help",speaker:"player",text:"Can we talk about helping?",icons:[icon],tags:{},effects:[]});
  expect(s.ecs.relationships[n].known[p].goodwill).toBeLessThan(before);
  expect(c.transcript.at(-1)).toMatchObject({speaker:"npc",family:"taste_reaction"});
  expect(c.transcript.at(-1).displeasure).toContain("topic:help");
});
it("records the mother as dead and includes recognised maternal relatives and their family branches without royal history",()=>{
  const w=peopleWorld(),s=w.state,p=w.player;s.map={seed:13};s.villages.village.houses=[w.tiles[3]];s.villages.village.id="village";
  s.ecs.container={[w.tiles[3]]:{capacity:100,amounts:{}}};s.ecs.household[w.tiles[3]]={storeId:w.tiles[3]};
  seedMotherFamily(s,p,13);const b=s.backstories[p];
  const uncle=b.relatives.find(r=>r.term=="uncle"||r.term=="aunt");expect(uncle).toBeDefined();
  const [cousin]=newEntities(s,[{personable:{age:18},kinship:{parents:[uncle.id],children:[]}}]);
  s.ecs.kinship[uncle.id].children.push(cousin);
  recogniseMaternalKin(s,p,uncle.id);
  const tree=knownFamilyTree(s,p,p);
  expect(tree.nodes[uncle.id]).toBeDefined();
  expect(tree.nodes[uncle.id].children).toHaveLength(1);
  expect(tree.nodes[tree.nodes[uncle.id].children[0]].unknown).toBe(true);
  for(const hidden of [b.fatherId,b.queenId,b.halfBrotherId])expect(tree.nodes[hidden]).toBeUndefined();
  expect(personComponent(s,"personable",b.motherId).dead).toBe(true);
});
it.each([7,22,23])("permits peace at %s:00 for awake free people and keeps the real meeting beyond 9pm",hour=>{
  const w=peopleWorld(),s=w.state,a=w.person,b=w.parent,p=w.player;
  s.days=6+hour/24;s.social={courtships:{},avoidance:{},contacts:{}};
  for(const id of [a,b]) {
    s.ecs.kinship[id]={parents:[],children:[]};s.ecs.personable[id].age=28;
    s.ecs.relationships[id].known[p]={ring:"personal",goodwill:40};
    s.ecs.planner[id].world.feeling={};s.ecs.planner[id].task=[hour==22?"festival_wait":"wait_for",1/24];s.ecs.planner[id].plan=[];
    if(hour==22){s.ecs.planner[id].world.festivalPlace={...s.ecs.spatial[id]};s.ecs.personable[id].tiredness=1.1;}
  }
  const e=recordEvent(s,"quarrel",[a,b],[],{day:s.days-1/24});learnEvent(s,p,e);
  completeConversation(s,p,a);completeConversation(s,p,b);
  expect(peaceUnavailable(s,p,a,b)).toBeNull();
  expect(makePeace(s,p,a,b)).toBeNull();
  const [plan]=require("game/htn").solve(s.ecs.planner[a].world,[],[["person"]]);
  expect(plan.some(task=>task[0]=="socialise")).toBe(true);
  expect(plan.some(task=>task[0]=="festival_wait")).toBe(false);
  expect(s.ecs.planner[a].world.social.expires).toBeUndefined();
  socialHour(s);expect(s.ecs.planner[a].world.social.stage).toBe("outbound");
});

it("keeps a failed visit recovery available after dark with low energy",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};s.days=22/24;
  s.ecs.personable[p].energy=10;
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  s.ui.talkResult={personId:n,recovery:"move_closer"};
  const hint=require("game/guidance").openingGuidance(s);
  expect(hint).toMatchObject({job:"move_to_here",targetId:expect.any(String)});
  enqueueTask(s,{key:hint.job},hint.targetId);
  expect(s.ecs.manager[p].jobs[0].job.key).toBe("move_to_here");
});

it("a neutral pair clears the row and reveals a neutral taste without losing regard",()=>{
  const {state:s,player:p,person:n}=chat(),c=s.chat.active;
  s.ecs.personality[n].traits=[];
  const icon={kind:"topic",key:"work"};c.row=[icon];
  const before=s.ecs.relationships[n].known[p].goodwill;
  speakLine(s,{id:"neutral",key:"neutral",useKey:"neutral",speaker:"player",text:"Work",icons:[icon],tags:{},effects:[]});
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before);
  expect(s.knowledge[p].people[n].topicTastes.work).toBe(0);
  expect(c.row).toEqual([]);
});

it("welcoming a cheerful line preserves or raises regard",()=>{
  const {state:s,player:p,person:n}=chat(),c=s.chat.active;
  s.ecs.personality[n].traits=["cheerful"];c.focus="mood";
  const line=lineCandidates(s,c,"mood_talk","player").find(l=>l.situation=="cheerful");
  const before=s.ecs.relationships[n].known[p].goodwill;
  expect(chooseLine(s,line.key)).toBe(true);
  expect(s.ecs.relationships[n].known[p].goodwill).toBeGreaterThanOrEqual(before);
  expect(c.transcript.at(-1).displeasure).toBeUndefined();
});
