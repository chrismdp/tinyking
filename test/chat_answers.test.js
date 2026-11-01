import LINES from "data/conversation_lines.json";
import { peopleWorld } from "./support/people";
import { openChat, speakLine, chatChoices, chooseLine, previewLine, patience } from "game/chat";
import { chatRecord } from "game/chat_patience";

const asking=LINES.filter(l=>l.speaker=="npc"&&l.expects);
it("declares answers for name requests, offers, referrals and every authored question",()=>{
  expect(asking.length).toBeGreaterThan(85);
  for(const line of LINES.filter(l=>l.speaker=="npc"&&l.family!="leave_taking"&&(/[?]/.test(l.text)||l.family=="help_refusal"||l.effects.some(e=>e.op=="set_pending_offer"))))expect({id:line.id,expects:line.expects}).toEqual({id:line.id,expects:expect.any(String)});
});
it.each(["fresh","full_row","tired","hostile_practical","topics_spent"])("can directly answer every asking catalogue line: %s",stateClass=>{
  expect(asking.length).toBeGreaterThan(0);
  const seen=[];
  for(const row of asking) {
    const {state:s,player:p,person:n}=peopleWorld();
    s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
    expect(openChat(s,p,n)).toBe(true);
    const c=s.chat.active;c.row=[];c.phase="reply";
    if(stateClass=="tired")s.ecs.personable[p].tiredness=2;
    if(stateClass=="hostile_practical") {c.mode="practical_only";s.ecs.relationships[n].known[p].goodwill=-20;}
    if(stateClass=="topics_spent") {c.usedIds=LINES.map(l=>l.id);for(const l of LINES)chatRecord(s,p,n).used[l.use_key]=true;}
    if(stateClass=="full_row")c.row=Array.from({length:patience(s,p,n).max},()=>({kind:"topic",key:"faith",life:3}));
    // The emitted asking row is the fixture boundary. Its factual bindings and
    // original eligibility are independent of the next-turn response guarantee.
    if(["warning","oath","leave"].includes(row.expects)) {
      const {newEntities}=require("game/entities");
      const [house]=newEntities(s,[{spatial:{...s.ecs.spatial[n]},building:{},household:{},village:{villageId:"village"},controllable:{controllerId:n}}]);
      s.villages.village={id:"village",houses:[house],elderId:n};s.ecs.household[n].houseId=house;
      s.ecs.household[p]={houseId:null};s.ecs.village[p]={villageId:null};
      s.ecs.relationships[n].known[p]={ring:"social",goodwill:12,base:12};
      s.knowledge[p].people[n]={traits:[],conversation:{day:s.days}};
      if(row.expects=="leave")s.ecs.village[p].memberships={village:{day:0}};
      s.customs={incidents:[{id:1,actorId:p,villageId:"village",day:s.days}]};
      c.context={kind:row.expects,actorId:p,speakerId:n,villageId:"village",incidentId:1};
    }
    const emitted={...row,key:row.id,useKey:row.id,text:row.text,icons:row.icons.map(i=>i.kind=="topic"?i:{kind:"person",personId:n}),b:{},effects:[],disclosure:{}};
    expect(speakLine(s,emitted)).toBe(true);
    expect(c.endReason).toBeUndefined();
    c.focus="season";
    const direct=chatChoices(s).find(l=>l.answers?.includes(row.expects)&&previewLine(s,l).fits);
    expect({id:row.id,answer:direct?.answers}).toEqual({id:row.id,answer:expect.arrayContaining([row.expects])});
    expect(chooseLine(s,direct.key)).toBe(true);
    expect(c.transcript.some(l=>l.speaker=="player")).toBe(true);seen.push(row.id);
  }
  expect(seen).toEqual(asking.map(l=>l.id));
});
it("answers the live help-before-introduction rebuff with a usable name line",()=>{
  const {state:s,player:p,person:n}=peopleWorld();s.ecs.personality[n].traits=["proud"];
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};openChat(s,p,n);
  chooseLine(s,chatChoices(s).find(l=>l.family=="need_question").key);
  expect(s.chat.active.transcript.at(-1).family).toBe("help_refusal");
  const answer=chatChoices(s).find(l=>l.family=="introduction");expect(answer).toBeDefined();
  expect(previewLine(s,answer).fits).toBe(true);expect(chooseLine(s,answer.key)).toBe(true);
  expect(s.knowledge[n].people[p]).toBeDefined();
});
