import { peopleWorld } from "./support/people";
import { openChat, chatChoices, chooseLine, lineCandidates, patience } from "game/chat";
import { marriageReason, marriageTasteReason } from "game/family";
import { chatTogether } from "game/social";
import { enqueueTask } from "game/manager";

function courtingChat() {
  const w=peopleWorld(),{state:s,player:p,person:n,tiles}=w;
  s.ecs.nameable[p].male=true;
  s.ecs.personality[p].orientation="both";s.ecs.personality[n].orientation="both";
  s.opinionThresholds={hate:-100,love:-99};
  s.ecs.building={[tiles[3]]:{rooms:[]}};
  for(const [a,b] of [[p,n],[n,p]])s.ecs.relationships[a].known[b]={ring:"personal",goodwill:40,base:40};
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  expect(openChat(s,p,n)).toBe(true);
  s.chat.active.row=[];s.chat.active.focus="family";
  return w;
}
const candidate=(s,family)=>lineCandidates(s,s.chat.active,family,"player")[0];
const choice=(s,family)=>chatChoices(s).find(l=>l.family==family);
const bondValues=(s,a,b)=>[s.ecs.relationships[a].known[b].goodwill,s.ecs.relationships[b].known[a].goodwill];

it.each(["family","mood"])("offers courting and a willing proposal under %s",focus=>{
  const {state:s}=courtingChat();s.chat.active.focus=focus;
  expect(choice(s,"flirt")).toBeDefined();
  expect(choice(s,"proposal")).toBeDefined();
});

it.each(["child_player","child_listener","married_player","married_listener","kin","orientation","commitment"])("hides romantic lines for %s",reason=>{
  const {state:s,player:p,person:n,parent,sibling}=courtingChat();
  if(reason=="child_player")s.ecs.personable[p].age=12;
  if(reason=="child_listener")s.ecs.personable[n].age=12;
  if(reason=="married_player")s.ecs.kinship[p].spouse=sibling;
  if(reason=="married_listener")s.ecs.kinship[n].spouse=sibling;
  if(reason=="kin")s.ecs.kinship[p].parents=[parent];
  if(reason=="orientation")s.ecs.personality[n].orientation="same";
  if(reason=="commitment")s.ecs.relationships[n].commitment={partnerId:sibling};
  expect(candidate(s,"flirt")).toBeUndefined();
  expect(candidate(s,"proposal")).toBeUndefined();
});

it("keeps courting available before mutual Personal regard, but hides a proposal",()=>{
  const {state:s,player:p,person:n}=courtingChat();
  s.ecs.relationships[p].known[n]={ring:"social",goodwill:16};
  expect(choice(s,"flirt")).toBeDefined();
  expect(candidate(s,"proposal")).toBeUndefined();
});

it("applies the existing time-together effect once when the player courts",()=>{
  const {state:s,player:p,person:n}=courtingChat();
  const expected=courtingChat().state;
  chatTogether(expected,p,n);
  const before=bondValues(s,p,n);
  expect(chooseLine(s,choice(s,"flirt").key)).toBe(true);
  const pops=s.chat.active.transcript.flatMap(l=>l.pops).reduce((sum,pop)=>sum+pop.amount,0);
  expect(bondValues(s,p,n)).toEqual([expected.ecs.relationships[p].known[n].goodwill,expected.ecs.relationships[n].known[p].goodwill+pops]);
  expect(bondValues(s,p,n).every((g,i)=>g>before[i])).toBe(true);
  expect(s.social.contacts[[p,n].sort().join(":")]).toBe(s.days);
  expect(s.chat.active.transcript.some(l=>l.speaker=="npc"&&l.family=="flirt_reply")).toBe(true);
  expect(s.ecs.kinship[p].spouse).toBeNull();
  expect(choice(s,"flirt")).toBeUndefined();
});

it("cannot repeat an already spoken courting line from the offered choices",()=>{
  const {state:s,player:p,person:n}=courtingChat(),line=choice(s,"flirt");
  expect(chooseLine(s,line.key)).toBe(true);
  const after=bondValues(s,p,n);
  expect(chooseLine(s,line.key)).toBe(false);
  expect(bondValues(s,p,n)).toEqual(after);
});

it("answers a taste mismatch without applying the courting effect",()=>{
  const {state:s,player:p,person:n}=courtingChat();
  s.ecs.personality[n].opinionThresholds={hate:100,love:101};
  const line=choice(s,"flirt"),reason=marriageTasteReason(s,p,n),before=s.ecs.relationships[p].known[n].goodwill;
  expect(line).toBeDefined();expect(reason).toBeTruthy();
  expect(chooseLine(s,line.key)).toBe(true);
  expect(s.ecs.relationships[p].known[n].goodwill).toBe(before);
  expect(s.chat.active.transcript.at(-1)).toMatchObject({speaker:"npc",family:"flirt_reply"});
  expect(s.chat.active.transcript.at(-1).text).toContain(reason);
});

it("accepts a proposal, celebrates, releases attention and finishes the queued chat after a household move",()=>{
  const {state:s,player:p,person:n,tiles}=courtingChat();
  s.ecs.household[p].houseId=tiles[0];
  const job=enqueueTask(s,{key:"chat"},n);s.chat.active.taskId=job.id;
  expect(chooseLine(s,choice(s,"proposal").key)).toBe(true);
  expect(s.ecs.kinship[p].spouse).toBe(n);expect(s.ecs.kinship[n].spouse).toBe(p);
  expect(s.ecs.household[p].houseId).toBe(tiles[3]);
  expect(s.events.filter(e=>e.type=="marriage")).toHaveLength(1);
  expect(s.events.filter(e=>e.type=="celebration")).toHaveLength(1);
  expect(s.wedding.people).toEqual([p,n]);
  expect(s.chat.active).toBeUndefined();expect(s.game_speed).toBe("normal");
  expect(s.chat.history.at(-1).lines.some(l=>l.speaker=="npc"&&l.family=="proposal_reply")).toBe(true);
  expect(s.ecs.planner[n].world.capturedBy).toBeFalsy();
  expect(s.ecs.manager[p].jobs).toHaveLength(0);expect(job.progress).toBe(1);
});

it.each(["regard","age","married","kin","orientation","taste","home"])("refuses a proposal after %s changes, with the listener's reason and no wedding",reason=>{
  const {state:s,player:p,person:n,sibling,parent}=courtingChat(),line=choice(s,"proposal");
  expect(line).toBeDefined();
  if(reason=="regard")s.ecs.relationships[n].known[p]={ring:"social",goodwill:16};
  if(reason=="age")s.ecs.personable[p].age=12;
  if(reason=="married")s.ecs.kinship[n].spouse=sibling;
  if(reason=="kin")s.ecs.kinship[p].parents=[parent];
  if(reason=="orientation")s.ecs.personality[n].orientation="same";
  if(reason=="taste")s.ecs.personality[n].opinionThresholds={hate:100,love:101};
  if(reason=="home"){s.ecs.building={};s.villages={};}
  const expected=marriageReason(s,p,n);
  expect(chooseLine(s,line.key)).toBe(true);
  expect(s.ecs.kinship[p].spouse).toBeNull();
  expect((s.events||[]).filter(e=>["marriage","celebration"].includes(e.type))).toHaveLength(0);
  expect(s.chat.active.endReason).toBeUndefined();
  const answer=s.chat.active.transcript.at(-1);
  expect(answer).toMatchObject({speaker:"npc",family:"proposal_reply"});
  if(expected)expect(answer.text).toContain(expected);
  else expect(s.chat.active.romanceResult.reason).toBeTruthy();
});

it("still answers a refused proposal that uses the last free slot",()=>{
  const {state:s,player:p,person:n}=courtingChat(),line=choice(s,"proposal"),c=s.chat.active;
  s.ecs.building={};s.villages={};
  c.row=Array.from({length:patience(s,p,n).max-line.icons.length},()=>({kind:"topic",key:"faith"}));
  expect(chooseLine(s,line.key)).toBe(true);
  expect(c.transcript.at(-1)).toMatchObject({speaker:"npc",family:"proposal_reply"});
  expect(c.endReason).toBeUndefined();
});
