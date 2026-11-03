import { peopleWorld } from "./support/people";

import { talk, get_attention } from "game/tasks";
import { openChat, chooseLine, closeChat, chatChoices, speakLine, patience, recoverSlots, topicScore, previewLine } from "game/chat";
import { serialiseGame, restoreGame } from "game/save_game";
import { recordEvent } from "game/events";
import { updateFavours, visibleFavours, acceptFavour } from "game/favours";

jest.mock("game/name", () => ({ name: n => n?.nickname || "?", firstName: n => n?.nickname?.split(" ")[0] || "?", familyName: n => n?.nickname?.split(" ")[1] || "?" }));

function contact() {
  const w = peopleWorld();
  w.state.world={home:{x:0,y:0},hexes:[{x:0,y:0,biome:"grassland",temperature:"temperate",moisture:"normal"}]};
  w.state.weather={"0,0":{type:"clear"}};
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

  expect(s.knowledge[p].people[n].conversation).toBeUndefined();
  chooseLine(s,chatChoices(s)[0].key);
  expect(s.knowledge[p].people[n].conversation).toBeDefined();
  closeChat(s); expect(s.game_speed).toBe("normal");
});
it("rejects remote entry and never introduces an unreachable stranger", () => {
  const {state:s, player:p,person:n}=peopleWorld();
  s.ecs.spatial[p].x=-1000;
  expect(openChat(s,p,n)).toBe(false);
  expect(s.knowledge?.[p]?.people?.[n]).toBeUndefined();
});
it("pops against the hearer, reveals only the tested taste and keeps unmatched icons until paired", () => {
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
  expect(s.chat.active.row).toEqual([work]);
  expect(s.chat.active.endReason).toBeUndefined();
  speakLine(s,line("d","player",[work]));
  expect(s.chat.active.row).toEqual([]);
});
it("spends remaining cells on close, recovers with elapsed hours, and restores all chat records", () => {
  const {state:s,player:p,person:n}=contact(); openChat(s,p,n);
  closeChat(s);
  const spent=patience(s,p,n).resting;
  expect(spent).toBeGreaterThan(0);
  recoverSlots(s,3); expect(patience(s,p,n).resting).toBe(spent);
  recoverSlots(s,3); expect(patience(s,p,n).resting).toBe(spent-1);
  const restored=restoreGame(serialiseGame(s));
  expect(restored.chat).toEqual(s.chat);
  expect(restored.knowledge).toEqual(s.knowledge);
  expect(topicScore(s,n,"work")).toBe(0);
});
it("restores an active paused chat without replaying its spoken effects",()=>{
  const {state:s,player:p,person:n}=contact();openChat(s,p,n);
  chooseLine(s,chatChoices(s)[0].key);
  const restored=restoreGame(serialiseGame(s));
  expect(restored.chat.active).toEqual(s.chat.active);
  expect(restored.ecs.relationships).toEqual(s.ecs.relationships);
  closeChat(restored);
  expect(restored.game_speed).toBe("normal");
  expect(restored.chat.history[0].lines.slice(0,s.chat.active.transcript.length)).toEqual(s.chat.active.transcript);
});
it("requires acquaintance and spoken favour disclosure before accepting real work", () => {
  const {state:s,player:p,person:n,tiles}=contact();
  const house=tiles[3]; s.ecs.container ||= {}; s.ecs.container[house]={amounts:{},capacity:20};
  s.ecs.household[house]={storeId:house,fields:[]};
  updateFavours(s);
  const r=Object.values(s.favours.requests)[0]; expect(r).toBeDefined();
  expect(visibleFavours(s)).toEqual([]); expect(acceptFavour(s,r.id,n)).toBeNull();
  openChat(s,p,n); chooseLine(s,chatChoices(s).find(l=>l.family=="introduction").key);
  // Replay finding 4: a request now follows an explicit help question.
  expect(chatChoices(s).some(l=>l.family=="favour_accept")).toBe(false);
  s.chat.active.focus="help";
  chooseLine(s,chatChoices(s).find(l=>l.family=="need_question").key);
  expect(chatChoices(s).some(l=>l.family=="favour_accept")).toBe(true);
  chooseLine(s,chatChoices(s).find(l=>l.family=="favour_accept").key);
  expect(r.status).toBe("accepted"); expect(r.deliveryAuthorised).toBe(true);
  expect(s.ecs.manager[p].jobs.some(j=>j.favourId==r.id)).toBe(true);
  expect(s.knowledge[p].people[n].traits).toEqual([]);
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
  s.game_speed="normal";
  const before=serialiseGame(s); w.step(2);
  expect(serialiseGame(s)).toBe(before);
});
it("ends a full row without partial insertion and preserves spent slots on reopening", () => {
  const {state:s,player:p,person:n}=contact();openChat(s,p,n);s.chat.active.row=[];
  const line={id:"full",key:"full",useKey:"full",speaker:"player",text:"full",icons:["work","family","season","food","harvest","village"].map(key=>({kind:"topic",key})),effects:[],tags:{},disclosure:{}};
  expect(speakLine(s,line)).toBe(true);
  expect(s.chat.active.endReason).toBe("row_full");expect(s.chat.active.row).toHaveLength(6);
  closeChat(s);expect(patience(s,p,n).free).toBe(0);expect(openChat(s,p,n)).toBe(false);
});
// Chris's revised v1 rule: both speakers' matches affect only NPC regard.
it("keeps unrelated tastes hidden and scores NPC replies against the NPC's tastes", () => {
  const {state:s,player:p,person:n}=contact();openChat(s,p,n);s.chat.active.row=[];
  const line=(id,speaker,topic)=>({id,key:id,useKey:id,speaker,text:id,icons:[{kind:"topic",key:topic}],effects:[],tags:{},disclosure:{}});
  const before=s.ecs.relationships[n].known[p].goodwill;
  speakLine(s,line("one","npc","food"));speakLine(s,line("two","player","food"));
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before-.25);
  expect(s.knowledge[p].people[n].topicTastes).toEqual({food:0});
  s.ecs.personality[p].traits=["gloomy"];
  s.ecs.personality[n].traits=["cheerful"];
  speakLine(s,line("three","player","food"));const own=s.ecs.relationships[p].known[n].goodwill;
  const npcBefore=s.ecs.relationships[n].known[p].goodwill;
  speakLine(s,line("four","npc","food"));
  expect(s.ecs.relationships[p].known[n].goodwill).toBe(own);
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(npcBefore+1);
  expect(s.knowledge[p].people[n].topicTastes).toEqual({food:1});
});
it("marks each matching icon on a choice before it is spoken, without exposing hidden tastes",()=>{
  const {state:s,player:p,person:n}=contact();
  s.world={home:{x:0,y:0}};s.weather={"0,0":{type:"clear"}};openChat(s,p,n);
  s.chat.active.row=[{kind:"topic",key:"season",life:3}];
  const choice={icons:[{kind:"topic",key:"work"},{kind:"topic",key:"season"}]};
  expect(previewLine(s,choice).matchingKeys).toEqual(["topic:season"]);
  s.chat.active.focus="season";

  expect(s.knowledge[p].people[n].topicTastes).toBeUndefined();
});
it("uses the same NPC portrait reaction whichever side completes it",()=>{
  const {state:s,player:p,person:n}=contact();openChat(s,p,n);s.chat.active.row=[];
  const line=(id,speaker)=>({id,key:id,useKey:id,speaker,text:id,icons:[{kind:"person",personId:n}],effects:[],tags:{},disclosure:{}});
  const before=s.ecs.relationships[n].known[p].goodwill,own=s.ecs.relationships[p].known[n].goodwill;
  speakLine(s,line("portrait-p","player"));speakLine(s,line("portrait-n","npc"));
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before+1);
  expect(s.ecs.relationships[p].known[n].goodwill).toBe(own);
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
  const popAmount=s.chat.active.transcript.flatMap(l=>l.pops).reduce((sum,pop)=>sum+pop.amount,0);
  expect(s.ecs.relationships[n].known[outsider].goodwill).toBeCloseTo(before-3+popAmount);
  expect(s.chat.active.transcript.some(l=>l.family=="gossip_reaction")).toBe(true);
  expect(chooseLine(s,line.key)).toBe(false);
  expect(s.knowledge[n].events.filter(id=>id==event.id)).toHaveLength(1);
  expect(s.knowledge[p].people[sibling]).toBeUndefined();
});
it("does not name unknown people when retelling an anonymously witnessed event",()=>{
  const {state:s,player:p,person:n,parent,sibling}=contact();
  for(const [a,b] of [[p,n],[n,p]])s.ecs.relationships[a].known[b]={ring:"social",goodwill:16,base:16};
  const event=recordEvent(s,"birth",[sibling,parent,n]);
  expect(s.knowledge[p].events).toContain(event.id);
  s.knowledge[n].events=s.knowledge[n].events.filter(id=>id!=event.id);
  openChat(s,p,n);s.chat.active.focus="news";
  expect(s.knowledge[p].people[parent]).toBeUndefined();
  expect(s.knowledge[p].people[sibling]).toBeUndefined();
  const tell=chatChoices(s).find(l=>l.family=="gossip_tell");
  expect(tell).toBeDefined();
  expect(tell.text).not.toContain("Edith");expect(tell.text).not.toContain("Alice");

  expect(s.knowledge[p].people[parent]).toBeUndefined();
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
it("does not narrate a chapel walk when the approach snapshot was a walk to the well",()=>{
  const {state:s,player:p,person:n}=contact();
  const {predicate}=require("game/chat_facts");
  const c={actorId:p,npcId:n,activity:{key:"walk_to_place",place_name:"well"}};
  expect(predicate(s,c,{}, {test:"activity_snapshot_is",args:{person:"npc",activity:"walk_to_place",place_kind:"chapel"}})).toBe(false);
  c.activity={key:"fell"};
  expect(predicate(s,c,{}, {test:"activity_snapshot_was_work",args:{person:"npc"}})).toBe(true);
});
it("seeds matching icons and offers weather, lands and help without needing prior discoveries",()=>{
  const {state:s,player:p,person:n,tiles}=contact();
  s.world={home:{x:0,y:0},hexes:[]};s.weather={"0,0":{type:"clear"}};
  s.villages.village={id:"village",name:"Withyford",houses:[tiles[3]],sharedPlaces:[]};
  openChat(s,p,n);
  expect(s.chat.active.row.length).toBeGreaterThanOrEqual(2);
  const choices=chatChoices(s);
  expect(choices.length).toBeGreaterThanOrEqual(3);
  expect(choices.some(l=>l.family=="season_talk")).toBe(true);
  expect(choices.some(l=>l.family=="lands_question")).toBe(true);
  expect(choices.some(l=>l.family=="need_question")).toBe(true);
  expect(choices.some(l=>previewLine(s,l).matches>0)).toBe(true);
});
it("offers a visible matching first turn when a tradesperson opens with work and their portrait",()=>{
  const {state:s,player:p,person:n}=contact();
  s.ecs.profession ||= {};s.ecs.profession[n]={trade:"carpenter"};
  openChat(s,p,n);
  s.chat.active.row=[{kind:"topic",key:"work",life:3},{kind:"person",personId:n,life:3}];
  for(let encounter=1;encounter<=12;encounter++) {
    s.chat.active.encounter=encounter;
    expect(Math.max(...chatChoices(s).map(l=>previewLine(s,l).matches))).toBe(2);
  }

});
it("answers a work question with the actual trade before unrelated household observations",()=>{
  const {state:s,player:p,person:n}=contact();
  s.ecs.profession ||= {};s.ecs.profession[n]={trade:"carpenter"};
  s.ecs.planner[n].task=["trade_work"];
  openChat(s,p,n);s.chat.active.focus="work";
  const line=chatChoices(s).find(l=>l.family=="work_question"&&["general","personal"].includes(l.situation));
  expect(line).toBeDefined();chooseLine(s,line.key);
  expect(s.chat.active.transcript.filter(l=>l.speaker=="npc").at(-1).situation).toBe("trade_carpenter");
});
it("names a real open request in a help answer and makes its giver the next conversation hint",()=>{
  const {state:s,player:p,person:n,parent,tiles}=contact();
  s.world={home:{x:0,y:0},hexes:[]};s.weather={"0,0":{type:"clear"}};
  const house=tiles[4];s.ecs.container ||= {};s.ecs.container[house]={amounts:{},capacity:20};
  s.ecs.household[house]={storeId:house,fields:[]};
  s.ecs.household[parent].houseId=house;s.ecs.controllable[house]={controllerId:parent};
  s.ecs.relationships[n].known[parent]={ring:"social",goodwill:16,base:16};
  s.ecs.relationships[n].known[p]={ring:"social",goodwill:16,base:16};
  updateFavours(s);openChat(s,p,n);
  chooseLine(s,chatChoices(s).find(l=>l.family=="need_question").key);
  const r=Object.values(s.favours.requests).find(r=>r.status=="offered");
  expect(s.chat.active.transcript.some(l=>l.family=="need_news"&&l.text.includes("Edith"))).toBe(true);
  expect(s.knowledge[p].heardNeeds[r.id]).toMatchObject({askerId:parent});
  expect(s.knowledge[p].offers?.[r.id]).toBeUndefined();
  expect(s.knowledge[p].people[parent].conversation).toBeUndefined();
  closeChat(s);s.intro={active:false};s.ui.show={};s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  expect(require("game/guidance").openingGuidance(s)).toMatchObject({targetId:parent,action:expect.stringContaining("Edith")});
});
it.each([5,6])("reports all six travel directions from hex geometry on row %s",y=>{
  const {state:s}=contact();s.world={home:{x:5,y}};s.map={worldKey:"5,"+y};
  const {neighbours,SIDE_NAMES,worldKey}=require("game/travel_geometry"),{eventFact}=require("game/chat_facts");
  neighbours(s.world.home).forEach((hex,side)=>expect(eventFact(s,{day:s.days,fromWorld:worldKey(hex)}).from_direction).toBe(SIDE_NAMES[side]));
});

it.each(["timid", "proud"])("costs two goodwill and refuses premature help for a %s stranger, then accepts an introduction",trait=>{
  const {state:s,player:p,person:n}=contact();s.ecs.personality[n].traits=[trait];openChat(s,p,n);
  s.chat.active.row=[];
  const before=s.ecs.relationships[n].known[p].goodwill;
  const question=chatChoices(s).find(l=>l.family=="need_question");expect(question).toBeDefined();
  chooseLine(s,question.key);
  const transcript=s.chat.active.transcript;
  const pops=transcript.flatMap(l=>l.pops).reduce((sum,pop)=>sum+pop.amount,0);
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before-2+pops);
  expect(transcript.at(-1)).toMatchObject({family:"help_refusal"});
  expect(s.knowledge[p].heardNeeds).toBeUndefined();
});
it.each(["timid","proud","generous"])("has no early-help penalty after introduction for %s",trait=>{
  const {state:s,player:p,person:n}=contact();s.ecs.personality[n].traits=[trait];openChat(s,p,n);
  const intro=chatChoices(s).find(l=>l.family=="introduction");expect(intro).toBeDefined();chooseLine(s,intro.key);
  s.chat.active.row=[];delete s.chat.active.endReason;
  const before=s.ecs.relationships[n].known[p].goodwill;
  s.chat.active.focus="help";
  const question=chatChoices(s).find(l=>l.family=="need_question");expect(question).toBeDefined();chooseLine(s,question.key);
  const pops=s.chat.active.transcript.slice(-2).flatMap(l=>l.pops).reduce((sum,pop)=>sum+pop.amount,0);
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before+pops);
  expect(s.chat.active.transcript.at(-1).family).not.toBe("help_refusal");
});
it.each([[1.2,9],[1.2001,4],[1.8,4],[1.8001,2]])("caps tired-player slots at %s tiredness",(tiredness,max)=>{
  const {state:s,player:p,person:n}=contact();s.ecs.relationships[n].known[p]={ring:"personal",goodwill:45,base:45};s.ecs.personable[p].tiredness=tiredness;
  expect(patience(s,p,n).max).toBe(max);
  expect(openChat(s,p,n)).toBe(true);
  expect(s.chat.active.endReason).toBeUndefined();
  const choices=chatChoices(s).filter(l=>previewLine(s,l).fits);expect(choices.length).toBeGreaterThan(0);

  expect(chooseLine(s,choices[0].key)).toBe(true);
  if(max==2)expect(s.chat.active.endReason).toBeDefined();
});
it("does not describe close kin as passing acquaintances even with a public bond",()=>{
  const {state:s,player:p,person:n,parent}=contact();s.ecs.relationships[n].known[p]={ring:"social",goodwill:16,base:16};s.ecs.relationships[n].known[parent]={ring:"public",goodwill:0,base:0};
  openChat(s,p,n);s.knowledge[p].people[parent]={traits:[]};s.chat.active.row=[];s.chat.active.subjectId=parent;s.chat.active.phase="reply";
  const {lineCandidates}=require("game/chat");
  const lines=lineCandidates(s,s.chat.active,"relationship_answer");
  expect(lines.some(l=>l.situation=="passing")).toBe(false);
  expect(lines.some(l=>l.situation=="kin_public")).toBe(true);
});
