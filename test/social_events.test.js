/* global require, expect, it */
import { peopleWorld } from "./support/people";
import { condition, conditions, maritalSatisfaction } from "game/social_conditions";
import { recordEvent, learnEvent, withEventIndex } from "game/events";
import TYPES from "data/event_types.json";

const P=(test,args)=>({test,args});
export function fixture() {
  const w=peopleWorld(), {state:s,person:a,sibling:b,parent:spouse,player:listener}=w;
  for(const id of [a,b,spouse,listener])s.ecs.kinship[id]={parents:[],children:[],spouse:null};
  s.ecs.kinship[a].spouse=spouse;s.ecs.kinship[spouse].spouse=a;
  for(const [x,y,g] of [[a,spouse,-12],[spouse,a,66],[a,b,66],[b,a,66]])s.ecs.relationships[x].known[y]={ring:g>=60?"intimate":"public",goodwill:g,base:g};
  return {...w,a,b,spouse,listener};
}
it("shares pure directional tests with explicit roles and rejects missing people",()=>{
  const {state:s,a,b,spouse,listener}=fixture(), bindings={actor:a,partner:b,spouse,subject:b,teller:a,listener};
  const before=JSON.stringify(s);
  expect(conditions(s,bindings,{all:[P("ring_at_least",{person:"actor",towards:"partner",ring:"personal"}),P("has_trait",{person:"actor",trait:"generous"})],none:[P("close_kin",{a:"actor",b:"partner"})]})).toBe(true);
  expect(condition(s,bindings,P("goodwill_below",{person:"actor",towards:"spouse",value:0}))).toBe(true);
  expect(condition(s,bindings,P("goodwill_at_least",{person:"spouse",towards:"actor",value:60}))).toBe(true);
  expect(condition(s,bindings,P("goodwill_below",{person:"absent",towards:"actor",value:10}))).toBe(false);
  expect(condition(s,bindings,P("same_person",{a:"absent",b:"missing"}))).toBe(false);
  expect(conditions(s,bindings,{none:[P("typo",{})]})).toBe(false);
  expect(JSON.stringify(s)).toBe(before);
});
it("computes marital satisfaction independently in each direction from current goodwill and avoidance",()=>{
  const {state:s,a,spouse,b}=fixture();
  expect(maritalSatisfaction(s,a)).toBeLessThan(30);
  expect(maritalSatisfaction(s,spouse)).toBeGreaterThan(60);
  expect(maritalSatisfaction(s,b)).toBeNull();
  const before=maritalSatisfaction(s,spouse);
  s.social={avoidance:{[[a,spouse].sort().join(":")]:s.days+7}};
  expect(maritalSatisfaction(s,spouse)).toBeLessThan(before);
});
it("declares kin effects in the catalogue and applies each only on first learning",()=>{
  const {state:s,person:a,sibling:b,player}=peopleWorld();
  expect(TYPES.quarrel.onLearn.length).toBeGreaterThan(0);
  const event=recordEvent(s,"quarrel",[player,b],[],{audienceIds:[]});
  learnEvent(s,a,event);
  expect(s.ecs.relationships[a].known[player].goodwill).toBe(-3);
  learnEvent(s,a,event);
  expect(s.ecs.relationships[a].known[player].goodwill).toBe(-3);
  expect(s.knowledge[a].reactions[event.id]).toBeDefined();
});
it.each([false,true])("keeps affairs to participants and actual witnesses, including indexed history (%s)",indexed=>{
  const {state:s,a,b,spouse,listener}=fixture();
  s.ecs.spatial[spouse].x+=1000;s.ecs.spatial[listener].x+=1000;
  const run=()=>recordEvent(s,"affair",[a,b]);
  const event=indexed?withEventIndex(s,run):run();
  expect(s.knowledge[a].events).toContain(event.id);expect(s.knowledge[b].events).toContain(event.id);
  expect(s.knowledge[spouse]?.events||[]).not.toContain(event.id);
  expect(s.knowledge[listener]?.events||[]).not.toContain(event.id);
  const before=s.ecs.relationships[spouse].known[a].goodwill;
  learnEvent(s,spouse,event);
  expect(s.ecs.relationships[spouse].known[a].goodwill).toBeLessThan(before-20);
  expect(s.events.filter(e=>e.type=="quarrel"&&e.reason=="affair_discovery")).toHaveLength(1);
  learnEvent(s,spouse,event);
  expect(s.events.filter(e=>e.type=="quarrel"&&e.reason=="affair_discovery")).toHaveLength(1);
});

it("supports a JSON action on contact and deduplicates reversed pairs in one moment",()=>{
  const {runSocialActions}=require("game/social_actions");
  const {state:s,a,b}=fixture();
  const actions=[{id:"authored_example",hooks:["contact","season"],chance:1,when:{all:[P("is_adult",{person:"actor"})]},event:{type:"gift",people:["actor","partner"]}}];
  expect(runSocialActions(s,"contact",a,b,{actions})).toHaveLength(1);
  expect(runSocialActions(s,"contact",b,a,{actions})).toHaveLength(0);
  s.days+=1;
  expect(runSocialActions(s,"contact",a,b,{actions})).toHaveLength(1);
});
it("quarrels repeatedly between low-goodwill spouses despite a like disposition",()=>{
  const {chatTogether}=require("game/social");
  const {state:s,a,spouse}=fixture();
  for(let day=0;day<140;day++){s.days=day;chatTogether(s,a,spouse,true,6);}
  expect(s.events.filter(e=>e.type=="quarrel")).not.toHaveLength(0);
  expect(s.events.filter(e=>e.type=="quarrel").length).toBeGreaterThan(3);
});
it("forms romance only through mutual attraction between unrelated adults; mutual closeness alone fails",()=>{
  const {runSocialActions}=require("game/social_actions");
  const {state:s,a,b,spouse}=fixture();
  for(let d=0;d<60;d++){s.days=d;runSocialActions(s,"contact",a,b);}
  expect(s.ecs.relationships[a].known[b].romance).toBeUndefined();
  s.opinionThresholds={hate:-100,love:-50};
  for(let d=60;d<120;d++){s.days=d;runSocialActions(s,"contact",a,b);}
  expect(s.ecs.relationships[a].known[b].romance).toBeDefined();
  expect(s.ecs.kinship[a].spouse).toBe(spouse);
  s.ecs.kinship[b].parents=[a];delete s.ecs.relationships[a].known[b].romance;delete s.ecs.relationships[b].known[a].romance;
  for(let d=120;d<150;d++){s.days=d;runSocialActions(s,"contact",a,b);}
  expect(s.ecs.relationships[a].known[b].romance).toBeUndefined();
});
it("begins only one affair for an unhappy married romantic pair, and excludes close kin from gossip",()=>{
  const {runSocialActions}=require("game/social_actions");
  const {canDiscloseEvent}=require("game/people");
  const {exchangeNews}=require("game/news");
  const {state:s,a,b,spouse,listener}=fixture();s.generatingHistory=true;
  for(const [x,y] of [[a,b],[b,a]])s.ecs.relationships[x].known[y].romance={since:0};
  for(let day=0;day<80;day++){s.days=day;runSocialActions(s,"contact",a,b);}
  const affairs=s.events.filter(e=>e.type=="affair");expect(affairs).toHaveLength(1);
  const event=affairs[0];
  expect(s.knowledge[spouse]?.events||[]).not.toContain(event.id);
  s.ecs.relationships[a].known[listener]={ring:"intimate",goodwill:66};
  delete s.ecs.playable[listener];
  expect(canDiscloseEvent(s,a,listener,event)).toBe(true);
  exchangeNews(s,a,listener);expect(s.knowledge[listener].events).toContain(event.id);
  s.ecs.relationships[a].known[spouse]={ring:"intimate",goodwill:66};
  expect(canDiscloseEvent(s,a,spouse,event)).toBe(false);
});

it("preserves new state through save/reload and owns seasonal copies",()=>{
  const {serialiseGame,restoreGame}=require("game/save_game");
  const {historyStep}=require("game/social");
  const {runSocialActions}=require("game/social_actions");
  const {state:s,a,b}=fixture();s.generatingHistory=true;
  recordEvent(s,"affair",[a,b]);
  runSocialActions(s,"contact",a,b);
  const restored=restoreGame(serialiseGame(s));
  expect(restored.ecs.relationships).toEqual(s.ecs.relationships);
  expect(restored.knowledge).toEqual(s.knowledge);
  const before=JSON.stringify(restored),next=historyStep(restored,1);
  expect(JSON.stringify(restored)).toBe(before);
  expect(next).not.toBe(restored);
});
it("carries romance, affair, reaction and attempt records through actual travel and knowledge merges",async()=>{
  const {community,attach}=require("./support/travel");
  const {completeTravel}=require("game/travel");
  const {neighbours,worldKey}=require("game/travel_geometry");
  const {skipIntro}=require("game/intro");
  const {runSocialActions}=require("game/social_actions");
  const home=community(),s=home.s,[player,lover,spouse]=home.ids;
  const away=community({namespace:"away-",key:worldKey(neighbours(s.world.home)[0]),player:false});
  attach(s,away.s);
  s.ecs.kinship[player].spouse=spouse;s.ecs.kinship[spouse].spouse=player;
  s.summarisingHistory=true;
  const e=recordEvent(s,"affair",[player,lover]);
  const betrayal=recordEvent(s,"affair",[spouse,lover]);delete s.summarisingHistory;
  learnEvent(s,player,betrayal);
  s.ecs.relationships[player].known[lover].romance={since:0};
  runSocialActions(s,"contact",player,lover,{actions:[{id:"test_attempt",hooks:["contact"],chance:0}]});
  const reactions={...s.knowledge[player].reactions},moments={...s.ecs.relationships[player].actionMoments};
  await completeTravel(s,{destination:away.s.map.worldKey,side:0});skipIntro(s);
  expect(s.ecs.relationships[player].known[lover]).toMatchObject({romance:{since:0},affair:{eventId:e.id}});
  expect(s.ecs.relationships[player].actionMoments).toEqual(moments);
  expect(s.knowledge[player].reactions).toEqual(reactions);
  const before=JSON.stringify(s.ecs.relationships[player]);learnEvent(s,player,e);learnEvent(s,player,betrayal);
  expect(JSON.stringify(s.ecs.relationships[player])).toBe(before);
  await completeTravel(s,{destination:home.s.map.worldKey,side:3});skipIntro(s);
  expect(s.knowledge[player].events.filter(id=>id==e.id)).toHaveLength(1);
  expect(s.knowledge[player].reactions).toMatchObject(reactions);
});
it("binds unhappy-marriage wording only to a genuinely unhappy living spouse at Personal trust",()=>{
  const {openChat,lineCandidates}=require("game/chat");
  const {state:s,a,listener,spouse}=fixture();
  s.ecs.relationships[a].known[listener]={ring:"personal",goodwill:36};
  s.ecs.spatial[listener]={...s.ecs.spatial[a],x:s.ecs.spatial[a].x-45};
  expect(openChat(s,listener,a)).toBe(true);s.chat.active.phase="reply";
  const rows=()=>lineCandidates(s,s.chat.active,"family_answer","npc").filter(l=>l.situation=="unhappy_marriage");
  expect(rows().length).toBeGreaterThan(0);
  s.knowledge[listener].kinLinks={};
  for(const l of require("game/chat_facts").kinLinks(s,a))s.knowledge[listener].kinLinks[l.id]=true;
  expect(rows().length).toBeGreaterThan(0);
  s.ecs.relationships[a].known[spouse].goodwill=66;expect(rows()).toHaveLength(0);
});

it("requires an awake unobstructed witness and never infers witnesses from summary coordinates",()=>{
  const {state:s,a,b,spouse,listener}=fixture();
  s.ecs.planner[spouse].task=["sleep"];
  s.ecs.spatial[a]={x:0,y:0};s.ecs.spatial[b]={x:5,y:0};
  s.ecs.spatial[listener]={x:60,y:0};s.ecs.spatial[spouse]={x:10,y:0};
  s.ecs.building={wall:{rooms:[]}};s.ecs.treeClearance={wall:{x:30,y:0,halfWidth:5,halfDepth:20,angle:0}};
  const event=recordEvent(s,"affair",[a,b]);
  expect(s.knowledge[listener]?.events||[]).not.toContain(event.id);
  expect(s.knowledge[spouse]?.events||[]).not.toContain(event.id);
  s.ecs.building={};s.ecs.treeClearance={};s.ecs.planner[spouse].task=null;
  const witnessed=recordEvent(s,"romance",[a,b]);
  expect(s.knowledge[spouse].events).toContain(witnessed.id);
  expect(s.knowledge[spouse].discoveries[witnessed.id].kind).toBe("witness");
  s.summarisingHistory=true;const summary=recordEvent(s,"affair",[a,b]);
  expect(s.knowledge[spouse].events).not.toContain(summary.id);
});

it.each(["parent","child","sibling","friend"])("withholds affair gossip from a subject's %s despite Intimate teller trust",kind=>{
  const {canDiscloseEvent}=require("game/people");
  const {state:s,a,b,listener}=fixture();s.generatingHistory=true;
  const event=recordEvent(s,"affair",[a,b]);
  s.ecs.relationships[b].known[listener]={ring:"intimate",goodwill:66};
  if(kind=="parent"){s.ecs.kinship[a].parents=[listener];s.ecs.kinship[listener].children=[a];}
  if(kind=="child"){s.ecs.kinship[a].children=[listener];s.ecs.kinship[listener].parents=[a];}
  if(kind=="sibling"){s.ecs.kinship.ancestor={parents:[],children:[a,listener]};s.ecs.kinship[a].parents=["ancestor"];s.ecs.kinship[listener].parents=["ancestor"];}
  if(kind=="friend")s.ecs.relationships[listener].known[a]={ring:"personal",goodwill:36};
  expect(canDiscloseEvent(s,b,listener,event)).toBe(false);
});
it("does not invent witnesses when the contact hook is invoked directly in summary mode",()=>{
  const {runSocialActions}=require("game/social_actions");
  const {state:s,a,b,spouse}=fixture();
  const [{event}]=runSocialActions(s,"contact",a,b,{summary:true,actions:[{id:"summary_privacy",hooks:["contact"],chance:1,event:{type:"affair",people:["actor","partner"]}}]});
  expect(s.knowledge[spouse]?.events||[]).not.toContain(event.id);
});

it("includes an arrived player in seasonal household quarrels without forcing a chosen visit",()=>{
  const {advanceSeason}=require("game/social");
  const {state:s,player,person:a}=peopleWorld();
  s.ecs.playable[player].arrivedAt=0;
  s.ecs.kinship[player].spouse=a;s.ecs.kinship[a].spouse=player;
  s.ecs.relationships[player].known[a]={ring:"public",goodwill:-12,base:-12};
  s.ecs.relationships[a].known[player]={ring:"public",goodwill:-12,base:-12};
  s.ecs.personable[a].lastBirth=100;
  for(let season=1;season<=12;season++){s.days=season*7;advanceSeason(s,season);}
  expect(s.events.some(e=>e.type=="quarrel"&&e.people.includes(a)&&e.people.includes(player))).toBe(true);
});
