import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { ChatPanel } from "../src/components/chat_panel";
import LINES from "data/conversation_lines.json";
import { peopleWorld } from "./support/people";
import { openChat, closeChat, speakLine, chatChoices, chooseLine, previewLine, lineCandidates, patience } from "game/chat";
import { recordEvent, eventSentence } from "game/events";
import { serialiseGame, restoreGame } from "game/save_game";
jest.mock("components/contexts", () => require("../src/components/contexts"), {virtual:true});
jest.mock("game/name", () => ({name:n=>n?.nickname||"?",firstName:n=>n?.nickname?.split(" ")[0]||"?",familyName:n=>n?.nickname?.split(" ")[1]||"?"}));
const topic=key=>({kind:"topic",key});
const line=(id,icons,extra={})=>({id,key:id,useKey:id,speaker:"player",text:id,icons,effects:[],tags:{},disclosure:{},...extra});
const html=s=>renderToStaticMarkup(<GameState.Provider value={s}><ChatPanel/></GameState.Provider>);
function setup(ring="public",goodwill=0) {
  const w=peopleWorld(),{state:s,player:p,person:n}=w;
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  s.ecs.relationships[n].known[p]={ring,goodwill,base:goodwill};
  s.ui.actions={close_chat:()=>closeChat(s)};
  openChat(s,p,n);s.chat.active.row=[];
  return w;
}
it("keeps an unmatched icon through many lines and a save, then frees exactly its pair's slot",()=>{
  const {state:s,player:p,person:n}=setup();
  speakLine(s,line("old",[topic("work")]));
  for(let i=0;i<8;i++)speakLine(s,line("pair"+i,[topic("season")]));
  expect(s.chat.active.row).toEqual([topic("work")]);
  expect(s.chat.active.endReason).toBeUndefined();
  const restored=restoreGame(serialiseGame(s));
  const before=restored.ecs.relationships[n].known[p].goodwill;
  expect(previewLine(restored,line("match",[topic("work")])).matches).toBe(1);
  speakLine(restored,line("match",[topic("work")]));
  expect(restored.chat.active.row).toEqual([]);
  expect(restored.ecs.relationships[n].known[p].goodwill).toBe(before-.25);
  expect(html(s)).not.toMatch(/faded|lines left|fade after/i);
});
it("fills all available slots, closes, and spends them on the next conversation",()=>{
  const {state:s,player:p,person:n}=setup();
  const icons=["family","work","harvest","food","season","village"].map(topic);
  expect(patience(s,p,n).max).toBe(6);
  expect(speakLine(s,line("full",icons))).toBe(true);
  expect(s.chat.active.row).toHaveLength(6);
  expect(s.chat.active.endReason).toBe("row_full");
  closeChat(s);expect(patience(s,p,n).free).toBe(0);expect(openChat(s,p,n)).toBe(false);
});
it("marks woodland defiance, charges extra bad will, and records only the real participants' account",()=>{
  const {state:s,player:p,person:n,parent}=setup();closeChat(s);
  s.chat.pairs[p+":"+n].resting=0;
  s.customs={incidents:[{id:1,actorId:p,villageId:"village",day:s.days,status:"queued"}]};
  const context={kind:"warning",actorId:p,speakerId:n,villageId:"village",incidentId:1};
  expect(openChat(s,p,n,{openingFamily:"village_warning",context,required:true})).toBe(true);
  const choice=chatChoices(s).find(l=>l.text=="I don't agree.");
  expect(choice.defiant).toBe(true);
  expect(previewLine(s,choice).remaining).toBe(2); // Village pair gone; Woodland + grievance remain.
  const before=s.ecs.relationships[n].known[p].goodwill;
  expect(chooseLine(s,choice.key)).toBe(true);
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before-5);
  expect(s.chat.active.row.filter(i=>i.kind=="grievance")).toHaveLength(1);
  const event=s.events.find(e=>e.type=="defiance");
  expect(event).toMatchObject({people:[p,n],reason:"woodland",lineId:choice.id,villageId:"village"});
  expect(s.knowledge[n].events).toContain(event.id);
  expect(s.knowledge[parent]?.events||[]).not.toContain(event.id);
  expect(eventSentence(s,event,id=>s.ecs.nameable[id].nickname)).toContain("Will Ashdown refused to heed Agnes Miller's warning about the village woodland");
  expect(LINES.some(l=>l.family=="event_news"&&l.when.all.some(p=>p.test=="event_type_is"&&p.args.type=="defiance"))).toBe(true);
  expect(html(s)).toContain("Grievance");
});
it("never matches a grievance and keeps it until closing, including across saves",()=>{
  const {state:s}=setup();
  speakLine(s,line("defy",[topic("work")],{defiant:true}));
  expect(s.chat.active.row.some(i=>i.kind=="grievance")).toBe(true);
  const restored=restoreGame(serialiseGame(s));
  for(let i=0;i<6;i++)speakLine(restored,line("match"+i,[topic("work")]));
  expect(restored.chat.active.row.filter(i=>i.kind=="grievance")).toHaveLength(1);
  expect(previewLine(restored,line("fake",[{kind:"grievance"}])).matches).toBe(0);
});
it("declares valid levels on every row and hides confidence until Intimate",()=>{
  for(const r of LINES)expect(r.level).toMatchObject({ring:expect.stringMatching(/^(public|social|personal|intimate)$/),below:expect.stringMatching(/^(hide|risk)$/)});
  const {state:s,player:p,person:n}=setup();
  expect(lineCandidates(s,s.chat.active,"confidence_question","player")).toEqual([]);
  s.ecs.relationships[n].known[p]={ring:"intimate",goodwill:65};
  expect(lineCandidates(s,s.chat.active,"confidence_question","player")).toHaveLength(1);
});
it("visibly marks intrusive work as risky for a stranger, rebuffs it, and makes the same line safe for a friend",()=>{
  const {state:s,player:p,person:n}=setup();
  s.chat.active.focus="help";
  const q=chatChoices(s).find(l=>l.family=="help_offer");expect(q).toBeDefined();
  expect(q.risk).toBeDefined();expect(html(s)).toContain("Risk:");
  const before=s.ecs.relationships[n].known[p].goodwill;
  chooseLine(s,q.key);
  const pops=s.chat.active.transcript.flatMap(l=>l.pops).reduce((n,p)=>n+p.amount,0);
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before-2+pops);
  expect(s.chat.active.transcript.at(-1).family).toBe("level_rebuff");
  expect(s.knowledge[p].offers).toBeUndefined();
  const friend=setup("personal",35);
  const safe=lineCandidates(friend.state,friend.state.chat.active,"help_offer","player").find(l=>l.id==q.id);
  expect(safe.risk).toBeUndefined();
  expect(speakLine(friend.state,safe)).toBe(true);
  expect(friend.state.chat.active.reply).toBe("favour_ask");
  expect(friend.state.chat.active.lastSetback).toBeUndefined();
});
it("uses actual village standing as well as closeness and leaves rights unchanged on a rebuff",()=>{
  const {state:s,player:p,person:n}=setup("personal",35);
  s.ecs.household[p]={houseId:null};s.ecs.village[p]={villageId:null};
  let q=lineCandidates(s,s.chat.active,"village_question","player").find(l=>l.situation=="commons_leave");
  expect(q.risk).toBeDefined();
  s.ecs.village[p].memberships={village:{day:s.days}};
  q=lineCandidates(s,s.chat.active,"village_question","player").find(l=>l.situation=="commons_leave");
  expect(q.risk).toBeUndefined();
  s.ecs.village[p].memberships.village.left=true;
  expect(lineCandidates(s,s.chat.active,"village_question","player").find(l=>l.situation=="commons_leave").risk).toBeDefined();
});
it("a stranger's intrusive death question brings a rebuff, a grievance and no disclosure",()=>{
  const {state:s,player:p,person:n,sibling}=setup();
  s.ecs.personable[sibling].dead=true;
  const e=recordEvent(s,"death",[sibling]);s.knowledge[p].events=[e.id];
  s.knowledge[p].kinLinks={[`${n}:${sibling}:sibling`]:{id:`${n}:${sibling}:sibling`,speaker_id:n,relative_id:sibling,kinship:"sibling"}};
  s.chat.active.focus="family";
  const q=lineCandidates(s,s.chat.active,"family_question","player").find(l=>l.situation=="death");expect(q.risk).toBeDefined();
  expect(speakLine(s,q)).toBe(true);
  expect(s.chat.active.row.some(i=>i.kind=="grievance")).toBe(true);
  expect(s.chat.active.reply).toBe("level_rebuff");
});
it.each(["name","offer","purpose"])("leads with the direct %s answer and shows at most one maternal search",expected=>{
  const {state:s,player:p,parent,sibling}=setup();
  s.backstories={[p]:{relatives:[parent,sibling].map(id=>({id,name:s.ecs.nameable[id].nickname,term:"uncle"}))}};
  s.chat.active.expectation=expected;
  const choices=chatChoices(s);
  expect(choices[0].answers).toContain(expected);
  expect(choices.filter(l=>l.family=="maternal_search").length).toBeLessThanOrEqual(1);
  expect(choices.some(l=>!["maternal_search","maternal_introduction"].includes(l.family)&&!l.answers?.includes(expected))).toBe(true);
});

it("finishes a required answer when full, then closes even if that answer matches space free",()=>{
  const {state:s,player:p,person:n}=setup();
  s.chat.active.row=["village","family","food","season","harvest"].map(topic);
  expect(speakLine(s,line("ask-work",[topic("work")],{speaker:"npc",expects:"work"}))).toBe(true);
  expect(s.chat.active.row).toHaveLength(patience(s,p,n).max);
  expect(s.chat.active.endReason).toBeUndefined();
  const answer=chatChoices(s)[0];expect(answer.answers).toContain("work");
  chooseLine(s,answer.key);
  expect(s.chat.active.endReason).toBe("row_full");
  expect(s.chat.active.transcript.some(l=>l.id==answer.id)).toBe(true);
});
it("does not let the player's own closeness unlock the NPC's private lines",()=>{
  const {state:s,player:p,person:n}=setup();
  s.ecs.relationships[p].known[n]={ring:"intimate",goodwill:80};
  expect(lineCandidates(s,s.chat.active,"confidence_question","player")).toEqual([]);
});
it("can speak the recorded defiance account to a later listener through existing event disclosure",()=>{
  const {state:s,player:p,person:n,parent}=setup();
  const event=recordEvent(s,"defiance",[p,n],[],{reason:"woodland",statement:"I don't agree.",audienceIds:[p,n]});
  closeChat(s);
  expect(openChat(s,parent,n)).toBe(true);
  s.chat.active.phase="reply";s.chat.active.subjectId=p;
  const account=lineCandidates(s,s.chat.active,"event_news","npc").find(l=>l.b.event?.id==event.id);
  expect(account).toBeDefined();
  expect(account.text).toContain("refused to heed the woodland warning");
  expect(speakLine(s,account)).toBe(true);
  expect(s.knowledge[parent].events).toContain(event.id);
  expect(s.knowledge[parent].spokenSources[event.id]).toMatchObject({speakerId:n,lineId:account.id});
});
it("fills the other cards with distinct subjects instead of dropping surplus family searches after truncation",()=>{
  const {state:s,player:p,parent,sibling}=setup();
  s.world={home:{x:0,y:0},hexes:[]};s.weather={"0,0":{type:"clear"}};
  s.backstories={[p]:{relatives:[parent,sibling].map(id=>({id,name:s.ecs.nameable[id].nickname,term:"uncle"}))}};
  delete s.chat.active.expectation;
  expect(chatChoices(s).filter(l=>l.family=="maternal_search")).toHaveLength(1);
  expect(chatChoices(s)).toHaveLength(4);
});
