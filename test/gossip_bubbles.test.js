import { peopleWorld } from "./support/people";
import { recordEvent } from "game/events";
import { chatTogether } from "game/social";
import { overheardHint, updateOverhearing } from "game/chat_bubbles";
import LINES from "data/conversation_lines.json";

function setup() {
  const w=peopleWorld(),{state:s,person:a,parent:b,player:p}=w;
  s.knowledge={};s.events=[];
  s.ecs.spatial[p]={...s.ecs.spatial[a],x:s.ecs.spatial[a].x-65};
  for(const [id,other] of [[a,b],[b,a]]) {
    const plan=s.ecs.planner[id];plan.task=["socialise",other];plan.plan=[];
    plan.world.social={partnerId:other,stage:"visiting",started:s.days,expires:s.days+1};
  }
  const event=recordEvent(s,"harvest",[a],[],{quantity:9,audienceIds:[a]});
  expect(chatTogether(s,a,b)).toBe(true);
  return {...w,event};
}
it("describes the catalogue's actual spoken event without teaching it on a read",()=>{
  const {state:s,person:a,player:p,event}=setup();
  const before=JSON.stringify(s.knowledge);
  expect(overheardHint(s,a)).toBeTruthy();
  expect(s.ecs.planner[a].world.social.utterance.eventId).toBe(event.id);
  expect(JSON.stringify(s.knowledge)).toBe(before);
  expect(LINES.some(l=>l.id==s.ecs.planner[a].world.social.utterance.lineId)).toBe(true);
  expect(s.knowledge[p]?.events||[]).not.toContain(event.id);
});
it("learns nearby spoken news once with the real speaker, including when stepping simulation",()=>{
  const {state:s,person:a,player:p,event,step}=setup();
  step(.001);
  expect(s.knowledge[p].events).toContain(event.id);
  expect(s.knowledge[p].spokenSources[event.id]).toMatchObject({speakerId:a,day:.375});
  const source={...s.knowledge[p].spokenSources[event.id]};
  updateOverhearing(s);updateOverhearing(s);
  expect(s.knowledge[p].events.filter(id=>id==event.id)).toHaveLength(1);
  expect(s.knowledge[p].spokenSources[event.id]).toEqual(source);
});
it.each(["distance","interior","wall","extension","ended","sleep","sealed"])("does not learn inaudible or hidden speech: %s",kind=>{
  const {state:s,person:a,player:p,event}=setup();
  if(kind=="distance")s.ecs.spatial[p].x-=200;
  if(kind=="interior")s.ecs.interior={[p]:{buildingId:"home"}};
  if(kind=="wall") {
    s.ecs.building={wall:{entrance:1}};
    s.ecs.spatial.wall={x:s.ecs.spatial[a].x-32,y:s.ecs.spatial[a].y};
  }
  if(kind=="extension") {
    s.ecs.building={wall:{entrance:1}};
    s.ecs.spatial.wall={x:s.ecs.spatial[a].x-32,y:s.ecs.spatial[a].y+80};
    s.ecs.treeClearance={wall:{x:s.ecs.spatial[a].x-32,y:s.ecs.spatial[a].y+30,halfWidth:45.5,halfDepth:80,angle:0}};
  }
  if(kind=="ended")s.ecs.planner[a].task=["eat"];
  if(kind=="sleep")s.ecs.planner[p].task=["sleep"];
  if(kind=="sealed")event.sealed=true;
  updateOverhearing(s);
  expect(s.knowledge[p]?.events||[]).not.toContain(event.id);
  expect(overheardHint(s,a)).toBeNull();
});

it("hears a traveller's spoken account from the world catalogue without importing its event body",()=>{
  const {state:s,person:a,player:p,event}=setup();
  s.travel={events:{[event.id]:event}};
  s.events=[];
  expect(overheardHint(s,a)).toBeTruthy();
  updateOverhearing(s);
  expect(s.knowledge[p].events).toContain(event.id);
  expect(s.knowledge[p].spokenSources[event.id].speakerId).toBe(a);
  expect(s.events).toEqual([]);
});
