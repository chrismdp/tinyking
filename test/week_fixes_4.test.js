/* global it, expect */
import { peopleWorld } from "./support/people";
import { mutuallyOriented } from "game/orientation";
import { restoreGame, serialiseGame } from "game/save_game";
import { openChat, closeChat, chatChoices, chooseLine, lineCandidates } from "game/chat";
import { chatRecord } from "game/chat_patience";
import { recordEvent } from "game/events";
import { currentActivity } from "game/person_activity";

function couple(ring="public") {
  const w=peopleWorld(),{state:s,player:p,person:n}=w;
  s.ecs.nameable[p].male=true;s.ecs.personality[p].orientation="same";
  s.ecs.personality[n].orientation="opposite";s.opinionThresholds={hate:-100,love:-99};
  for(const [a,b] of [[p,n],[n,p]])s.ecs.relationships[a].known[b]={ring,goodwill:({public:0,social:12,personal:35,intimate:65})[ring]};
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  expect(openChat(s,p,n)).toBe(true);
  s.chat.active.row=[];s.chat.active.focus="family";delete s.chat.active.expectation;
  return w;
}
const flirt=s=>chatChoices(s).find(l=>l.family==="flirt");
function visit(s,p,n) {
  closeChat(s);chatRecord(s,p,n).resting=0;
  expect(openChat(s,p,n)).toBe(true);
  s.chat.active.row=[];s.chat.active.focus="family";delete s.chat.active.expectation;
}

it.each(["same","opposite","both"])("lets the current player court either sex regardless of a saved %s orientation",orientation=>{
  const {state:s,player:p,person:n}=couple();s.ecs.personality[p].orientation=orientation;
  for(const male of [false,true]) {
    s.ecs.nameable[n].male=male;s.ecs.personality[n].orientation=male?"same":"opposite";
    for(const state of [s,restoreGame(serialiseGame(s))]) {
      expect(mutuallyOriented(state,p,n)).toBe(true);expect(mutuallyOriented(state,n,p)).toBe(true);
      expect(flirt(state)).toBeDefined();
    }
    s.ecs.personality[n].orientation=male?"opposite":"same";
    expect(mutuallyOriented(s,p,n)).toBe(false);expect(flirt(s)).toBeUndefined();
  }
});

it("keeps villager preferences when control passes to another person",()=>{
  const {state:s,player:p,person:n,sibling}=couple();
  expect(mutuallyOriented(s,p,n)).toBe(true);
  s.ui.playerId=sibling;
  expect(mutuallyOriented(s,p,n)).toBe(false);
  expect(s.ecs.personality[p].orientation).toBe("same");
});

it("changes courting with every mutual ring and remembers used exchanges after a save",()=>{
  const {state:s,player:p,person:n}=couple();let game=s;
  const stageLines=[];
  for(const ring of ["public","social","personal","intimate"]) {
    for(const [a,b] of [[p,n],[n,p]])game.ecs.relationships[a].known[b]={ring,goodwill:({public:0,social:12,personal:35,intimate:65})[ring]};
    const first=flirt(game);expect(first).toBeDefined();
    expect(first.b.courtship.stage).toBe(ring);stageLines.push(first.text);
    expect(chooseLine(game,first.key)).toBe(true);
    expect(flirt(game)).toBeUndefined();
    const reply=game.chat.active.transcript.findLast(l=>l.family==="flirt_reply");
    expect(reply).toBeDefined();
    visit(game,p,n);game=restoreGame(serialiseGame(game));
    const next=flirt(game);expect(next).toBeDefined();expect(next.text).not.toBe(first.text);
    expect(lineCandidates(game,game.chat.active,"flirt","player").some(l=>l.key===first.key)).toBe(false);
  }
  expect(new Set(stageLines).size).toBe(4);
});

it.each(["family","trait","work","news"])("uses only a learned %s fact in courting",kind=>{
  const {state:s,player:p,person:n,parent}=couple("social");
  const candidates=()=>lineCandidates(s,s.chat.active,"flirt","player").filter(l=>l.b.courtship?.memory===kind);
  s.ecs.profession={[n]:{trade:"baker"}};
  const event=recordEvent(s,"death",[parent],[],{audienceIds:[n]});
  expect(candidates()).toHaveLength(0);
  if(kind==="family")s.knowledge[p].kinLinks={[`${n}:${parent}:parent`]:{speaker_id:n,relative_id:parent,kinship:"parent",kin_term:"mother"}};
  if(kind==="trait")s.knowledge[p].people[n].traits=["generous"];
  if(kind==="work")s.knowledge[p].people[n].trade="baker";
  if(kind==="news") {s.knowledge[p].events=[event.id];s.knowledge[p].spokenSources={[event.id]:{speakerId:n}};}
  const rows=candidates();expect(rows.length).toBeGreaterThan(0);
  expect(rows.every(l=>l.b.courtship.factId===(kind==="family"?parent:kind==="trait"?"generous":kind==="work"?"baker":event.id))).toBe(true);
});

it.each(["listener_closeness","player_closeness","listener_taste","player_taste","ill_will"])("speaks the %s proposal barrier in the courting reply",barrier=>{
  const {state:s,player:p,person:n}=couple("personal");
  if(barrier==="listener_closeness")s.ecs.relationships[n].known[p]={ring:"public",goodwill:0};
  if(barrier==="player_closeness")s.ecs.relationships[p].known[n]={ring:"public",goodwill:0};
  if(barrier==="listener_taste")s.ecs.personality[n].opinionThresholds={hate:100,love:101};
  if(barrier==="player_taste")s.ecs.personality[p].opinionThresholds={hate:100,love:101};
  if(barrier==="ill_will")s.ecs.relationships[n].known[p].goodwill=-12;
  expect(chooseLine(s,flirt(s).key)).toBe(true);
  expect(s.chat.active.romanceResult).toMatchObject({barrier,reason:expect.any(String)});
  expect(s.chat.active.transcript.findLast(l=>l.family==="flirt_reply")).toBeDefined();
  expect(chatChoices(s).some(l=>l.family==="proposal")).toBe(false);
  if(barrier.endsWith("taste"))expect(s.social?.contacts?.[[p,n].sort().join(":")]).toBe(s.days);
});

it("offers a proposal when courting reaches mutual Personal regard",()=>{
  const {state:s,player:p,person:n,tiles}=couple("social");s.ecs.building={[tiles[3]]:{rooms:[]}};
  for(const [a,b] of [[p,n],[n,p]])s.ecs.relationships[a].known[b].goodwill=29;
  expect(chooseLine(s,flirt(s).key)).toBe(true);
  s.chat.active.focus="family";
  const proposal=chatChoices(s).find(l=>l.family==="proposal");expect(proposal).toBeDefined();
  expect(chooseLine(s,proposal.key)).toBe(true);expect(s.ecs.kinship[p].spouse).toBe(n);
});

it("finishes a name question without a negative match on either half of the introduction",()=>{
  const {state:s,player:p,person:n}=couple();const c=s.chat.active;
  delete s.knowledge[n];delete s.ecs.relationships[n].known[p];c.knewBefore=false;c.tags=[];
  c.expectation="name";c.row=[{kind:"person",personId:p}];
  const before=c.transcript.length,regard=s.ecs.relationships[n].known[p]?.goodwill||0;
  expect(chooseLine(s,chatChoices(s).find(l=>l.family==="introduction").key)).toBe(true);
  expect(c.expectation).not.toBe("name");expect(s.knowledge[n].people[p]).toBeDefined();
  expect(c.transcript.slice(before).flatMap(l=>l.pops).every(pop=>pop.amount>=0)).toBe(true);
  expect(s.ecs.relationships[n].known[p].goodwill).toBeGreaterThanOrEqual(regard);
  expect(c.transcript.slice(before).some(l=>l.family==="taste_reaction")).toBe(false);
});

it.each(["eat","trade_work","walk_to"])("describes whom the active chat approach waits for during %s",task=>{
  const {state:s,player:p,person:n}=peopleWorld();
  s.ecs.planner[p].task=["approach_chat",n];s.ecs.planner[n].task=[task];
  const label=currentActivity(s.ecs,p,k=>k,id=>s.ecs.nameable[id].nickname.split(" ")[0]);
  expect(label).toBeTruthy();expect(label).toContain("Agnes");
  s.ecs.planner[n].task=null;
  expect(currentActivity(s.ecs,p,k=>k)).not.toBe(label);
});

it("rejects another courting choice cached before the first one was spoken",()=>{
  const {state:s}=couple();const first=flirt(s);
  s.chat.active.row=[{kind:"topic",key:"family"}];
  const second=flirt(s);
  // Both alternatives were genuinely offered, before this encounter's courtship.
  const alternatives=Object.values(s.chat.active.offeredRomance).filter(l=>l.family==="flirt");
  if(second.key===first.key) {
    s.knowledge[s.ui.playerId].people[s.chat.active.npcId].traits=["generous"];
    flirt(s);
  }
  const other=Object.values(s.chat.active.offeredRomance).find(l=>l.family==="flirt"&&l.key!==first.key);
  expect(other).toBeDefined();expect(alternatives.length).toBeGreaterThan(0);
  expect(chooseLine(s,first.key)).toBe(true);
  expect(chooseLine(s,other.key)).toBe(false);
});
