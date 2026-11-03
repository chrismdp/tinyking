/* global it, expect, require */
import { peopleWorld } from "./support/people";
import { recordEvent, learnEvent, knownEvents } from "game/events";
import { canDiscloseEvent, goodwillTowards } from "game/people";
import { exchangeNews } from "game/news";
import { socialHour } from "game/social_visits";
import { socialise } from "game/tasks";
import { Task, solve, runTask } from "game/htn";
import { DAYS_IN_SEASON } from "game/time";
import { lifeClockSeasons } from "game/social_clock";
import { historySecretActivities, startSecretActivity } from "game/secret_activities";
import { rebuildPopulationIndex as indexPeople, nearbyPeople } from "game/population_index";

function fixture() {
  const f=peopleWorld(),{state:s,person:a,sibling:b,parent:spouse,player:friend,tiles}=f;
  for(const id of [a,b,spouse,friend])s.ecs.kinship[id]={parents:[],children:[],spouse:null};
  for(const id of [a,b])s.ecs.personality[id].orientation="same";
  s.ecs.kinship[a].spouse=spouse;s.ecs.kinship[spouse].spouse=a;
  for(const [x,y] of [[a,b],[b,a],[spouse,a],[a,friend],[friend,a]])s.ecs.relationships[x].known[y]={ring:"intimate",goodwill:66,base:66};
  s.ecs.household[b].houseId=tiles[5];
  s.generatingHistory=true;const event=recordEvent(s,"affair",[a,b]);delete s.generatingHistory;
  for(const id of [a,b,spouse,friend])s.ecs.planner[id].task=["wait_for",.5/24];
  return {...f,a,b,spouse,friend,event};
}

it("lets only lovers confide their own affair to an Intimate non-kin friend",()=>{
  const {state:s,a,b,friend,event,spouse}=fixture();
  expect(canDiscloseEvent(s,a,friend,event)).toBe(true);
  s.ecs.relationships[a].known[friend].ring="personal";
  expect(canDiscloseEvent(s,a,friend,event)).toBe(false);
  s.ecs.relationships[a].known[friend].ring="intimate";
  s.ecs.kinship[friend].parents=[b];s.ecs.kinship[b].children=[friend];
  expect(canDiscloseEvent(s,a,friend,event)).toBe(false);
  expect(canDiscloseEvent(s,a,spouse,event)).toBe(false);
});

it.each(["loyalty","spite"])("allows affair gossip to a spouse through %s and records one discovery",route=>{
  const {state:s,a,b,friend,spouse,event}=fixture();delete s.ecs.playable[friend];
  learnEvent(s,friend,event,"witness");
  s.ecs.relationships[friend].known[spouse]={ring:"public",goodwill:0};
  s.ecs.relationships[friend].known[a]={ring:"public",goodwill:0};
  if(route=="loyalty")s.ecs.relationships[spouse].known[friend]={ring:"personal",goodwill:36};
  else s.ecs.relationships[friend].known[a]={ring:"public",goodwill:-10};
  expect(canDiscloseEvent(s,friend,spouse,event)).toBe(true);
  exchangeNews(s,friend,spouse);
  const found=s.events.filter(e=>e.type=="found_out");expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({people:[spouse,a,b],causeEventId:event.id});
  expect(s.knowledge[spouse].discoveries[event.id].kind).toBe("heard");
  expect(goodwillTowards(s,spouse,a)).toBeLessThanOrEqual(0);
  expect(goodwillTowards(s,spouse,b)).toBeLessThanOrEqual(-40);
  expect(s.social.avoidance[[a,spouse].sort().join(":")]).toBe(s.days+lifeClockSeasons(1)*DAYS_IN_SEASON);
  expect(s.events.filter(e=>e.type=="quarrel"&&e.reason=="affair_discovery")).toHaveLength(1);
  const before=JSON.stringify(s.ecs.relationships);learnEvent(s,spouse,event);learnEvent(s,spouse,found[0]);
  expect(JSON.stringify(s.ecs.relationships)).toBe(before);
  expect(s.events.filter(e=>e.type=="found_out")).toHaveLength(1);
});

it("blocks unqualified tellers, lovers, other close family and lovers' friends",()=>{
  const {state:s,a,b,friend,spouse,event}=fixture();
  expect(canDiscloseEvent(s,friend,spouse,event)).toBe(false);
  s.ecs.relationships[a].known[spouse]={ring:"intimate",goodwill:66};
  expect(canDiscloseEvent(s,a,spouse,event)).toBe(false);
  s.ecs.relationships[spouse].known[friend]={ring:"intimate",goodwill:66};
  expect(canDiscloseEvent(s,spouse,friend,event)).toBe(false);
  s.ecs.kinship[friend].parents=[b];s.ecs.kinship[b].children=[friend];
  expect(canDiscloseEvent(s,a,friend,event)).toBe(false);
});

it("found_out teaches the underlying affair and data effects once to family and friends",()=>{
  const {state:s,a,b,spouse,friend,event}=fixture();
  s.ecs.relationships[friend].known[a]={ring:"public",goodwill:0};
  s.ecs.relationships[friend].known[b]={ring:"public",goodwill:0};
  s.ecs.relationships[friend].known[spouse]={ring:"personal",goodwill:36};
  s.ecs.spatial[friend].x+=2000;indexPeople(s);
  learnEvent(s,spouse,event,"witness");
  const found=s.events.find(e=>e.type=="found_out");
  s.ecs.relationships[spouse].known[friend]={ring:"personal",goodwill:36};
  expect(canDiscloseEvent(s,spouse,friend,found)).toBe(true);
  learnEvent(s,friend,found);
  expect(s.knowledge[friend].events).toContain(event.id);
  expect(goodwillTowards(s,friend,a)).toBe(-15);expect(goodwillTowards(s,friend,b)).toBe(-15);
  learnEvent(s,friend,found);expect(goodwillTowards(s,friend,a)).toBe(-15);
});

it("lovers' kin lose regard for the unfaithful partner upon learning found_out",()=>{
  const {state:s,a,b,spouse,friend,event}=fixture();
  s.ecs.kinship[friend].parents=[b];s.ecs.kinship[b].children=[friend];
  s.ecs.relationships[friend].known[a]={ring:"public",goodwill:0};
  s.ecs.spatial[friend].x+=2000;indexPeople(s);
  learnEvent(s,spouse,event,"witness");
  learnEvent(s,friend,s.events.find(e=>e.type=="found_out"));
  expect(goodwillTowards(s,friend,a)).toBe(-8);
});

it("witnesses the affair starting by the same indexed distance, sleep, interior and wall rules",()=>{
  const {state:s,a,b,spouse,friend}=fixture();
  s.ecs.spatial[a]={x:0,y:0};s.ecs.spatial[b]={x:5,y:0};s.ecs.spatial[spouse]={x:10,y:0};s.ecs.spatial[friend]={x:84,y:0};
  indexPeople(s);
  expect(new Set(nearbyPeople(s,s.ecs.spatial[a],85))).toEqual(new Set([a,b,spouse,friend]));
  // Enumeration after indexing is forbidden: witness queries use nearby hexes.
  const people=s.ecs.personable;
  s.ecs.personable=new Proxy(people,{ownKeys(){throw new Error("population scan");}});
  const visible=recordEvent(s,"romance",[a,b]);
  expect(s.knowledge[friend].events).toContain(visible.id);
  s.ecs.personable=people;
  const e=recordEvent(s,"affair",[a,b]);
  expect(s.knowledge[spouse].discoveries[e.id].kind).toBe("witness");
  expect(s.knowledge[friend].events).toContain(e.id);
  s.ecs.planner[spouse].task=["sleep"];s.ecs.interior={[friend]:{buildingId:"elsewhere"}};
  const hidden=recordEvent(s,"romance",[a,b]);
  expect(s.knowledge[spouse].events).not.toContain(hidden.id);expect(s.knowledge[friend].events).not.toContain(hidden.id);
  delete s.ecs.interior[friend];
  s.ecs.building={wall:{rooms:[]}};s.ecs.treeClearance={wall:{x:40,y:0,halfWidth:5,halfDepth:20,angle:0}};
  const walled=recordEvent(s,"romance",[a,b]);expect(s.knowledge[friend].events).not.toContain(walled.id);
});

it("physically walks both lovers to a meeting, witnesses it during contact, and returns them home",()=>{
  const {state:s,a,b,spouse,friend,event,tiles}=fixture();
  s.days=18/24;for(const id of [a,b])s.ecs.planner[id].world.days=s.days;
  const destination={...s.ecs.spatial[tiles[2]]};
  expect(startSecretActivity(s,event,"affair_meeting",{point:destination,kind:"woods"})).toBe(true);
  for(const id of [a,b]) {
    const p=s.ecs.planner[id];const [plan]=solve(p.world,[],[["social_visit"]]);
    expect(plan.map(t=>t[0])).toEqual(["walk_to","socialise","return_from_visit","walk_to","end_visit","set_label","sleep"]);
    p.plan=plan;p.task=p.plan.shift();
    for(let i=0;p.task&&i<500;i++)runTask(s,p,1/1440,i==0);
    expect(p.task).toBeNull();expect(Math.hypot(s.ecs.spatial[id].x-destination.x,s.ecs.spatial[id].y-destination.y)).toBeLessThan(65);
    p.task=p.plan.shift();
  }
  s.ecs.spatial[spouse]={...destination};s.ecs.spatial[friend]={...destination};indexPeople(s);
  expect(socialise(s,a,s.ecs.planner[a].world,0,true,b)).toBe(Task.CONTINUE);
  expect(knownEvents(s,friend)).toContain(event);expect(s.knowledge[spouse].discoveries[event.id].kind).toBe("witness");
  s.days+=.5/24;
  expect(socialise(s,a,s.ecs.planner[a].world,0,false,b)).toBe(Task.FINISH);
  // Finish the same physical plans through returning home and starting sleep.
  for(const id of [a,b]) {
    const p=s.ecs.planner[id];s.ecs.personable[id].tiredness=.5;
    for(let i=0;i<1000 && p.task?.[0]!="sleep";i++) {
      const first=!p.task;
      if(first)p.task=p.plan.shift();
      runTask(s,p,1/1440,first);
    }
    expect(p.task?.[0]).toBe("sleep");
    expect(Math.hypot(s.ecs.spatial[id].x-s.ecs.spatial[p.world.places.sleep].x,s.ecs.spatial[id].y-s.ecs.spatial[p.world.places.sleep].y)).toBeLessThan(10);
  }
});

it("checks only three meeting moments and notices a witness arriving part way through",()=>{
  const {state:s,a,b,friend,event,tiles}=fixture();s.days=18/24;
  const point={...s.ecs.spatial[tiles[3]]};
  startSecretActivity(s,event,"affair_meeting",{point,kind:"woods"});
  s.ecs.spatial[friend].x+=2000;s.ecs.spatial[a]={...point};s.ecs.spatial[b]={...point};indexPeople(s);
  for(const id of [a,b])s.ecs.planner[id].task=["socialise",id==a?b:a];
  socialise(s,a,s.ecs.planner[a].world,0,true,b);
  expect(s.knowledge[friend]?.events||[]).not.toContain(event.id);
  s.ecs.spatial[friend]={...point};indexPeople(s);s.days+=.25/24;
  socialise(s,b,s.ecs.planner[b].world,0,false,a);
  expect(s.knowledge[friend].events).toContain(event.id);
  for(let i=0;i<100;i++)socialise(s,a,s.ecs.planner[a].world,0,false,b);
  expect(s.ecs.planner[a].world.social.witnessChecks).toBe(2);
});

it("seasonal meetings use seeded neighbour or housemate witnesses without live coordinates",()=>{
  const run=()=>{
    const {state:s,a,b,spouse,friend,event}=fixture();delete s.ecs.playable[friend];
    s.ecs.village[friend].villageId="other";s.ecs.household[friend].houseId="far";
    for(const id of [a,b,spouse,friend])delete s.ecs.spatial[id];
    for(let season=1;season<=80;season++){s.days=season*7;historySecretActivities(s,[a,b,spouse,friend],season, {affair_meeting:{chance:1}});}
    expect(s.knowledge[spouse].discoveries[event.id].kind).toBe("witness");
    expect(s.knowledge[friend]?.events||[]).not.toContain(event.id);
    expect(s.events.filter(e=>e.type=="found_out")).toHaveLength(1);
    return s.events;
  };
  expect(run()).toEqual(run());
});

it("offers evening meetings from actual affair bonds, once per day and never while hungry",()=>{
  const {state:s,a,b}=fixture();s.days=18/24;
  for(const id of [a,b])s.ecs.planner[id].world.feeling.hungry=true;
  socialHour(s);expect(s.ecs.planner[a].world.social).toBeUndefined();
});

it("chooses only vacant homes or actual woodland and leaves busy households alone",()=>{
  const {activityPlace}=require("game/secret_activities");
  const {state:s,event,tiles}=fixture();s.days=18/24;
  s.villages.village.houses=[tiles[2]];s.ecs.building={[tiles[2]]:{rooms:[]}};
  const place=activityPlace(s,event,"affair_meeting");expect(place).toMatchObject({kind:"house",houseId:tiles[2]});
  s.ecs.household[s.ui.playerId].houseId=tiles[2];s.ecs.spatial[s.ui.playerId]={...s.ecs.spatial[tiles[2]]};
  expect(activityPlace(s,event,"affair_meeting")).toBeUndefined();
  (s.ecs.good ||= {})[tiles[1]]={type:"wood"};
  expect(activityPlace(s,event,"affair_meeting")).toMatchObject({kind:"woods"});
});

it("rare confidences have a stable seasonal chance rather than a roll on every conversation",()=>{
  const {newsPreference}=require("game/news");
  const {state:s,a,friend,event}=fixture();
  delete s.ecs.playable[friend];
  const opportunities=[];
  for(let season=0;season<400;season++) {
    s.days=season*7;
    const weight=newsPreference(s,a,friend,event);
    for(let repeat=0;repeat<6;repeat++)expect(newsPreference(s,a,friend,event)).toBe(weight);
    if(weight) {
      if(!opportunities.length) {
        exchangeNews(s,a,friend);
        expect(s.knowledge[friend].events).toContain(event.id);
        expect(s.knowledge[friend].discoveries[event.id].kind).toBe("heard");
      }
      opportunities.push(season);
    }
  }
  expect(opportunities.length).toBeGreaterThan(0);expect(opportunities.length).toBeLessThan(32);
});

it("preserves meeting progress and first-learning effects through save/reload",()=>{
  const {serialiseGame,restoreGame}=require("game/save_game");
  const {state:s,a,b,event,friend,tiles}=fixture();s.days=18/24;
  const point={...s.ecs.spatial[tiles[3]]};
  startSecretActivity(s,event,"affair_meeting",{point,kind:"woods"});
  for(const id of [a,b]){s.ecs.spatial[id]={...point};s.ecs.planner[id].task=["socialise",id==a?b:a];}
  s.ecs.spatial[friend]={...point};indexPeople(s);
  socialise(s,a,s.ecs.planner[a].world,0,true,b);
  const restored=restoreGame(serialiseGame(s));restored.days+=.25/24;
  socialise(restored,a,restored.ecs.planner[a].world,0,false,b);
  expect(restored.events.filter(e=>e.type=="affair_meeting")).toHaveLength(1);
  expect(restored.events.filter(e=>e.type=="found_out")).toHaveLength(1);
  expect(restored.knowledge[friend].events.filter(id=>id==event.id)).toHaveLength(1);
});

it("excludes sleeping, dead, absent and distant neighbours at a meeting",()=>{
  const {state:s,a,b,spouse,friend,event,tiles}=fixture();s.days=18/24;
  const point={...s.ecs.spatial[tiles[3]]};startSecretActivity(s,event,"affair_meeting",{point,kind:"woods"});
  for(const id of [a,b,spouse,friend])s.ecs.spatial[id]={...point};
  for(const id of [a,b])s.ecs.planner[id].task=["socialise",id==a?b:a];
  s.ecs.planner[spouse].world.sleeping=true;s.ecs.planner[friend].task=["sleep"];indexPeople(s);
  socialise(s,a,s.ecs.planner[a].world,0,true,b);
  expect(s.knowledge[friend]?.events||[]).not.toContain(event.id);expect(s.knowledge[spouse]?.events||[]).not.toContain(event.id);
  s.ecs.planner[spouse].world.sleeping=false;s.ecs.planner[friend].task=["wait_for",1];
  s.ecs.personable[spouse].dead=true;s.residents={[a]:true,[b]:true};s.days+=.25/24;
  socialise(s,a,s.ecs.planner[a].world,0,false,b);
  expect(s.knowledge[friend]?.events||[]).not.toContain(event.id);expect(s.knowledge[spouse]?.events||[]).not.toContain(event.id);
});

it("keeps the caller's affair scheduling records unchanged across a history snapshot",()=>{
  const {historyStep}=require("game/social");
  const {state:s}=fixture();s.days=7;
  const before=JSON.stringify(s);
  historyStep(s,1);
  expect(JSON.stringify(s)).toBe(before);
});

it("plans sleep at home after the secret meeting, including an interrupted return",()=>{
  const {state:s,a,event,tiles}=fixture();s.days=18/24;
  startSecretActivity(s,event,"affair_meeting",{point:{...s.ecs.spatial[tiles[2]]},kind:"woods"});
  const p=s.ecs.planner[a];
  const [outbound]=solve(p.world,[],[["social_visit"]]);
  expect(outbound.at(-1)[0]).toBe("sleep");
  p.world.social.stage="returning";
  const [returning]=solve(p.world,[],[["social_visit"]]);
  expect(returning[0]).toEqual(["walk_to",p.world.social.homeId]);
  expect(returning.at(-1)[0]).toBe("sleep");
});

it("preserves the previous Personal disclosure route to a hostile outsider",()=>{
  const {state:s,a,friend,event}=fixture();
  s.ecs.relationships[a].known[friend]={ring:"personal",goodwill:36};
  s.ecs.relationships[friend].known[a]={ring:"public",goodwill:-10};
  expect(canDiscloseEvent(s,a,friend,event)).toBe(true);
});

it("finds newly created people through the spatial lookup before their first planner tick",()=>{
  const {newEntities}=require("game/entities");
  const {state:s,a,b}=fixture();indexPeople(s);
  const [newcomer]=newEntities(s,[{personable:{age:25},spatial:{...s.ecs.spatial[a],immovable:false}}]);
  const event=recordEvent(s,"romance",[a,b]);
  expect(s.knowledge[newcomer]?.events||[]).toContain(event.id);
  const {birth}=require("game/social");
  s.ecs.nameable[b].male=true;
  const child=birth(s,a,b,0);
  const later=recordEvent(s,"romance",[a,b]);
  expect(s.knowledge[child]?.events||[]).toContain(later.id);
});


it("runs poaching with the same activity, affected-owner, discovery and disclosure data",()=>{
  const {state:s,a,b,spouse:owner,friend,tiles}=fixture();
  s.generatingHistory=true;
  const pact=recordEvent(s,"poaching",[a,b,owner]);
  delete s.generatingHistory;
  expect(s.knowledge[owner]?.events||[]).not.toContain(pact.id);
  s.days=18/24;
  const point={...s.ecs.spatial[tiles[2]]};
  expect(startSecretActivity(s,pact,"poaching_trip",{point,kind:"woods"})).toBe(true);
  for(const id of [a,b]){s.ecs.spatial[id]={...point};s.ecs.planner[id].task=["socialise",id==a?b:a];}
  s.ecs.spatial[owner]={...point};s.ecs.spatial[friend].x+=2000;indexPeople(s);
  socialise(s,a,s.ecs.planner[a].world,0,true,b);
  expect(s.knowledge[owner].events).toContain(pact.id);
  const caught=s.events.filter(e=>e.type=="poaching_found_out");
  expect(caught).toHaveLength(1);
  expect(caught[0]).toMatchObject({people:[owner,a,b],causeEventId:pact.id});
  expect(goodwillTowards(s,owner,a)).toBe(46);
  learnEvent(s,owner,pact);expect(s.events.filter(e=>e.type=="poaching_found_out")).toHaveLength(1);
  s.ecs.relationships[owner].known[friend]={ring:"personal",goodwill:36};
  expect(canDiscloseEvent(s,owner,friend,caught[0])).toBe(true);
  learnEvent(s,friend,caught[0]);expect(s.knowledge[friend].events).toContain(pact.id);
});

it("keeps the intrinsically affected spouse captured when the event occurred",()=>{
  const {state:s,a,b,spouse,event}=fixture();
  s.ecs.kinship[a].spouse=null;s.ecs.kinship[spouse].spouse=null;
  learnEvent(s,spouse,event,"witness");
  expect(s.events.filter(e=>e.type=="found_out")).toHaveLength(1);
  expect(s.events.find(e=>e.type=="found_out").people).toEqual([spouse,a,b]);
});

it("uses the same seeded history path for a poaching owner without positions",()=>{
  const {state:s,a,b,spouse:owner,friend}=fixture();
  s.generatingHistory=true;const pact=recordEvent(s,"poaching",[a,b,owner]);delete s.generatingHistory;
  for(const id of [a,b,owner,friend])delete s.ecs.spatial[id];
  historySecretActivities(s,[a,b,owner],1,{poaching_trip:{chance:1,affectedWeight:100000}});
  expect(s.knowledge[owner].events).toContain(pact.id);
  expect(s.events.filter(e=>e.type=="poaching_found_out")).toHaveLength(1);
});

it("does not choose a house while a participant's household is still home",()=>{
  const {activityPlace}=require("game/secret_activities");
  const {state:s,a,b,spouse,friend,event,tiles}=fixture();s.days=18/24;
  s.villages.village.houses=[tiles[3]];s.ecs.building={[tiles[3]]:{rooms:[]}};
  // The spouse and friend are away, but the participant is still at home.
  for(const id of [spouse,friend])s.ecs.spatial[id]={x:3000,y:3000};
  s.ecs.spatial[b]={...s.ecs.spatial[tiles[0]]};
  s.ecs.spatial[a]={...s.ecs.spatial[tiles[3]]};indexPeople(s);
  expect(activityPlace(s,event,"affair_meeting")).toBeUndefined();
});

it("records a live discovery of a historical secret as live news",()=>{
  const {state:s,event,spouse}=fixture();event.summary=true;s.days=18/24;
  learnEvent(s,spouse,event,"witness");
  expect(s.events.find(e=>e.type=="found_out")).toMatchObject({summary:false,day:s.days,discovery:"witness"});
});
