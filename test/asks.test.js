import { peopleWorld } from "./support/people";
import { openChat, chatChoices, chooseLine, closeChat } from "game/chat";
import { recordEvent, learnEvent, knownEvents } from "game/events";
import { updateFavours, acceptFavour } from "game/favours";

jest.mock("game/name", () => ({ name: n => n?.nickname || "?" }));

// An ask comes from what is happening in a person's life, names an outcome and
// leaves the route to the player. It completes when the outcome happens.
function family() {
  const w=peopleWorld(),s=w.state;
  s.newsModel=true;
  const {player,person,parent,sibling}=w;
  for(const [id,n] of [[person,"Hugh Jobari"],[parent,"Gillian Thubaho"],[sibling,"Ann Jobari"]])s.ecs.nameable[id].nickname=n;
  s.ecs.kinship[parent].children=[person,sibling];
  s.ecs.kinship[person].parents=[parent];s.ecs.kinship[sibling].parents=[parent];
  s.villages.elsewhere={id:"elsewhere",name:"Thornford",centre:{x:9,y:0},houses:[],sharedPlaces:[]};
  s.ecs.village[sibling]={villageId:"elsewhere"};
  s.ecs.spatial[sibling]={x:s.ecs.spatial[person].x+2000,y:s.ecs.spatial[person].y};
  return {...w,s};
}
const offered=(s,kind,giver)=>Object.values(s.favours?.requests||{}).find(r=>r.kind==kind&&r.giverId==giver&&r.status=="offered");
const accept=(s,r,giver,player)=>{
  // Initial fixture: the giver made this offer in person.
  s.knowledge ||= {};const k=s.knowledge[player] ||= {people:{},feelings:{}};
  k.people[giver]={...(k.people[giver]||{}),conversation:{day:s.days}};
  (k.favours ||= []).push(r.id);(k.offers ||= {})[r.id]={speakerId:giver,day:s.days};
  return acceptFavour(s,r.id,giver);
};

it("asks the player to carry news of a death to close kin in another village, and completes when the player tells them", () => {
  const {s,player,person,parent,sibling}=family();
  s.ecs.personable[parent].dead=true;
  const death=recordEvent(s,"death",[parent]);
  learnEvent(s,person,death);
  expect(knownEvents(s,sibling).some(e=>e.id==death.id)).toBe(false);
  updateFavours(s);
  const r=offered(s,"word",person);
  expect(r).toMatchObject({targetId:sibling,eventId:death.id});
  expect(accept(s,r,person,player)).toBeTruthy();
  expect(r.status).toBe("accepted");
  expect(s.ecs.manager[player].jobs).toEqual([]);
  learnEvent(s,player,death);
  s.ecs.spatial[player]={...s.ecs.spatial[sibling]};
  const before=s.ecs.relationships[person].known[player]?.goodwill||0;
  expect(openChat(s,player,sibling,{required:true})).toBeTruthy();
  s.chat.active.focus="tell";
  const tell=chatChoices(s).find(l=>l.family=="gossip_tell"&&l.b?.event?.id==death.id);
  expect(tell).toBeDefined();
  expect(chooseLine(s,tell.key)).toBe(true);
  closeChat(s,{interrupted:true});
  updateFavours(s);
  expect(r.status).toBe("completed");
  expect(s.ecs.relationships[person].known[player].goodwill).toBeGreaterThan(before);
  expect(s.events.some(e=>e.type=="favour"&&e.people.includes(person))).toBe(true);
});

it("withdraws a carry-word ask when the kin hear the news some other way", () => {
  const {s,person,parent,sibling}=family();
  s.ecs.personable[parent].dead=true;
  const death=recordEvent(s,"death",[parent]);
  learnEvent(s,person,death);
  updateFavours(s);
  const r=offered(s,"word",person);
  learnEvent(s,sibling,death);
  updateFavours(s);
  expect(r.status).toBe("expired");
});

it("asks for help making peace after a quarrel, and completes when the two reconcile", () => {
  const {s,player,person,sibling}=family();
  s.ecs.village[sibling]=s.ecs.village[person];
  recordEvent(s,"quarrel",[person,sibling],[],{audienceIds:[person,sibling]});
  updateFavours(s);
  const r=offered(s,"peace",person);
  expect(r).toMatchObject({targetId:sibling});
  expect(accept(s,r,person,player)).toBeTruthy();
  updateFavours(s);
  expect(r.status).toBe("accepted");
  recordEvent(s,"reconciliation",[person,sibling],[],{audienceIds:[person,sibling]});
  updateFavours(s);
  expect(r.status).toBe("completed");
});

it("asks nothing of a quiet life", () => {
  const {s,person}=family();
  updateFavours(s);
  expect(Object.values(s.favours.requests).filter(r=>["word","peace"].includes(r.kind)&&r.giverId==person)).toEqual([]);
});

it("asks for help straight after telling someone they trust about the quarrel, and lets the player accept", () => {
  const {s,player,person,sibling}=family();
  s.ecs.village[sibling]=s.ecs.village[person];
  recordEvent(s,"quarrel",[person,sibling],[],{audienceIds:[person,sibling]});
  updateFavours(s);
  s.ecs.relationships[person].known[player]={ring:"social",goodwill:15,base:0};
  s.ecs.spatial[player]={...s.ecs.spatial[person]};
  expect(openChat(s,player,person,{required:true})).toBeTruthy();
  s.chat.active.focus="family";
  const how=chatChoices(s).find(l=>l.family=="own_question");
  expect(chooseLine(s,how.key)).toBe(true);
  const said=s.chat.active.transcript.filter(l=>l.speaker=="npc").map(l=>l.family);
  expect(said).toContain("own_news");
  expect(said).toContain("favour_ask");
  const yes=chatChoices(s).find(l=>l.family=="favour_accept");
  expect(yes).toBeDefined();
  expect(chooseLine(s,yes.key)).toBe(true);
  expect(Object.values(s.favours.requests).find(r=>r.kind=="peace"&&r.giverId==person).status).toBe("accepted");
});

it("asks the player to look in on an old relative in another house, and completes when they talk", () => {
  const {s,player,person,parent}=family();
  s.ecs.personable[parent].age=74;
  s.ecs.household[parent]={...s.ecs.household[parent],houseId:"another-house"};
  updateFavours(s);
  const r=offered(s,"visit",person);
  expect(r).toMatchObject({targetId:parent});
  expect(accept(s,r,person,player)).toBeTruthy();
  s.ecs.spatial[player]={...s.ecs.spatial[parent]};
  expect(openChat(s,player,parent,{required:true})).toBeTruthy();
  const line=chatChoices(s).find(l=>l.speaker=="player"&&l.family!="leave_taking");
  expect(chooseLine(s,line.key)).toBe(true);
  closeChat(s,{interrupted:true});
  updateFavours(s);
  expect(r.status).toBe("completed");
});

it("asks the player to find out how a relative who left is faring, and completes on news of them since", () => {
  const {s,player,person,sibling}=family();
  s.days=10;
  const left=recordEvent(s,"departure",[sibling],[],{toWorld:"the Eastern Marches",audienceIds:[person,sibling]});
  s.ecs.village[sibling]={villageId:"away"};
  learnEvent(s,person,left);
  s.days=12;
  updateFavours(s);
  const r=offered(s,"find",person);
  expect(r).toMatchObject({targetId:sibling,eventId:left.id});
  expect(accept(s,r,person,player)).toBeTruthy();
  learnEvent(s,player,left);
  updateFavours(s);
  expect(r.status).toBe("accepted");
  const since=recordEvent(s,"marriage",[sibling,parentless(s)],[],{audienceIds:[sibling]});
  learnEvent(s,player,since);
  updateFavours(s);
  expect(r.status).toBe("completed");
});
const parentless=s=>Object.keys(s.ecs.personable).find(id=>!s.ecs.kinship[id]?.parents?.length&&id!=s.ui.playerId);

it("makes the ask when a player they know offers help", () => {
  const {s,player,person,parent}=family();
  s.ecs.personable[parent].age=74;
  s.ecs.household[parent]={...s.ecs.household[parent],houseId:"another-house"};
  updateFavours(s);
  s.ecs.relationships[person].known[player]={ring:"social",goodwill:15,base:0};
  s.ecs.spatial[player]={...s.ecs.spatial[person]};
  expect(openChat(s,player,person,{required:true})).toBeTruthy();
  s.chat.active.focus="help";
  const offer=chatChoices(s).find(l=>l.family=="need_question");
  expect(offer).toBeDefined();
  expect(chooseLine(s,offer.key)).toBe(true);
  const asked=s.chat.active.transcript.find(l=>l.family=="favour_ask");
  expect(asked?.text).toContain("Gillian");
});

it("never offers an ask as work, so it cannot be finished by labour", () => {
  const {s,player,person,sibling}=family();
  s.ecs.village[sibling]=s.ecs.village[person];
  recordEvent(s,"quarrel",[person,sibling],[],{audienceIds:[person,sibling]});
  updateFavours(s);
  const r=offered(s,"peace",person);
  expect(accept(s,r,person,player)).toBeTruthy();
  const {Hex}=require("game/hex");
  s.ecs.playable[player].known=Object.keys(s.ecs.walkable).map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  const choices=require("game/day").slotChoices(s).choices;
  expect(choices.some(c=>c.personId==person)).toBe(true);
  expect(choices.filter(c=>c.activity=="work"&&c.requestId==r.id)).toEqual([]);
});

it("delivers accepted word to the giver's kin even when the deceased was not their kin or village neighbour", () => {
  const {s,player,person,parent,sibling}=family();
  // The recipient is the giver's sister; the deceased is the giver's spouse.
  s.ecs.kinship[parent]={parents:[],children:[],spouse:person};
  s.ecs.kinship[person]={parents:[],children:[],spouse:parent};
  s.ecs.kinship[sibling]={parents:[],children:[]};
  s.ecs.personable[parent].dead=true;
  const death=recordEvent(s,"death",[parent],[],{audienceIds:[person]});
  learnEvent(s,player,death);
  const r={id:"word-test",kind:"word",giverId:person,targetId:sibling,eventId:death.id,status:"accepted",actorId:player,acceptedDay:s.days,createdDay:s.days,goodwill:10};
  s.favours={requests:{[r.id]:r}};
  s.ecs.spatial[player]={...s.ecs.spatial[sibling]};
  expect(openChat(s,player,sibling,{required:true})).toBe(true);
  s.chat.active.subjectId=sibling;s.chat.active.focus="tell";
  const tell=chatChoices(s).find(l=>l.b.event?.id==death.id);
  expect(tell).toBeDefined();
  expect(tell.promiseId).toBe(r.id);
  expect(chooseLine(s,tell.key)).toBe(true);
  updateFavours(s);expect(r.status).toBe("completed");
});

it.each(["word","peace","visit","find"])("acknowledges accepting a %s ask and returns choices with patience left",kind=>{
  const {s,player,person,parent,sibling}=family();
  s.newsModel=false;s.ecs.personable[parent].dead=kind=="word";
  const event=recordEvent(s,kind=="word"?"death":kind=="find"?"departure":"quarrel",kind=="word"?[parent]:[person,sibling],[],{audienceIds:[person]});
  const r={id:"accept-test",kind,giverId:person,targetId:sibling,eventId:event.id,householdId:s.ecs.household[person].houseId,status:"offered",createdDay:s.days};
  s.favours={requests:{[r.id]:r}};
  s.ecs.relationships[person].known[player]={ring:"personal",goodwill:40};
  s.ecs.spatial[player]={...s.ecs.spatial[person]};
  openChat(s,player,person,{required:true});s.chat.active.row=[];s.chat.active.phase="reply";
  const {lineCandidates,speakLine}=require("game/chat");
  const offer=lineCandidates(s,s.chat.active,"favour_ask","npc").find(l=>l.b.request?.id==r.id);
  // Completed contact is the fixture boundary for this offer.
  if(!offer){require("game/people").completeConversation(s,player,person);}
  speakLine(s,offer||lineCandidates(s,s.chat.active,"favour_ask","npc").find(l=>l.b.request?.id==r.id));
  s.chat.active.row=[];s.chat.active.phase="player_turn";
  const yes=chatChoices(s).find(l=>l.family=="favour_accept");expect(yes).toBeDefined();
  chooseLine(s,yes.key);
  expect(s.chat.active.transcript.at(-1)).toMatchObject({speaker:"npc",family:"favour_accepted"});
  expect(s.chat.active.endReason).toBeUndefined();
  expect(chatChoices(s).some(l=>require("game/chat").previewLine(s,l).fits)).toBe(true);
});
