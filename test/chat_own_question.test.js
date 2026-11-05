import { peopleWorld } from "./support/people";
import { openChat, lineCandidates, chatChoices, speakLine, previewLine } from "game/chat";
import { meet } from "game/people";
import { chatRecord } from "game/chat_patience";

function setup() {
  const f=peopleWorld(),{state:s,player:p,person:n}=f;
  meet(s,p,n);meet(s,n,p);
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  openChat(s,p,n);s.chat.active.row=[];s.chat.active.phase="player_turn";
  return f;
}
it.each([["proud",1],["humble",-1],["generous",-.25]])("asks about the listener and uses their real %s reaction",(trait,amount)=>{
  const {state:s,player:p,person:n}=setup(),c=s.chat.active;
  s.ecs.personality[n]={traits:[trait],likes:[],dislikes:[]};
  const questions=lineCandidates(s,c,"own_question","player");
  expect(questions).toHaveLength(4);
  for(const q of questions)expect(q.icons).toEqual([{kind:"person",personId:n}]);
  c.row=[{kind:"person",personId:n}];
  const before=s.ecs.relationships[n].known[p].goodwill;
  expect(speakLine(s,questions[0])).toBe(true);
  expect(c.row).toEqual([]);
  expect(s.ecs.relationships[n].known[p].goodwill).toBe(before+amount);
  expect(s.knowledge[p].people[n].personReactions[n].score).toBe(amount==-.25?0:amount);
  expect(s.knowledge[p].people[n].topicTastes?.family).toBeUndefined();
});

it.each(["family","mood"])("always offers the eligible keeping question under %s alongside required answers",focus=>{
  for(let encounter=1;encounter<=12;encounter++)for(const expectation of [undefined,"name","offer","purpose","work","family"]) {
    const {state:s,player:p,parent,sibling}=setup(),c=s.chat.active;
    s.backstories={[p]:{relatives:[parent,sibling].map(id=>({id,name:s.ecs.nameable[id].nickname,term:"uncle"}))}};
    c.focus=focus;c.encounter=encounter;c.expectation=expectation;
    c.row=[{kind:"topic",key:"family"},{kind:"mood",key:"guarded"}];
    const choices=chatChoices(s);
    expect(choices.length).toBeLessThanOrEqual(4);
    expect(choices.filter(l=>l.family=="own_question")).toHaveLength(1);
    if(expectation)expect(choices[0].answers).toContain(expectation);
    const direct=lineCandidates(s,c,"direct_answer","player").filter(l=>l.evasive&&l.answers?.includes(expectation));
    for(const evasive of direct)expect(choices.some(l=>l.useKey==evasive.useKey)).toBe(true);
    expect(choices.filter(l=>l.family=="maternal_search").length).toBeLessThanOrEqual(1);
  }
});

it.each(["unknown","practical","used"])("does not offer the keeping question when its %s condition rejects it",reason=>{
  const {state:s,player:p,person:n}=setup(),c=s.chat.active;c.focus="family";
  if(reason=="unknown"){delete s.ecs.relationships[p].known[n];delete s.knowledge?.[p]?.people?.[n];}
  if(reason=="practical")c.mode="practical_only";
  if(reason=="used")chatRecord(s,p,n).used[lineCandidates(s,c,"own_question","player")[0].useKey]=true;
  expect(chatChoices(s).some(l=>l.family=="own_question")).toBe(false);
});

it("retains a required answer on a full row when the keeping question cannot fit",()=>{
  const {state:s}=setup(),c=s.chat.active;
  c.focus="family";c.expectation="name";
  c.row=Array.from({length:12},(_,i)=>({kind:"person",personId:"other-"+i}));
  const choices=chatChoices(s);
  expect(choices[0].answers).toContain("name");
  expect(previewLine(s,choices[0]).fits).toBe(true);
  expect(choices.some(l=>l.family=="own_question")).toBe(true);
});
