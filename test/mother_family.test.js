/* global jest, it, expect, require */
jest.mock("../src/data/male_names.csv",()=>["William","John"]);
jest.mock("../src/data/female_names.csv",()=>["Agnes","Mary"]);
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18n } from "react-polyglot";
import messages from "../src/data/messages.json";
import { GameState } from "../src/components/contexts";
import { PersonPanel, FamilyTree } from "../src/components/person_panel";
import { TaskPanel } from "../src/components/task_panel";
import { EventFeed } from "../src/components/event_feed";
import { IntroOverlay } from "../src/components/intro_overlay";
import { ChatPanel } from "../src/components/chat_panel";
jest.mock("components/contexts",()=>require("../src/components/contexts"),{virtual:true});
import { peopleWorld } from "./support/people";
import { seedMotherFamily, familyGoal, familySearchFacts, recogniseMaternalKin } from "game/mother_family";
import { knownEvents, learnEvent, eventSentence } from "game/events";
import { knownFamilyTree, canDiscloseEvent } from "game/people";
import { displayName } from "game/knowledge";
import { biography } from "game/biography";
import { openChat, chatChoices, chooseLine, lineCandidates, closeChat } from "game/chat";
import { kinLinks } from "game/chat_facts";
import { serialiseGame, restoreGame } from "game/save_game";
import LINES from "data/conversation_lines.json";
import { newEntities } from "game/entities";

const setup=()=>{const f=peopleWorld(),s=f.state;s.map={seed:13};s.ecs.spatial[f.player]={...s.ecs.spatial[f.person]};s.villages.village.houses=[f.tiles[3]];s.villages.village.id="village";s.ecs.container={[f.tiles[3]]:{capacity:100,amounts:{}}};s.ecs.household[f.tiles[3]]={storeId:f.tiles[3]};seedMotherFamily(s,f.player,13);return f;};
it("uses two living established relatives even when their village has no spare bed",()=>{
  const {state:s,player,person,parent,sibling,tiles}=peopleWorld();
  s.map={seed:13};s.villages.village.id="village";s.villages.village.houses=[tiles[3]];
  s.ecs.household[player].houseId=tiles[0];
  s.ecs.kinship[sibling].parents=[];s.ecs.kinship[parent].children=[person];
  newEntities(s,Array.from({length:3},()=>({personable:{age:30},spatial:{...s.ecs.spatial[person]},controllable:{controllerId:parent},kinship:{parents:[],children:[],spouse:null},household:{houseId:tiles[3]},village:{villageId:"village"}})));
  seedMotherFamily(s,player,13);
  expect(s.backstories?.[player]?.relatives.map(r=>r.id)).toEqual(expect.arrayContaining([person,parent]));
  expect(s.backstories[player].relatives.length).toBeGreaterThanOrEqual(2);
});
it("stores named off-map royal history and reciprocal kin, giving only maternal names and kinship at arrival",()=>{
  const {state:s,player}=setup(),b=s.backstories[player];
  expect(b.relatives.length).toBeGreaterThanOrEqual(2);
  const record=id=>s.ecs.kinship[id]||s.peopleDirectory[id].kinship;
  expect(record(player).parents).toEqual([b.motherId,b.fatherId]);
  expect(record(b.fatherId).children).toEqual([player,b.halfBrotherId]);
  expect(record(b.motherId).children).toContain(player);
  expect(s.peopleDirectory[b.fatherId].personable.dead).toBe(true);
  expect(s.peopleDirectory[b.motherId].personable.dead).toBeFalsy();
  expect(s.ecs.spatial[b.motherId]).toBeUndefined();
  expect(s.peopleDirectory[b.halfBrotherId].personality.traits).toContain("cruel");
  expect(s.events.filter(e=>e.sealed).map(e=>e.type)).toEqual(["marriage","birth","separation","exile","marriage","birth","death"]);
  for(const r of b.relatives){expect(s.ecs.personable[r.id].dead).toBeFalsy();expect(s.ecs.household[r.id].houseId).toBeDefined();expect(s.ecs.planner[r.id]).toBeDefined();expect(s.knowledge[player].people[r.id]).toMatchObject({nameOnly:true});}
  expect(familyGoal(s).text).toContain("Find your mother");
  for(const r of b.relatives)expect(familyGoal(s).text).toContain(r.name);
});
it("never reveals sealed history through names, family trees, biography, news or any authored chat binding, even after kin trust and attempted learning",()=>{
  const {state:s,player,person}=setup(),b=s.backstories[player];
  s.ecs.relationships[person].known[player]={ring:"personal",goodwill:36};
  for(const e of s.events.filter(e=>e.sealed)){learnEvent(s,player,e);learnEvent(s,person,e);expect(canDiscloseEvent(s,person,player,e)).toBe(false);expect(eventSentence(s,e,id=>id)).toBe("");}
  // Even an erroneously granted event ID must not bypass the disclosure lock.
  s.knowledge[player].events=s.events.map(e=>e.id);
  const surfaces=[];
  for(const id of [player,person,b.motherId,...b.relatives.map(r=>r.id)]){
    surfaces.push(knownFamilyTree(s,player,id),biography(s,player,id),kinLinks(s,id));
  }
  expect(openChat(s,player,person)).toBe(true);
  for(const family of new Set(LINES.map(l=>l.family)))for(const phase of ["opening","player_turn","reply"]){s.chat.active.phase=phase;surfaces.push(lineCandidates(s,s.chat.active,family));}
  surfaces.push(knownEvents(s,player),displayName(s,b.fatherId),displayName(s,b.halfBrotherId));
  const text=JSON.stringify(surfaces);
  for(const id of [b.fatherId,b.halfBrotherId,b.queenId]){expect(text).not.toContain(id);expect(text).not.toContain(s.peopleDirectory[id].nameable.nickname);}
  expect(text).not.toMatch(/old king|current king|sent her away|royal marriage/i);
});
it("answers a named-relative search from actual acquaintance or a real mutual contact, otherwise admits ignorance",()=>{
  const {state:s,player,person,sibling,parent}=setup(),r=s.backstories[player].relatives.find(r=>r.id==sibling);
  s.ecs.relationships[person].known[sibling]={ring:"public",goodwill:0};
  expect(familySearchFacts(s,player,person).find(f=>f.id==r.id)).toMatchObject({answer:"known",village_name:"Withyford"});
  delete s.ecs.relationships[person].known[sibling];
  s.ecs.relationships[person].known[parent]={ring:"personal",goodwill:36};s.ecs.relationships[parent].known[sibling]={ring:"personal",goodwill:36};
  expect(familySearchFacts(s,player,person).find(f=>f.id==r.id)).toMatchObject({answer:"referral",contact_id:parent});
  delete s.ecs.relationships[person].known[parent];
  expect(familySearchFacts(s,player,person).find(f=>f.id==r.id).answer).toBe("unknown");
});
it("offers named searches in chat and recognises the player with a real first-meeting favour, reciprocal knowledge and Personal kin warmth only once",()=>{
  const {state:s,player,person}=setup();s.ecs.spatial[player]={...s.ecs.spatial[person]};
  expect(openChat(s,player,person)).toBe(true);
  let line=chatChoices(s).find(l=>l.family=="maternal_introduction");expect(line).toBeDefined();expect(chatChoices(s)[0].family).toBe("maternal_introduction");
  expect(chooseLine(s,line.key)).toBe(true);
  expect(s.chat.active.transcript.some(l=>l.family=="maternal_recognition"&&/nephew|niece|grandchild|grandson|granddaughter/.test(l.text))).toBe(true);
  expect(s.chat.active.transcript.some(l=>l.family=="favour_ask")).toBe(true);
  expect(s.ecs.relationships[person].known[player]).toMatchObject({ring:"personal",base:36});
  expect(s.knowledge[player].people[person].nameOnly).toBeUndefined();
  expect(s.knowledge[person].people[player].maternalKin).toBeDefined();
  expect(familyGoal(s).met).toContain(person);
  s.ecs.relationships[person].known[player].goodwill=20;recogniseMaternalKin(s,player,person);
  expect(s.ecs.relationships[person].known[player].goodwill).toBe(20);
  closeChat(s);
});
it("keeps history and goal progress through saves and leaves legacy saves without a backstory",()=>{
  const {state:s,player}=setup();recogniseMaternalKin(s,player,s.backstories[player].relatives[0].id);
  s.travel={people:s.peopleDirectory,maps:{}};Object.defineProperty(s,"peopleDirectory",{enumerable:false});
  const saved=restoreGame(serialiseGame(s));expect(saved.backstories).toEqual(s.backstories);expect(familyGoal(saved)).toEqual(familyGoal(s));
  const old=peopleWorld().state;expect(restoreGame(serialiseGame(old)).backstories).toBeUndefined();expect(familyGoal(old)).toBeNull();
});

it("keeps the named family goal in the first chat hint, followed by the existing shelter and sleep priorities",()=>{
  const {state:s,player,person,tiles}=setup();s.intro={active:false};s.ui.show={};s.ecs.playable[player].arrivedAt=0;
  s.ecs.playable[player].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  const {openingGuidance,OPENING_NARRATIVE}=require("game/guidance");
  expect(OPENING_NARRATIVE).toMatch(/Mother sent me here.*family.*work/);
  expect(openingGuidance(s).text).toContain(s.backstories[player].relatives[0].name);
  expect(familyGoal(s).text).toContain(s.peopleDirectory[s.backstories[player].motherId].nameable.nickname);
  expect(s.knowledge[player].familyWhereabouts).toBeUndefined();
  expect(displayName(s,person)).toBe("an unknown person");
  expect(Object.values(knownFamilyTree(s,player,person).nodes).every(n=>n.unknown)).toBe(true);
});
it("keeps reference-only off-map royals and the mother out of playable succession while retaining the local kin path",()=>{
  const {state:s,player}=setup(),{heirFor}=require("game/possessions"),b=s.backstories[player];
  const heir=heirFor(s,player);
  expect(heir).not.toBe(b.motherId);expect(heir).not.toBe(b.halfBrotherId);
  expect(b.relatives.map(r=>r.id)).toContain(heir);
});

it("renders the opening, goal, person sheets, family trees, chat and news without the royal secret",()=>{
  const {state:s,player,person}=setup(),b=s.backstories[player];s.ui.actions={};s.ui.show={};
  s.ecs.relationships[person].known[player]={ring:"personal",goodwill:36};
  s.knowledge[player].events=s.events.map(e=>e.id);
  const render=view=>renderToStaticMarkup(<I18n locale="en" messages={messages}><GameState.Provider value={s}>{view}</GameState.Provider></I18n>);
  const html=render(<><IntroOverlay touch={false}/><TaskPanel/><EventFeed/><PersonPanel entityId={person}/><FamilyTree entityId={player}/></>);
  expect(html).toContain("Mother sent me here");expect(html).toContain("Find your mother");
  openChat(s,player,person);const chat=render(<ChatPanel/>);
  for(const text of [html,chat]) {
    for(const id of [b.fatherId,b.halfBrotherId,b.queenId]){expect(text).not.toContain(id);expect(text).not.toContain(s.peopleDirectory[id].nameable.nickname);}
    expect(text).not.toMatch(/old king|current king|royal marriage|sent her away/i);
  }
});

it("speaks an on-topic named search answer and learns a lead without revealing terrain or a face",()=>{
  const {state:s,player,person,sibling}=setup(),known=[...s.ecs.playable[player].known];
  expect(openChat(s,player,person)).toBe(true);
  const q=chatChoices(s).find(l=>l.family=="maternal_search"&&l.b.relative.id==sibling);expect(q).toBeDefined();
  expect(chooseLine(s,q.key)).toBe(true);
  expect(s.chat.active.transcript.at(-1)).toMatchObject({family:"maternal_whereabouts",situation:"known"});
  expect(s.knowledge[player].familyWhereabouts[sibling].villageId).toBe("village");
  expect(s.ecs.playable[player].known).toEqual(known);expect(s.knowledge[player].people[sibling].nameOnly).toBe(true);
});
