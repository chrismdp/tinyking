import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { recordEvent, learnEvent, knownEvents } from "game/events";
import { goodwillTowards } from "game/people";
import { restoreGame, serialiseGame } from "game/save_game";

function fixture() {
  const f=peopleWorld(),s=f.state;
  s.newsModel=1;s.generatingHistory=true;s.map={worldKey:"home"};
  for(const id of Object.keys(s.ecs.personable))s.ecs.kinship[id]={parents:[],children:[],spouse:null};
  s.ecs.kinship[f.person].spouse=f.parent;s.ecs.kinship[f.parent].spouse=f.person;
  return f;
}

it.each(["affair","poaching"])("discovers %s once when the affected resident learns through village promotion",type=>{
  const {state:s,person:a,sibling:b,parent:affected,player}=fixture();
  const event=recordEvent(s,type,type==="affair"?[a,b]:[a,b,affected]);
  expect(knownEvents(s,affected)).not.toContain(event);
  learnEvent(s,player,event,"confidence");
  expect(event.awareness.villages).toContain("village");
  const discoveryType=type==="affair"?"found_out":"poaching_found_out";
  expect(s.events.filter(e=>e.type===discoveryType)).toHaveLength(1);
  expect(s.events.find(e=>e.type===discoveryType)).toMatchObject({people:[affected,a,b],causeEventId:event.id,discovery:"general"});
  const before=JSON.stringify(s.ecs.relationships);
  learnEvent(s,affected,event);learnEvent(s,player,event);
  expect(JSON.stringify(s.ecs.relationships)).toBe(before);
  const restored=restoreGame(serialiseGame(s));
  learnEvent(restored,affected,restored.events.find(e=>e.id===event.id));
  expect(restored.events.filter(e=>e.type===discoveryType)).toHaveLength(1);
  expect(JSON.stringify(restored.ecs.relationships)).toBe(before);
});

it.each(["friend","betrayed kin","lover kin"])("applies %s knock-ons once when found_out promotes to their village",kind=>{
  const {state:s,person:a,sibling:b,parent:spouse,player:learner}=fixture();
  const extras=newEntities(s,Array.from({length:3},()=>({personable:{age:25},spatial:{x:5000,y:5000},village:{villageId:"village"},kinship:{parents:[],children:[],spouse:null},relationships:{known:{}}})));
  const event=recordEvent(s,"affair",[a,b]);
  // Live discovery: only the participants hear the initial account. The
  // distant fourth learner will take this seven-person village to its quorum.
  delete s.generatingHistory;
  for(const [i,id] of Object.keys(s.ecs.personable).entries())s.ecs.spatial[id]={x:i*1000,y:0};
  const bond=target=>{s.ecs.relationships[learner].known[target]={ring:"public",goodwill:0};};bond(a);bond(b);
  if(kind==="friend")s.ecs.relationships[learner].known[spouse]={ring:"personal",goodwill:36};
  else {const relative=kind==="betrayed kin"?spouse:b;s.ecs.kinship[learner].parents=[relative];s.ecs.kinship[relative].children=[learner];}
  learnEvent(s,spouse,event,"witness");
  const found=s.events.find(e=>e.type==="found_out");
  expect(found).toBeDefined();
  expect(knownEvents(s,learner)).not.toContain(found);
  learnEvent(s,extras[0],found);
  expect(found.awareness.villages).toContain("village");
  expect(knownEvents(s,learner)).toContain(found);expect(knownEvents(s,learner)).toContain(event);
  expect(goodwillTowards(s,learner,a)).toBe(kind==="lover kin"?-8:-15);
  expect(goodwillTowards(s,learner,b)).toBe(kind==="lover kin"?0:-15);
  const before=JSON.stringify(s.ecs.relationships);
  learnEvent(s,learner,found);learnEvent(s,learner,event);
  expect(JSON.stringify(s.ecs.relationships)).toBe(before);
});
