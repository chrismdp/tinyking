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
