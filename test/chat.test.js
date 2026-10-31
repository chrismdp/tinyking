import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { peopleWorld } from "./support/people";
import { GameState } from "../src/components/contexts";
import { ChatPanel } from "../src/components/chat_panel";
import { talk, get_attention } from "game/tasks";
import { openChat, chooseLine, closeChat, chatChoices, speakLine, patience, recoverSlots, topicScore } from "game/chat";
import { serialiseGame, restoreGame } from "game/save_game";
import { recordEvent } from "game/events";
import { updateFavours, visibleFavours, acceptFavour } from "game/favours";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n?.nickname || "?", firstName: n => n?.nickname?.split(" ")[0] || "?", familyName: n => n?.nickname?.split(" ")[1] || "?" }));
const markup = s => renderToStaticMarkup(<GameState.Provider value={s}><ChatPanel/></GameState.Provider>);
function contact() {
  const w = peopleWorld();
  w.state.ui.actions={close_chat:()=>closeChat(w.state)};
  w.state.ecs.spatial[w.player] = { ...w.state.ecs.spatial[w.person], x: w.state.ecs.spatial[w.person].x - 45 };
  return w;
}
it("opens the paused chat at real speech reach through the planner, offers lines and restores speed", () => {
  const { state:s, player:p, person:n } = contact();
  get_attention(s,p,s.ecs.planner[p].world,0,true,n);
  talk(s,p,s.ecs.planner[p].world,0,true,n,"chat");
  expect(s.game_speed).toBe("paused");
  expect(s.chat.active.npcId).toBe(n);
  expect(chatChoices(s).length).toBeGreaterThanOrEqual(3);
  expect(markup(s)).toContain("World paused");
  expect(markup(s)).toContain("End chat");
  expect(s.knowledge[p].people[n].conversation).toBeUndefined();
  chooseLine(s,chatChoices(s)[0].key);
  expect(s.knowledge[p].people[n].conversation).toBeDefined();
  closeChat(s); expect(s.game_speed).toBe("fast");
});
it("rejects remote entry and never introduces an unreachable stranger", () => {
  const {state:s, player:p,person:n}=peopleWorld();
  s.ecs.spatial[p].x=-1000;
  expect(openChat(s,p,n)).toBe(false);
  expect(s.knowledge?.[p]?.people?.[n]).toBeUndefined();
});
it("pops against the hearer, reveals only the tested taste and fades after three subsequent lines", () => {
  const {state:s,player:p,person:n}=contact(); openChat(s,p,n);
  s.chat.active.row=[];
  s.ecs.personality[n].traits=["hard-working"];
  const line=(id,speaker,icons)=>({id,key:id,useKey:id,speaker,text:id,icons,effects:[],tags:{add:[],remove:[]},disclosure:{}});
  const work={kind:"topic",key:"work"};
  speakLine(s,line("a","npc",[work]));
  const before=s.ecs.relationships[n].known[p].goodwill;
  speakLine(s,line("b","player",[work]));
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before+1);
  expect(s.knowledge[p].people[n].topicTastes).toEqual({work:1});
  expect(s.chat.active.row).toHaveLength(0);
  speakLine(s,line("c","npc",[work]));
  for(let i=0;i<3;i++)speakLine(s,line("empty"+i,"player",[]));
  expect(s.chat.active.lastFades[0]).toMatchObject({life:0});
  expect(s.chat.active.row).toEqual([]);
  expect(s.chat.active.endReason).toBe("all_faded");
});
it("spends remaining cells on close, recovers with elapsed hours, and restores all chat records", () => {
  const {state:s,player:p,person:n}=contact(); openChat(s,p,n);
  chooseLine(s,chatChoices(s)[0].key); closeChat(s);
  const spent=patience(s,p,n).resting;
  expect(spent).toBeGreaterThan(0);
  recoverSlots(s,3); expect(patience(s,p,n).resting).toBe(spent);
  recoverSlots(s,3); expect(patience(s,p,n).resting).toBe(spent-1);
  const restored=restoreGame(serialiseGame(s));
  expect(restored.chat).toEqual(s.chat);
  expect(restored.knowledge).toEqual(s.knowledge);
  expect(topicScore(s,n,"work")).toBe(0);
});
it("requires acquaintance and spoken favour disclosure before accepting real work", () => {
  const {state:s,player:p,person:n,tiles}=contact();
  const house=tiles[3]; s.ecs.container ||= {}; s.ecs.container[house]={amounts:{},capacity:20};
  s.ecs.household[house]={storeId:house,fields:[]};
  updateFavours(s);
  const r=Object.values(s.favours.requests)[0]; expect(r).toBeDefined();
  expect(visibleFavours(s)).toEqual([]); expect(acceptFavour(s,r.id,n)).toBeNull();
  openChat(s,p,n); chooseLine(s,chatChoices(s).find(l=>l.family=="introduction").key);
  expect(chatChoices(s).some(l=>l.family=="favour_accept")).toBe(true);
  chooseLine(s,chatChoices(s).find(l=>l.family=="favour_accept").key);
  expect(r.status).toBe("accepted"); expect(r.deliveryAuthorised).toBe(true);
  expect(s.ecs.manager[p].jobs.some(j=>j.favourId==r.id)).toBe(true);
});
it("does not passively reveal visits and allows a real notable visitor as an opener", () => {
  const {state:s,player:p,person:n,parent}=contact();
  s.ecs.profession ||= {}; s.ecs.profession[parent]={trade:"baker"};
  const e=recordEvent(s,"visit",[parent,n],[],{toVillage:"village"});
  expect(s.knowledge?.[p]?.events || []).not.toContain(e.id);
  s.knowledge ||= {}; (s.knowledge[n] ||= {people:{},feelings:{},events:[]}).events ||= [];
  if(!s.knowledge[n].events.includes(e.id))s.knowledge[n].events.push(e.id);
  s.knowledge[p]={people:{[n]:{traits:[],conversation:{day:s.days}}},feelings:{}};
  s.ecs.relationships[n].known[p]={ring:"social",goodwill:16,base:16};
  openChat(s,p,n);
  expect(s.chat.active.transcript[0].family).toBe("visit_news");
  expect(s.knowledge[p].events).toContain(e.id);
  expect(s.knowledge[p].spokenSources[e.id].speakerId).toBe(n);
});
it("keeps the entire world still while reading, even if speed is changed", () => {
  const w=contact(),s=w.state;openChat(s,w.player,w.person);
  const before=serialiseGame(s); w.step(2);
  expect(serialiseGame(s)).toBe(before);
});
it("ends a full row without partial insertion and preserves spent slots on reopening", () => {
  const {state:s,player:p,person:n}=contact();openChat(s,p,n);s.chat.active.row=[];
  const line={id:"full",key:"full",useKey:"full",speaker:"player",text:"full",icons:["work","family","season","food"].map(key=>({kind:"topic",key})),effects:[],tags:{},disclosure:{}};
  expect(speakLine(s,line)).toBe(true);
  expect(s.chat.active.endReason).toBe("row_full");expect(s.chat.active.row).toHaveLength(4);
  closeChat(s);expect(patience(s,p,n).free).toBe(0);expect(openChat(s,p,n)).toBe(false);
});
it("keeps unrelated tastes hidden, charges neutral pops and scores the player's hearing in their direction", () => {
  const {state:s,player:p,person:n}=contact();openChat(s,p,n);s.chat.active.row=[];
  const line=(id,speaker,topic)=>({id,key:id,useKey:id,speaker,text:id,icons:[{kind:"topic",key:topic}],effects:[],tags:{},disclosure:{}});
  const before=s.ecs.relationships[n].known[p].goodwill;
  speakLine(s,line("one","npc","food"));speakLine(s,line("two","player","food"));
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before-.25);
  expect(s.knowledge[p].people[n].topicTastes).toEqual({food:0});
  s.ecs.personality[p].traits=["cheerful"];
  speakLine(s,line("three","player","food"));const own=s.ecs.relationships[p].known[n].goodwill;
  speakLine(s,line("four","npc","food"));expect(s.ecs.relationships[p].known[n].goodwill).toBe(own+1);
});
it("never repeats an ID within a chat and avoids the last greeting for that situation next visit", () => {
  const {state:s,player:p,person:n}=contact();
  const greetings=[];
  for(let i=0;i<3;i++) {openChat(s,p,n);greetings.push(s.chat.active.transcript[0].id);closeChat(s);recoverSlots(s,24);}
  expect(greetings[1]).not.toBe(greetings[2]);
  for(const visit of s.chat.history)expect(new Set(visit.lines.map(l=>l.id)).size).toBe(visit.lines.length);
});
it("reveals one spoken family link without filling a trusted person's whole tree", () => {
  const {state:s,player:p,person:n,parent}=contact();
  s.ecs.relationships[n].known[p]={ring:"social",goodwill:16,base:16};
  openChat(s,p,n);s.chat.active.focus="family";
  const question=chatChoices(s).find(l=>l.family=="family_question");expect(question).toBeDefined();
  chooseLine(s,question.key);
  const learned=Object.values(s.knowledge[p].kinLinks||{});expect(learned).toHaveLength(1);
  expect(s.chat.active.transcript.some(l=>l.family=="family_answer")).toBe(true);
  expect(s.knowledge[p].people[parent]?.conversation).toBeUndefined();
});
it("retells a real quarrel through learnEvent and applies its family reaction once", () => {
  const {state:s,player:p,person:n,parent,sibling}=contact();
  const outsider=p;
  s.ecs.relationships[n].known[p]={ring:"personal",goodwill:36,base:36};
  s.ecs.relationships[p].known[n]={ring:"personal",goodwill:36,base:36};
  const event=recordEvent(s,"quarrel",[outsider,parent]);
  // Source knowledge is an explicit witnessed event; the NPC has not heard it.
  s.knowledge[n].events=s.knowledge[n].events.filter(id=>id!=event.id);
  s.knowledge[p].people ||= {};s.knowledge[p].people[parent]={traits:[]};
  openChat(s,p,n);s.chat.active.focus="news";s.chat.active.subjectId=parent;
  const line=chatChoices(s).find(l=>l.family=="gossip_tell");
  expect(line).toBeDefined();const before=s.ecs.relationships[n].known[outsider].goodwill;
  chooseLine(s,line.key);
  expect(s.knowledge[n].events).toContain(event.id);
  expect(s.ecs.relationships[n].known[outsider].goodwill).toBeLessThanOrEqual(before-3);
  expect(s.chat.active.transcript.some(l=>l.family=="gossip_reaction")).toBe(true);
  expect(chooseLine(s,line.key)).toBe(false);
  expect(s.knowledge[n].events.filter(id=>id==event.id)).toHaveLength(1);
  expect(s.knowledge[p].people[sibling]).toBeUndefined();
});
it("bases common-woodland talk on real tree permissions rather than a tree sharing a ground tile ID", () => {
  const {state:s,player:p,person:n,tiles}=contact();
  s.villages.village={id:"village",name:"Withyford",houses:[tiles[3]],sharedPlaces:[]};
  s.ecs.household[tiles[3]]={fields:[]};
  const [tree]=require("game/entities").newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},tree:{},good:{type:"wood",amount:1}}]);
  expect(require("game/village_customs").resourcePermission(s,p,tree).kind).toBe("common");
  const c={actorId:p,npcId:n,tags:[]};
  expect(require("game/chat_facts").predicate(s,c,{village:{id:"village"}},{test:"village_has_common_woodland",args:{village:"village"}})).toBe(true);
});
