/* global jest, require, expect, it */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { peopleWorld } from "./support/people";
import { GameState } from "../src/components/contexts";
import { ChatPanel, TopicTastes } from "../src/components/chat_panel";
import { openChat, lineCandidates, speakLine, chooseLine, chatChoices, iconKey, iconScore, moodScore, closeChat } from "game/chat";
import { recordEvent, eventSentence } from "game/events";
import { askAbout, canDiscloseEvent } from "game/people";
import { serialiseGame, restoreGame } from "game/save_game";
import TYPES from "data/event_types.json";
import LINES from "data/conversation_lines.json";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n?.nickname || "?" }));
const html=(s,component)=>(renderToStaticMarkup(<GameState.Provider value={s}>{component}</GameState.Provider>));
function setup() {
  const w=peopleWorld(),{state:s,player:p,person:n}=w;
  s.ui.actions={close_chat:()=>closeChat(s)};
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  s.ecs.relationships[n].known[p]={ring:"intimate",goodwill:70,base:70};
  s.ecs.relationships[p].known[n]={ring:"intimate",goodwill:70,base:70};
  s.knowledge={[p]:{people:{[n]:{traits:[]}},feelings:{}},[n]:{people:{},feelings:{},events:[]}};
  expect(openChat(s,p,n)).toBe(true);
  s.chat.active.row=[];s.chat.active.phase="player_turn";delete s.chat.active.expectation;
  return w;
}
it.each([["gloomy",1],["proud",-1],["cheerful",-1]])("learns a separate mood taste when a %s listener hears commiseration",(trait,sign)=>{
  const {state:s,player:p,person:n}=setup();s.ecs.personality[n].traits=[trait];
  expect(html(s,<TopicTastes personId={n}/>)).toContain("Mood tastes");
  expect(html(s,<TopicTastes personId={n}/>)).toContain("Guarded");
  expect(s.knowledge[p].people[n].moodTastes).toBeUndefined();
  s.chat.active.expectation="family";
  const evade=chatChoices(s).find(l=>l.evasive);expect(evade).toBeDefined();
  const before=s.ecs.relationships[n].known[p].goodwill;
  expect(speakLine(s,evade)).toBe(true);
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before-1);
  expect(s.chat.active.row).toEqual([{kind:"mood",key:"guarded"}]);
  const answer=lineCandidates(s,s.chat.active,"mood_reply","player").find(l=>l.situation=="guarded");
  expect(speakLine(s,answer)).toBe(true);
  expect(s.chat.active.row).toEqual([]);
  const pop=s.chat.active.lastPops.at(-1);expect(Math.sign(pop.amount)).toBe(sign);
  expect(s.knowledge[p].people[n].moodTastes).toEqual({guarded:pop.score});
  expect(s.knowledge[p].people[n].topicTastes).toBeUndefined();
  expect(iconKey({kind:"mood",key:"guarded"})).not.toBe(iconKey({kind:"topic",key:"guarded"}));
  expect(html(s,<ChatPanel/>)).toContain(sign>0?"class=\"positive\"":"class=\"negative\"");
  const restored=restoreGame(serialiseGame(s));
  expect(moodScore(restored,n,"guarded")).toBe(moodScore(s,n,"guarded"));
  expect(moodScore(s,n,"grumbling")*sign).toBeGreaterThan(0);
});
it("lets an NPC evade without requiring a player response or adding a grievance",()=>{
  const {state:s,player:p,person:n}=setup();
  s.ecs.relationships[n].known[p]={ring:"public",goodwill:0};s.chat.active.phase="reply";
  const evade=lineCandidates(s,s.chat.active,"family_answer","npc").find(l=>l.evasive);
  expect(evade).toBeDefined();const before=s.ecs.relationships[p].known[n].goodwill;
  expect(speakLine(s,evade)).toBe(true);
  expect(s.ecs.relationships[p].known[n].goodwill).toBe(before-1);
  expect(s.chat.active.row).toContainEqual({kind:"mood",key:"guarded"});
  expect(s.chat.active.row.some(i=>i.kind=="grievance")).toBe(false);
  s.chat.active.phase="player_turn";
  expect(chatChoices(s).some(l=>l.family=="mood_reply")).toBe(true);
  expect(iconScore(s,{kind:"mood",key:"joking"},p,n)).toBeDefined();
});
it.each(["inheritance","building_built","household_arrival","village_oath","commons_cut","commons_warning","commons_report","defiance"])("offers real %s accounts and Tell cards with the catalogue topic and every participant",type=>{
  const {state:s,player:p,person:n,parent,sibling}=setup();
  const event=recordEvent(s,type,[parent,sibling],[],{audienceIds:[p,n],kind:"house",timber:8,loss:3,reason:"woodland"});
  const tell=lineCandidates(s,s.chat.active,"gossip_tell","player").find(l=>l.b.event?.id==event.id);
  expect(tell).toBeDefined();expect(tell.icons).toEqual([{kind:"topic",key:TYPES[type].topic},...event.people.map(personId=>({kind:"person",personId}))]);
  expect(tell.text).not.toContain("undefined");expect(eventSentence(s,event,id=>id)).not.toContain(type);
  s.knowledge[p].events=[];s.chat.active.phase="reply";
  const account=lineCandidates(s,s.chat.active,"event_news","npc").find(l=>l.b.event?.id==event.id);
  expect(account).toBeDefined();expect(speakLine(s,account)).toBe(true);
  expect(s.knowledge[p].spokenSources[event.id]).toMatchObject({speakerId:n,lineId:account.id});
});
it("retells an earlier spoken account, preserves its source, and replies truthfully to known news",()=>{
  const {state:s,player:p,person:n,parent,sibling}=setup();
  const event=recordEvent(s,"marriage",[parent,sibling],[],{audienceIds:[n]});
  s.chat.active.phase="reply";
  const account=lineCandidates(s,s.chat.active,"event_news","npc").find(l=>l.b.event?.id==event.id);
  expect(speakLine(s,account)).toBe(true);const original={...s.knowledge[p].spokenSources[event.id]};
  closeChat(s);s.ecs.relationships[parent].known[p]={ring:"public",goodwill:0};
  expect(openChat(s,p,parent)).toBe(true);s.chat.active.row=[];s.chat.active.phase="player_turn";delete s.chat.active.expectation;s.chat.active.focus="tell";
  const tell=chatChoices(s).find(l=>l.b.event?.id==event.id);expect(tell).toBeDefined();
  expect(chooseLine(s,tell.key)).toBe(true);
  expect(s.knowledge[parent].events).toContain(event.id);
  expect(s.knowledge[parent].spokenSources[event.id].speakerId).toBe(p);
  expect(s.knowledge[p].spokenSources[event.id]).toEqual(original);
  closeChat(s);s.chat.pairs[p+":"+n].resting=0;
  expect(openChat(s,p,n)).toBe(true);s.chat.active.row=[];s.chat.active.phase="player_turn";delete s.chat.active.expectation;s.chat.active.focus="tell";
  expect(chooseLine(s,chatChoices(s).find(l=>l.b.event?.id==event.id).key)).toBe(true);
  expect(s.chat.active.transcript.some(l=>l.situation=="known"&&l.family=="gossip_reaction")).toBe(true);
  expect(s.knowledge[n].events.filter(id=>id==event.id)).toHaveLength(1);
});
it("uses the same marital-quarrel audience rule in Tell, NPC news and legacy Ask about",()=>{
  const {state:s,player:p,person:n,parent,sibling}=setup();
  s.ecs.kinship[parent].spouse=sibling;s.ecs.kinship[sibling].spouse=parent;
  const e=recordEvent(s,"quarrel",[parent,sibling],[],{audienceIds:[p,n]});
  expect(canDiscloseEvent(s,p,n,e)).toBe(false); // listener is a subject's child
  expect(lineCandidates(s,s.chat.active,"gossip_tell","player").some(l=>l.b.event?.id==e.id)).toBe(false);
  s.knowledge[n].events=[];s.chat.active.phase="reply";
  // Reverse roles: NPC knows it; player is now the subject's child.
  s.knowledge[n].events=[e.id];s.knowledge[p].events=[];s.ecs.kinship[p].parents=[parent];
  expect(lineCandidates(s,s.chat.active,"event_news","npc").some(l=>l.b.event?.id==e.id)).toBe(false);
  expect(askAbout(s,p,n,parent).ok).toBe(true);expect(s.knowledge[p].events).not.toContain(e.id);
  s.ecs.kinship[p].parents=[];
  s.ecs.relationships[p].known[parent]={ring:"personal",goodwill:36};
  expect(canDiscloseEvent(s,n,p,e)).toBe(false); // listener is a subject's close friend
  s.ecs.relationships[p].known[parent]={ring:"public",goodwill:-4};
  expect(canDiscloseEvent(s,n,p,e)).toBe(true); // trusted rival can hear it
  s.ecs.relationships[n].known[p].ring="social";
  expect(canDiscloseEvent(s,n,p,e)).toBe(false);
});
it("declares wording, topic, roles and an audience for every catalogue event and generates both chat directions",()=>{
  for(const [type,definition] of Object.entries(TYPES)) {
    expect(definition).toMatchObject({sentence:expect.any(String),topic:expect.any(String),roles:expect.any(Array),disclosure:{ring:expect.stringMatching(/^(public|social|personal|intimate)$/)}});
    for(const family of ["event_news","gossip_tell"])expect(LINES.some(l=>l.family==family&&l.situation=="catalogue_"+type)).toBe(true);
  }
  const {state:s,player:p,person:n,parent,sibling}=setup();s.ecs.relationships[p].known[n].ring="public";
  expect(canDiscloseEvent(s,p,n,{type:"marriage",people:[parent,sibling]})).toBe(true);
  expect(canDiscloseEvent(s,p,n,{type:"unrecognised",people:[]})).toBe(false);
  expect(canDiscloseEvent(s,p,n,{type:"marriage",people:[],sealed:true})).toBe(false);
});
it("lets legacy acquaintances hear a public wedding without disclosing a family tree",()=>{
  const {state:s,player:p,person:n,parent,sibling}=setup();
  const event=recordEvent(s,"marriage",[parent,sibling],[],{audienceIds:[n]});
  s.ecs.relationships[n].known[p]={ring:"public",goodwill:0};
  expect(askAbout(s,p,n,parent).ok).toBe(true);
  expect(s.knowledge[p].events).toContain(event.id);
  expect(s.knowledge[p].spokenSources[event.id].speakerId).toBe(n);
  expect(s.knowledge[p].kinLinks).toBeUndefined();
});
it("makes every permitted older Tell card reachable, with no invented or unheard cards",()=>{
  const {state:s,player:p,person:n,parent,sibling}=setup();
  const ids=Array.from({length:7},(_,i)=>recordEvent(s,"marriage",[parent,sibling],[],{day:s.days-i,audienceIds:[p]}).id);
  recordEvent(s,"marriage",[parent,sibling],[],{audienceIds:[n]});
  s.chat.active.focus="tell";
  expect(chatChoices(s).filter(l=>l.family=="gossip_tell").map(l=>l.b.event.id)).toEqual(ids);
});
it("can tell two distinct events of one type in a chat without repeating a spoken ID",()=>{
  const {state:s,player:p,parent,sibling}=setup();
  const events=[0,1].map(i=>recordEvent(s,"harvest",[parent],[],{audienceIds:[p],quantity:i+3}));
  const first=lineCandidates(s,s.chat.active,"gossip_tell","player").find(l=>l.b.event.id==events[0].id);
  expect(speakLine(s,first)).toBe(true);
  const second=lineCandidates(s,s.chat.active,"gossip_tell","player").find(l=>l.b.event.id==events[1].id);
  expect(second).toBeDefined();expect(second.id).not.toBe(first.id);
  expect(speakLine(s,second)).toBe(true);
  expect(lineCandidates(s,s.chat.active,"gossip_tell","player").filter(l=>events.some(e=>e.id==l.b.event.id))).toEqual([]);
  expect(s.knowledge[p].people[sibling]).toBeUndefined();
});
it("carries mood evidence and spoken sources across a real journey and back",async()=>{
  const {community,attach}=require("./support/travel");
  const {completeTravel}=require("game/travel");
  const {s,ids}=community(),[player,npc]=ids;
  attach(s,community({namespace:"away-",key:"6,5",player:false}).s);
  s.knowledge ||= {};
  s.knowledge[player]={people:{[npc]:{traits:[],moodTastes:{guarded:1}}},feelings:{},spokenSources:{"known-story":{speakerId:npc,day:s.days,lineId:"spoken-story"}}};
  const score=moodScore(s,player,"guarded"),memory=JSON.parse(JSON.stringify(s.knowledge[player]));
  await completeTravel(s,{destination:"6,5",side:0});
  expect(s.knowledge[player]).toMatchObject(memory);
  expect(moodScore(s,player,"guarded")).toBe(score);
  await completeTravel(s,{destination:"5,5",side:3});
  expect(s.knowledge[player]).toMatchObject(memory);
  expect(moodScore(s,player,"guarded")).toBe(score);
});
it("does not turn an anonymous witnessed story into named gossip when retold",()=>{
  const {state:s,player:p,person:n,parent}=setup();
  const [stranger]=require("game/entities").newEntities(s,[{personable:{age:30},nameable:{nickname:"Unknown Harvester"},spatial:{...s.ecs.spatial[p]}}]);
  const event=recordEvent(s,"harvest",[stranger],[],{quantity:6,villageId:"village",audienceIds:[p]});
  const tell=lineCandidates(s,s.chat.active,"gossip_tell","player").find(l=>l.b.event.id==event.id);
  expect(speakLine(s,tell)).toBe(true);expect(s.knowledge[n].people[stranger]).toBeUndefined();
  closeChat(s);s.ecs.relationships[n].known[parent]={ring:"intimate",goodwill:70};
  expect(openChat(s,parent,n)).toBe(true);s.chat.active.row=[];s.chat.active.phase="reply";
  const account=lineCandidates(s,s.chat.active,"event_news","npc").find(l=>l.b.event?.id==event.id);
  expect(account).toBeDefined();expect(account.text).not.toContain("Unknown Harvester");
  expect(speakLine(s,account)).toBe(true);
  expect(s.knowledge[parent].events).toContain(event.id);
  expect(s.knowledge[parent].people[stranger]).toBeUndefined();
});
it("keeps a real story available on a later visit and truthfully calls it known news",()=>{
  const {state:s,player:p,person:n,parent}=setup();
  const event=recordEvent(s,"harvest",[parent],[],{quantity:6,audienceIds:[p]});
  s.chat.active.focus="tell";
  expect(chooseLine(s,chatChoices(s).find(l=>l.b.event?.id==event.id).key)).toBe(true);
  closeChat(s);s.chat.pairs[p+":"+n].resting=0;
  expect(openChat(s,p,n)).toBe(true);s.chat.active.row=[];s.chat.active.phase="player_turn";delete s.chat.active.expectation;s.chat.active.focus="tell";
  const card=chatChoices(s).find(l=>l.b.event?.id==event.id);expect(card).toBeDefined();
  expect(chooseLine(s,card.key)).toBe(true);
  expect(s.chat.active.transcript.some(l=>l.family=="gossip_reaction"&&l.situation=="known")).toBe(true);
  expect(s.knowledge[n].events.filter(id=>id==event.id)).toHaveLength(1);
});
