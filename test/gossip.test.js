import { peopleWorld } from "./support/people";
import { recordEvent, learnEvent } from "game/events";
import { chatTogether, historyStep, compareSocial } from "game/social";
import { newsPreference, chooseNews } from "game/news";
import { community, attach } from "./support/travel";
import { departNpc, advanceWorldClock } from "game/travel";
import { DAYS_IN_SEASON } from "game/time";
import { newEntities } from "game/entities";

function setup() {
  const w=peopleWorld(),s=w.state;
  s.knowledge={};s.events=[];
  for(const id of [w.player,w.person,w.parent,w.sibling])s.ecs.kinship[id]={parents:[],children:[],spouse:null};
  for(const a of [w.person,w.parent,w.sibling])for(const b of [w.person,w.parent,w.sibling])if(a!=b)s.ecs.relationships[a].known[b]={ring:"personal",goodwill:40,base:40};
  return w;
}
it("exchanges at most one unheard event per speaker after a live contact and records the teller",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  const sent=[0,1,2].map(()=>recordEvent(s,"marriage",[c],[],{audienceIds:[a]}));
  const back=recordEvent(s,"harvest",[c],[],{quantity:7,audienceIds:[b]});
  s.ecs.village[b].villageId="other";
  expect(chatTogether(s,a,b)).toBe(true);
  expect(s.knowledge[b].events.filter(id=>sent.some(e=>e.id==id))).toHaveLength(1);
  expect(s.knowledge[a].events).toContain(back.id);
  const id=s.knowledge[b].events.find(id=>sent.some(e=>e.id==id));
  expect(s.knowledge[b].spokenSources[id]).toMatchObject({speakerId:a,day:s.days});
  expect(s.knowledge[a].spokenSources[back.id].speakerId).toBe(b);
});
it("does not exchange on a failed contact or disclose sealed, unknown or trust-excluded news",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  const hidden=[recordEvent(s,"quarrel",[c,a],[],{audienceIds:[a]}),recordEvent(s,"unknown",[c],[],{audienceIds:[a]}),recordEvent(s,"marriage",[c],[],{sealed:true})];
  s.knowledge[a].events.push(hidden[2].id);s.ecs.relationships[a].known[b]={ring:"public",goodwill:0,base:0};
  expect(chatTogether(s,a,b)).toBe(true);
  expect(hidden.every(e=>!s.knowledge[b]?.events?.includes(e.id))).toBe(true);
  const publicNews=recordEvent(s,"marriage",[c],[],{audienceIds:[a]});s.ecs.spatial[b].x+=500;
  expect(chatTogether(s,a,b)).toBe(false);expect(s.knowledge[b]?.events||[]).not.toContain(publicNews.id);
});
it("passes the names actually stated in news without inventing a personal acquaintance",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  delete s.ecs.relationships[b].known[c];
  const event=recordEvent(s,"harvest",[c],[],{quantity:6,audienceIds:[a]});
  expect(chatTogether(s,a,b)).toBe(true);
  expect(s.knowledge[b].events).toContain(event.id);
  expect(s.knowledge[b].people[c]).toEqual({traits:[]});
  expect(s.ecs.relationships[b].known[c]).toBeUndefined();
  expect(s.knowledge[b].people[c].conversation).toBeUndefined();
});
it("keeps an anonymous witness's account anonymous when another villager learns it",()=>{
  const {state:s,person:a,parent:b}=setup();
  const [unknown]=newEntities(s,[{personable:{age:30},nameable:{nickname:"Unintroduced Harvester"}}]);
  const event=recordEvent(s,"harvest",[unknown],[],{quantity:6,audienceIds:[a]});
  expect(chatTogether(s,a,b)).toBe(true);
  expect(s.knowledge[b].events).toContain(event.id);
  expect(s.knowledge[b].people[unknown]).toBeUndefined();
});
it("limits a six-half-hour summary encounter to one event each, with no shared source mutation",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  for(let i=0;i<10;i++)recordEvent(s,"harvest",[c],[],{quantity:i+1,audienceIds:[a]});
  s.knowledge[b]={people:{},feelings:{},events:[],spokenSources:{old:{speakerId:c}}};
  s.ecs.personable[c].dead=true;s.ecs.personable[b].age=30;
  s.social={lastSeason:0,courtships:{},avoidance:{}};
  const before=JSON.stringify(s),next=historyStep(s,1);
  expect(JSON.stringify(s)).toBe(before);
  expect(next.knowledge[b].events.filter(id=>s.events.some(e=>e.id==id))).toHaveLength(1);
  expect(Object.values(next.knowledge[b].spokenSources).filter(x=>x.speakerId==a)).toHaveLength(1);
});
it("keeps the same small budget across all three completed conversations in a live visit",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  const events=Array.from({length:8},()=>recordEvent(s,"harvest",[c],[],{quantity:3,audienceIds:[a]}));
  for(const [id,other] of [[a,b],[b,a]])s.ecs.planner[id].world.social={partnerId:other,stage:"visiting"};
  for(let i=0;i<3;i++)expect(chatTogether(s,a,b)).toBe(true);
  expect(s.knowledge[b].events.filter(id=>events.some(e=>e.id==id))).toHaveLength(1);
});
it("applies kin reactions once across repeated hearing and preserves the first spoken source",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  s.ecs.kinship[b].children=[c];s.ecs.kinship[c].parents=[b];
  const e=recordEvent(s,"quarrel",[a,c],[],{audienceIds:[a]});
  const before=s.ecs.relationships[b].known[a].goodwill;
  chatTogether(s,a,b);
  const after=s.ecs.relationships[b].known[a].goodwill;
  expect(after).toBe(before+1-3);
  const source={...s.knowledge[b].spokenSources[e.id]};
  learnEvent(s,b,e);chatTogether(s,a,b);
  expect(s.ecs.relationships[b].known[a].goodwill).toBe(after+1);
  expect(s.knowledge[b].spokenSources[e.id]).toEqual(source);
});
it("rechecks disclosure if learning the first story lowers the second teller's trust",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  s.ecs.kinship[b].children=[c];s.ecs.kinship[c].parents=[b];
  s.ecs.relationships[b].known[a]={ring:"personal",goodwill:31,base:31};
  recordEvent(s,"quarrel",[a,c],[],{audienceIds:[a]});
  const gift=recordEvent(s,"gift",[b,c],[],{audienceIds:[b]});
  expect(chatTogether(s,a,b)).toBe(true);
  expect(s.ecs.relationships[b].known[a].ring).toBe("social");
  expect(s.knowledge[a].events).not.toContain(gift.id);
});
it("prefers distant or hostile audiences for bad news and close ones for good news, below hard exclusions",()=>{
  const {state:s,person:a,parent:b,sibling:c,player:p}=setup();
  s.ecs.relationships[a].known[p]={ring:"intimate",goodwill:70};
  s.ecs.relationships[b].known[c]={ring:"public",goodwill:0};
  s.ecs.relationships[p].known[c]={ring:"personal",goodwill:40};
  const bad=recordEvent(s,"defiance",[c],[],{audienceIds:[a]}),good=recordEvent(s,"marriage",[c],[],{audienceIds:[a]});
  expect(newsPreference(s,a,b,bad)).toBeGreaterThan(newsPreference(s,a,p,bad));
  expect(newsPreference(s,a,p,good)).toBeGreaterThan(newsPreference(s,a,b,good));
  s.ecs.relationships[b].known[c].goodwill=-4;
  expect(newsPreference(s,a,b,bad)).toBeGreaterThan(newsPreference(s,a,p,bad));
  s.ecs.kinship[c].spouse=p;s.ecs.kinship[p].spouse=c;s.ecs.kinship[b].children=[c];s.ecs.kinship[c].parents=[b];
  const privateFamily=recordEvent(s,"quarrel",[c,p],[],{audienceIds:[a]});
  expect(chooseNews(s,a,b)?.id).not.toBe(privateFamily.id);
});
it("uses eligible news preferences to choose a listener among otherwise equal social companions",()=>{
  const {state:s,person:a,parent:b,sibling:c,player:p}=setup();
  s.ecs.relationships[b].known[p]={ring:"public",goodwill:0};s.ecs.relationships[c].known[p]={ring:"personal",goodwill:40};
  recordEvent(s,"defiance",[p],[],{audienceIds:[a]});
  expect(compareSocial(s,a,b,c)).toBeLessThan(0);
});
it("refreshes candidate caches after appended learning and current disclosure changes",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  const first=recordEvent(s,"quarrel",[a,c],[],{audienceIds:[a]});
  expect(chooseNews(s,a,b)?.id).toBe(first.id);
  learnEvent(s,b,first);expect(chooseNews(s,a,b)).toBeUndefined();
  const next=recordEvent(s,"defiance",[c],[],{audienceIds:[a]});
  expect(chooseNews(s,a,b)?.id).toBe(next.id);
  s.ecs.relationships[a].known[b]={ring:"public",goodwill:0};
  expect(chooseNews(s,a,b)).toBeUndefined();
  s.ecs.relationships[a].known[b]={ring:"personal",goodwill:40};
  expect(chooseNews(s,a,b)?.id).toBe(next.id);
});
it("ranks the newest unheard account within a repeated story, including an old anecdote learned later",()=>{
  const {state:s,person:a,parent:b,sibling:c}=setup();
  const newest=recordEvent(s,"harvest",[c],[],{quantity:8,day:s.days-.1,audienceIds:[a]});
  const older=recordEvent(s,"harvest",[c],[],{quantity:3,day:s.days-4,audienceIds:[a]});
  expect(chooseNews(s,a,b).id).toBe(newest.id);
  learnEvent(s,b,newest);expect(chooseNews(s,a,b).id).toBe(older.id);
  const latest=recordEvent(s,"harvest",[c],[],{quantity:9,day:s.days,audienceIds:[a]});
  expect(chooseNews(s,a,b).id).toBe(latest.id);
});
it("carries heard news and its original source on an NPC's real world journey, then tells a new local",async()=>{
  const {s,ids}=community(),[p,a,b]=ids,away=community({namespace:"away-",key:"6,5",player:false});
  attach(s,away.s);
  s.ecs.relationships[a].known[p]={ring:"public",goodwill:0};
  const event=recordEvent(s,"harvest",[p],[],{quantity:5,audienceIds:[a]});
  expect(chatTogether(s,a,b)).toBe(true);expect(s.knowledge[b].spokenSources[event.id].speakerId).toBe(a);
  const original={...s.knowledge[b].spokenSources[event.id]};
  departNpc(s,b,{to:"6,5",side:0});s.days+=DAYS_IN_SEASON;
  await advanceWorldClock(s);
  const dest=s.travel.maps["6,5"],local=away.ids[1];
  expect(dest.residents[b]).toBe(true);expect(dest.knowledge[b].events).toContain(event.id);
  expect(dest.knowledge[b].people[p]).toEqual({traits:[]});
  expect(dest.knowledge[b].spokenSources[event.id]).toEqual(original);
  // Keep this exchange's only unheard story explicit; the journey's occurrence
  // events and offscreen encounters have their own existing audiences.
  for(const e of dest.events)if(e.id!=event.id)learnEvent(dest,local,e);
  expect(dest.knowledge[local].events).not.toContain(event.id);
  expect(chatTogether(dest,b,local,true)).toBe(true);
  expect(dest.knowledge[local].events).toContain(event.id);
  expect(dest.knowledge[local].people[p]).toEqual({traits:[]});
  expect(dest.knowledge[local].spokenSources[event.id].speakerId).toBe(b);
  expect(dest.knowledge[b].spokenSources[event.id]).toEqual(original);
});

it("scores the latest learned permitted account after trust changes, hearing and a delayed import", () => {
  const { listenerNewsScore } = require("game/news");
  const { state:s, person:a, parent:b, sibling:c } = setup();
  const publicNews = recordEvent(s,"defiance",[c],[],{audienceIds:[a]});
  const privateNews = recordEvent(s,"gift",[c,a],[],{day:s.days-20,audienceIds:[a]});
  // Learning order governs this companion score, even for older anecdotes.
  expect(listenerNewsScore(s,a,b)).toBe(newsPreference(s,a,b,privateNews));
  s.ecs.relationships[a].known[b].ring="public";
  expect(listenerNewsScore(s,a,b)).toBe(newsPreference(s,a,b,publicNews));
  s.ecs.relationships[a].known[b].ring="personal";
  learnEvent(s,b,privateNews);
  expect(listenerNewsScore(s,a,b)).toBe(newsPreference(s,a,b,publicNews));
  learnEvent(s,b,publicNews);
  s.knowledge[a].events.push("remote-news");
  expect(listenerNewsScore(s,a,b)).toBe(0);
  const imported={...publicNews,id:"remote-news",people:[c],day:s.days-30};
  s.events.push(imported);
  expect(listenerNewsScore(s,a,b)).toBe(newsPreference(s,a,b,imported));
});

it("keeps learning-order ties when a newer story in another group is already heard or sealed", () => {
  const { state:s, person:a, parent:b, sibling:c } = setup();
  const first=recordEvent(s,"harvest",[c],[],{day:2,audienceIds:[a]});
  const second=recordEvent(s,"marriage",[c],[],{day:2,audienceIds:[a]});
  const recent=recordEvent(s,"marriage",[c],[],{day:3,audienceIds:[a]});
  const sealed=recordEvent(s,"harvest",[c],[],{day:4,sealed:true});
  s.knowledge[a].events.push(sealed.id);
  learnEvent(s,b,recent);
  expect(chooseNews(s,a,b)?.id).toBe(first.id);
  learnEvent(s,b,first);
  expect(chooseNews(s,a,b)?.id).toBe(second.id);
});
