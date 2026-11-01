import LINES from "data/conversation_lines.json";
import { peopleWorld } from "./support/people";
import { openChat, speakLine, lineCandidates, reply, chatChoices, chooseLine, closeChat, patience } from "game/chat";
import { recordEvent } from "game/events";
import { updateFavours } from "game/favours";

function setup(ring="social") {
  const w=peopleWorld(),{state:s,player:p,person:n}=w;
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  s.knowledge={[p]:{people:{[n]:{traits:[],conversation:{day:s.days}}},feelings:{}}};
  s.ecs.relationships[n].known[p]={ring,goodwill:ring=="public"?0:36,base:16};
  openChat(s,p,n);s.chat.active.row=[];s.chat.active.phase="player_turn";
  return w;
}
function answer(s,q) {
  expect(speakLine(s,q)).toBe(true);
  const before=s.chat.active.transcript.length;
  reply(s,s.chat.active.reply);
  return s.chat.active.transcript.slice(before).find(l=>l.family!="leave_taking");
}
it("answers a children question about children even when the only undisclosed story is a dead sibling",()=>{
  const {state:s,player:p,person:n,sibling}=setup();
  s.ecs.personable[sibling].dead=true;
  const e=recordEvent(s,"death",[sibling],[],{cause:"old_age"});
  (s.knowledge[n] ||= {people:{},feelings:{}}).events=[e.id];
  const q=lineCandidates(s,s.chat.active,"family_question","player").find(l=>l.situation=="children");
  const a=answer(s,q);
  expect(a.text).toMatch(/children|little ones/i);
  expect(a.text).not.toContain("Alice");
  expect(s.knowledge[p].kinLinks).toBeUndefined();
});
it("replaces living-relative questions with condolences after a known death",()=>{
  const {state:s,player:p,person:n,sibling}=setup();
  s.ecs.personable[sibling].dead=true;
  const e=recordEvent(s,"death",[sibling],[],{cause:"old_age"});
  s.knowledge[p].events=[e.id];s.knowledge[p].people[sibling]={traits:[]};
  s.knowledge[p].kinLinks={[`${n}:${sibling}:sibling`]:{id:`${n}:${sibling}:sibling`,speaker_id:n,relative_id:sibling,kinship:"sibling"}};
  const rows=lineCandidates(s,s.chat.active,"family_question","player");
  expect(rows.some(l=>l.situation=="known_relative"&&l.b.relative.id==sibling)).toBe(false);
  expect(rows.some(l=>l.situation=="bereaved_relative"&&l.b.relative.id==sibling)).toBe(true);
});

// Every authored question row gets a physically possible fixture and is
// selected through the real matcher. Exhaustion repeats each case after all
// available factual use keys have been spent, with unrelated news in reserve.
const questions=LINES.filter(l=>l.speaker=="player"&&(/question/.test(l.family)||l.family=="help_offer"||l.situation=="player_asks_name"));
it.each(["no_request","refused","nothing_known"])("keeps every authored player question on topic: %s",kind=>{
  const seen=new Set();
  for(const row of questions)for(const exhausted of [false,true]) {
    const {state:s,player:p,person:n,parent,sibling,tiles}=setup(kind=="refused"?"public":"social"),c=s.chat.active;
    s.ecs.profession={[n]:{trade:"baker"}};s.knowledge[p].people[n].trade="baker";
    s.ecs.playable[p].arrivedAt=s.days;
    s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
    s.villages.other={name:"Oakdale",houses:[],centre:require("game/hex").Hex().fromPoint(s.ecs.spatial[tiles[4]])};
    s.knowledge[p].villages=["village","other"];
    s.knowledge[p].people[parent]={traits:[]};c.subjectId=parent;
    const visit=recordEvent(s,"visit",[parent,n]);
    (s.knowledge[n] ||= {people:{},feelings:{}}).events=kind=="nothing_known"?[]:[visit.id];s.knowledge[p].events=[];
    s.knowledge[p].kinLinks={[`${n}:${sibling}:sibling`]:{id:`${n}:${sibling}:sibling`,speaker_id:n,relative_id:sibling,kinship:"sibling"}};
    s.knowledge[p].people[sibling]={traits:[]};
    s.knowledge[p].noticedNeeds={harvest:{speakerId:n,kind:"harvest"},wood:{speakerId:n,kind:"wood",workplace_name:"oven"},food:{speakerId:n,kind:"food"}};
    for(const pred of row.when.all) {
      if(pred.test=="has_trait")s.ecs.personality[p].traits=[pred.args.trait];
      if(pred.test=="weather_is") {s.world={home:{x:0,y:0}};s.weather={"0,0":{type:pred.args.type}};}
      if(pred.test=="season_is")s.days=9;
    }
    if(row.situation=="player_asks_name") {delete s.knowledge[p].people[n];delete s.ecs.relationships[p].known[n];c.tags=[];}
    if(row.situation=="bereaved_relative") {
      s.ecs.personable[sibling].dead=true;
      const death=recordEvent(s,"death",[sibling]);s.knowledge[p].events=[death.id];
    }
    const q=lineCandidates(s,c,row.family,"player").find(l=>l.id==row.id);
    expect({id:row.id,reachable:!!q}).toEqual({id:row.id,reachable:true});
    if(exhausted) {
      c.phase="reply";
      for(const f of [...new Set(LINES.filter(l=>l.speaker=="npc").map(l=>l.family))])
        for(const l of lineCandidates(s,c,f,"npc"))s.chat.pairs[p+":"+n].used[l.useKey]=true;
      c.phase="player_turn";
    }
    const expected=q.effects.find(e=>e.op=="set_reply_purpose")?.purpose;
    const a=answer(s,q);
    expect({id:q.id,answer:a?.family}).toEqual({id:q.id,answer:expected});
    // Subtopics must remain exact; a family-labelled sibling story is still
    // wrong for a children question.
    if(q.situation=="children")expect(a.text).toMatch(/children|little ones/i);
    if(q.situation=="workplace_age")expect(a.situation).toMatch(/workplace_age/);
    seen.add(q.id);
  }
  expect([...seen].sort()).toEqual(questions.map(q=>q.id).sort());
});
it.each(["offer","referral"])("reserves a closing response to a last-slot %s",kind=>{
  const {state:s,player:p,person:n,parent,tiles}=setup();
  const giver=kind=="offer"?n:parent;
  const house=kind=="offer"?tiles[3]:tiles[4];
  s.ecs.household[giver].houseId=house;
  s.ecs.household[house]={storeId:house,fields:[]};s.ecs.controllable[house]={controllerId:giver};s.ecs.container ||= {};s.ecs.container[house]={capacity:20,amounts:{}};
  updateFavours(s);s.chat.active.phase="reply";
  const family=kind=="offer"?"favour_ask":"need_news";
  const line=lineCandidates(s,s.chat.active,family,"npc").find(l=>l.b.request?.giverId==giver);
  expect(line).toBeDefined();
  s.chat.active.row=Array.from({length:patience(s,p,n).max-line.icons.length},()=>({kind:"topic",key:"faith",life:3}));
  expect(speakLine(s,line)).toBe(true);
  expect(s.chat.active.endReason).toBeUndefined();
  const choices=chatChoices(s);
  expect(choices.some(l=>l.family==(kind=="offer"?"favour_accept":"referral_reply"))).toBe(true);
  expect(chooseLine(s,choices.find(l=>l.family==(kind=="offer"?"favour_decline":"referral_reply")).key)).toBe(true);
  expect(s.chat.active.endReason).toBeDefined();
  expect(s.chat.active.transcript.some(l=>l.speaker=="player")).toBe(true);
  expect(p).toBeDefined();
});
it("avoids the player's recent NPC wording across different people",()=>{
  const {state:s,player:p,person:n,parent,sibling}=setup();closeChat(s);
  const ids=[];
  for(let i=0;i<6;i++) {
    const id=[n,parent,sibling][i%3];s.days+=1;
    s.ecs.relationships[id].known[p]={ring:"social",goodwill:36};
    openChat(s,p,id);const c=s.chat.active;c.row=[];c.usedIds=[];c.phase="reply";
    reply(s,"field_talk");
    const line=c.transcript.filter(l=>l.family=="field_talk").at(-1);expect(line).toBeDefined();
    expect(ids).not.toContain(line.id);ids.push(line.id);closeChat(s);
  }
});
