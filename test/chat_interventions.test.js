import { peopleWorld } from "./support/people";
import { openChat, chatChoices, lineCandidates, speakLine, chooseLine, closeChat } from "game/chat";
import { completeConversation } from "game/people";
import { recordEvent, learnEvent } from "game/events";
import { updateSocialInterventions } from "game/social_interventions";
import { chatTogether } from "game/social";
import { HOUR } from "game/time";
import { serialiseGame, restoreGame } from "game/save_game";

jest.mock("game/name", () => ({ name: n => n?.nickname || "?", firstName: n => n?.nickname?.split(" ")[0] || "?", familyName: n => n?.nickname?.split(" ")[1] || "?" }));
function pairChat(peace=false) {
  const w=peopleWorld(),s=w.state;
  s.social={avoidance:{},courtships:{},contacts:{}};
  s.weather={"0,0":{type:"clear"}};
  s.ecs.spatial[w.player]={...s.ecs.spatial[w.person],x:s.ecs.spatial[w.person].x-45};
  for(const id of [w.person,w.parent]) {
    s.ecs.personable[id].age=28;
    s.ecs.kinship[id]={parents:[],children:[]};
    s.ecs.personality[id].orientation="both";
    s.ecs.relationships[id].known[w.player]={ring:"personal",goodwill:40};
    s.ecs.relationships[w.player].known[id]={ring:"social",goodwill:20};
    s.ecs.planner[id].task=["wait_for",HOUR];s.ecs.planner[id].plan=[];
  }
  if(peace) {
    w.quarrel=recordEvent(s,"quarrel",[w.person,w.parent]);learnEvent(s,w.player,w.quarrel);
    s.days+=HOUR;
    completeConversation(s,w.player,w.person);completeConversation(s,w.player,w.parent);
  }
  openChat(s,w.player,w.person);s.chat.active.row=[];
  return w;
}
const candidates=(s,f)=>lineCandidates(s,s.chat.active,f,"player");
it.each(["make_peace","introduce"])("offers %s under Family and queues a real pair meeting, then releases chat", family=>{
  const w=pairChat(family=="make_peace"),s=w.state;
  s.chat.active.focus="family";
  const line=chatChoices(s).find(l=>l.family==family);
  expect(line?.b.other.id).toBe(w.parent);
  expect(chooseLine(s,line.key)).toBe(true);
  expect(s.chat.active).toBeUndefined();
  expect(s.ecs.planner[w.person].world.capturedBy).toBeFalsy();
  updateSocialInterventions(s);
  expect(s.ecs.planner[w.person].world.social).toMatchObject({partnerId:w.parent,stage:"outbound"});
  expect(s.ecs.planner[w.parent].world.social.partnerId).toBe(w.person);
  expect((s.events||[]).filter(e=>e.type=="reconciliation")).toHaveLength(0);
  expect(s.social.courtships).toEqual({});
  if(family=="make_peace") {chatTogether(s,w.person,w.parent);expect(s.events.some(e=>e.type=="reconciliation")).toBe(true);}
});
it.each(["unheard","one_side","trust"])("hides peace when %s", missing=>{
  const w=pairChat(true),s=w.state;
  if(missing=="unheard")s.knowledge[w.player].events=[];
  if(missing=="one_side")delete s.social.contacts[[w.player,w.parent].sort().join(":")];
  if(missing=="trust")s.ecs.relationships[w.parent].known[w.player].ring="social";
  expect(candidates(s,"make_peace")).toHaveLength(0);
});
it.each(["unknown","kin","married","unwilling","unreachable"])("hides an introduction when %s", missing=>{
  const w=pairChat(),s=w.state;
  if(missing=="unknown")delete s.ecs.relationships[w.player].known[w.parent];
  if(missing=="kin")s.ecs.kinship[w.person].parents=[w.parent];
  if(missing=="married")s.ecs.kinship[w.parent].spouse=w.sibling;
  if(missing=="unwilling") {s.ecs.personality[w.person].orientation="opposite";s.ecs.personality[w.parent].orientation="opposite";}
  if(missing=="unreachable")s.ecs.spatial[w.parent]={x:99999,y:99999};
  expect(candidates(s,"introduce")).toHaveLength(0);
});
it.each(["hungry","tired","work","early"])("keeps an introduction available while %s passes and waits without interrupting it", passing=>{
  const w=pairChat(),s=w.state,p=s.ecs.planner[w.parent];
  if(passing=="hungry")p.world.feeling.hungry=true;
  if(passing=="tired")p.world.feeling.tired=true;
  if(passing=="work") {p.world.currentJob="harvest";p.task=["harvest"] ;}
  if(passing=="early")s.days=Math.floor(s.days)+7/24;
  const line=candidates(s,"introduce")[0];expect(line).toBeDefined();
  const task=p.task;speakLine(s,line);expect(s.chat.active).toBeUndefined();
  updateSocialInterventions(s);expect(p.world.social).toBeUndefined();expect(p.task).toBe(task);
  p.world.feeling={};delete p.world.currentJob;p.task=["wait_for",HOUR];s.days=Math.floor(s.days)+10/24;
  updateSocialInterventions(s);expect(p.world.social.partnerId).toBe(w.person);
});
it("refuses a stale spoken proposal in the NPC's voice and keeps the conversation open",()=>{
  const w=pairChat(),s=w.state;
  s.chat.active.focus="family";
  const line=chatChoices(s).find(l=>l.family=="introduce");
  s.ecs.kinship[w.parent].spouse=w.sibling;
  expect(chooseLine(s,line.key)).toBe(true);
  expect(s.chat.active.endReason).toBeUndefined();
  expect(s.chat.active.transcript.at(-1)).toMatchObject({speaker:"npc",family:"meeting_reply"});
  expect(s.chat.active.meetingResult.reason).toMatch(/single/);
  expect(s.social.meetings||[]).toHaveLength(0);
  closeChat(s);
});
it("saves a waiting invitation and rechecks consent before planning the meeting",()=>{
  const w=pairChat(),s=w.state;
  s.ecs.planner[w.parent].world.feeling.hungry=true;
  speakLine(s,candidates(s,"introduce")[0]);
  const restored=restoreGame(serialiseGame(s));
  expect(restored.social.meetings).toHaveLength(1);
  restored.ecs.planner[w.parent].world.feeling.hungry=false;
  restored.ecs.kinship[w.parent].spouse=w.sibling;
  updateSocialInterventions(restored);
  expect(restored.social.meetings).toHaveLength(0);
  expect(restored.ecs.planner[w.parent].world.social).toBeUndefined();
});
it("starts the invited visit through the live simulation after the chat closes",()=>{
  const w=pairChat(),s=w.state;
  speakLine(s,candidates(s,"introduce")[0]);
  w.step(1/60);
  expect(s.ecs.planner[w.person].world.social.partnerId).toBe(w.parent);
  expect(s.ecs.planner[w.parent].world.social.partnerId).toBe(w.person);
});
it("does not carry an unfulfilled meeting into another day",()=>{
  const w=pairChat(),s=w.state;
  s.ecs.planner[w.parent].world.feeling.hungry=true;
  speakLine(s,candidates(s,"introduce")[0]);s.days=Math.floor(s.days)+1+10/24;
  updateSocialInterventions(s);expect(s.social.meetings).toHaveLength(0);
  expect(s.ecs.planner[w.parent].world.social).toBeUndefined();
});
