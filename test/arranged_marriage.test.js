import { community, attach } from "./support/travel";
import { attachPeople } from "game/person_storage";
import { bindNewsContext } from "game/event_knowledge";
import { runSocialActions } from "game/social_actions";
import { createCourtshipIndex, courtshipState, runNearbyCourtships, arrangementCandidates } from "game/nearby_courtship";
import { courtTogether, marry, canCourt } from "game/social";
import { knownEvents } from "game/events";
import { canDiscloseEvent, goodwillTowards } from "game/people";
import LINES from "data/conversation_lines.json";
import { seasonLines } from "game/seasons";
import { advanceWorldClock } from "game/travel";

function families(key="6,5") {
  const home=community({player:false}),away=community({namespace:"away-",key:"6,5",player:false});
  away.s.world.home=Object.fromEntries(key.split(",").map((n,i)=>[i?"y":"x",Number(n)]));
  away.s.map.worldKey=key;
  const a=home.ids[0],b=away.ids[0],head=home.ids[1],otherHead=away.ids[1];
  for(const row of [home,away]) {
    const [child,parent,young]=row.ids,s=row.s;
    s.ecs.personable[child].age=18;s.ecs.personable[parent].age=44;s.ecs.personable[young].age=6;
    s.ecs.kinship[child].parents=[parent];s.ecs.kinship[parent].children=[child];
    for(const id of row.ids) {
      s.ecs.nameable[id].male=row===home;
      s.ecs.personality[id].orientation="both";
      s.ecs.personality[id].opinionThresholds={hate:-100,love:100};
      s.ecs.relationships[id].known={};
    }
    s.newsModel=1;
  }
  for(const [row,x,y] of [[home,head,otherHead],[away,otherHead,head]])row.s.ecs.relationships[x].known[y]={ring:"personal",goodwill:40,base:40};
  const s=home.s;
  if(key=="5,5") {
    const map=s.travel.maps[key];
    for(const [component,table] of Object.entries(away.s.ecs))if(typeof table=="object")Object.assign(map.ecs[component] ||= {},table);
    Object.assign(map.residents,away.s.travel.maps["6,5"].residents);
    Object.assign(map.villages,away.s.villages);
    Object.assign(s.travel.people,away.s.travel.people);
  } else attach(s,away.s);
  s.travel.localPeople=true;s.travel.wholeWorld=true;
  for(const map of Object.values(s.travel.maps)) {attachPeople(map,s.travel);bindNewsContext(map,s.travel);}
  attachPeople(s,s.travel);bindNewsContext(s,s.travel);
  const view=()=>courtshipState(s.travel.maps["5,5"],s.travel.maps[key],s.travel);
  return {s,a,b,head,otherHead,view,key};
}

it.each(["head","otherHead"])("requires good goodwill from %s before families arrange anything",role=>{
  const f=families(),{s,a,b,head,otherHead}=f;
  const x=f[role],y=x==head?otherHead:head;
  s.travel.people[x].relationships.known[y].goodwill=0;
  expect(runSocialActions(f.view(),"arrange",a,b,{summary:true})).toHaveLength(0);
  expect(s.travel.people[a].relationships.commitment).toBeUndefined();
});

it("records a betrothal between strangers and uses the existing wedding path one season later",()=>{
  const {s,a,b,head,otherHead,view}=families(),v=view();v.days=7;
  expect(s.travel.people[a].relationships.known[b]).toBeUndefined();
  const result=runSocialActions(v,"arrange",a,b,{summary:true});
  expect(result.map(r=>r.event.type)).toEqual(["betrothal"]);
  expect(v.events[0].people).toEqual([a,b,head,otherHead]);
  expect(courtTogether(v,a,b,1,true)).toBe(false);
  v.days=13.999;expect(courtTogether(v,a,b,13.999/7,true)).toBe(false);
  v.days=14;expect(courtTogether(v,a,b,2,true)).toBe(true);
  expect(v.events.find(e=>e.type=="marriage")).toMatchObject({kind:"arranged",head,otherHead});
  expect(v.ecs.kinship[a].spouse).toBe(b);
  expect(goodwillTowards(v,head,otherHead)).toBe(46);
  expect(goodwillTowards(v,otherHead,head)).toBe(46);
  expect(v.ecs.relationships[a].commitment).toBeUndefined();
  expect(courtTogether(v,a,b,3,true)).toBe(false);
  expect(v.events.filter(e=>e.type=="marriage")).toHaveLength(1);
});

it.each(["disposition","goodwill"])("lets either young person refuse on negative %s and costs the heads goodwill",kind=>{
  for(const reverse of [false,true]) {
    const {a,b,head,otherHead,view}=families(),v=view(),x=reverse?b:a,y=reverse?a:b;
    if(kind=="disposition")v.ecs.personality[x].opinionThresholds={hate:100,love:101};
    else v.ecs.relationships[x].unmetGoodwill={[y]:-1};
    const result=runSocialActions(v,"arrange",a,b,{summary:true});
    expect(result.map(r=>r.event.type)).toEqual(["betrothal_refusal"]);
    expect(v.ecs.relationships[a].commitment).toBeUndefined();
    expect(goodwillTowards(v,head,otherHead)).toBe(38);
    expect(goodwillTowards(v,otherHead,head)).toBe(38);
    expect(runSocialActions(v,"arrange",b,a,{summary:true})).toHaveLength(0);
  }
});

it.each(["orientation","kin","married","courting","age","headhood"])("rejects an arrangement that fails %s",reason=>{
  const {a,b,head,view}=families(),v=view();
  if(reason=="orientation") {v.ecs.personality[a].orientation="opposite";v.ecs.nameable[a].male=true;v.ecs.nameable[b].male=true;}
  if(reason=="kin")v.ecs.kinship[b].parents=[head];
  if(reason=="married")v.ecs.kinship[a].spouse=head;
  if(reason=="courting")v.social.courtships[[a,head].sort().join(":")]=0;
  if(reason=="age")v.ecs.personable[a].age=24;
  if(reason=="headhood")v.ecs.controllable[v.ecs.household[a].houseId].controllerId=a;
  expect(runSocialActions(v,"arrange",a,b,{summary:true})).toHaveLength(0);
});

it("selects nearby family proposals from the courtship index without a population scan",()=>{
  const {s,a,b}=families(),index=createCourtshipIndex(s.travel.maps);
  const noScan=table=>new Proxy(table,{ownKeys(){throw new Error("scanned population or maps");}});
  for(const map of Object.values(s.travel.maps)) {
    map.ecs.personable=noScan(map.ecs.personable);map.residents=noScan(map.residents);map.ecs.relationships=noScan(map.ecs.relationships);
  }
  s.travel.maps=noScan(s.travel.maps);s.travel.people=noScan(s.travel.people);
  expect(arrangementCandidates(index,"5,5",a).map(c=>c.id)).toContain(b);
});

it.each(["6,5","5,5","8,5"])("runs arrangements at the world seasonal boundary with village reach %s",key=>{
  const {s,a,b}=families(key);s.days=7;
  runNearbyCourtships(s,1);
  const events=Object.values(s.travel.events).filter(e=>e.type=="betrothal");
  if(key=="8,5") {expect(events).toHaveLength(0);return;}
  expect(events).toHaveLength(1);
  s.days=14;runNearbyCourtships(s,2);
  expect(s.travel.people[a].kinship.spouse).toBe(b);
  expect(s.travel.people[a].household.houseId).toBe(s.travel.people[b].household.houseId);
});

it("also arranges between two households in the same village",()=>{
  const {s,a,b}=families("5,5"),map=s.travel.maps["5,5"];
  const house=map.ecs.household[b].houseId;
  for(const id of [b,...map.ecs.kinship[b].parents,house])map.ecs.village[id].villageId="v";
  map.villages.v.houses.push(house);delete map.villages["away-v"];
  s.days=7;runNearbyCourtships(s,1);
  expect(Object.values(s.travel.events).filter(e=>e.type=="betrothal")).toHaveLength(1);
  s.days=14;runNearbyCourtships(s,2);
  expect(s.travel.people[a].kinship.spouse).toBe(b);
});

it("keeps a cross-border betrothal through real community seasons and then holds an arranged wedding",async()=>{
  const {s,a,b}=families();s.days=7;runNearbyCourtships(s,1);
  const promise=Object.values(s.travel.events).find(e=>e.type=="betrothal");
  expect(promise).toBeDefined();
  s.travel.season=1;s.days=14;
  await advanceWorldClock(s,{travelling:true});
  const wedding=Object.values(s.travel.events).find(e=>e.type=="marriage"&&e.people.includes(a)&&e.people.includes(b));
  expect(wedding).toMatchObject({kind:"arranged",betrothalId:promise.id,season:2});
  expect(s.travel.people[a].kinship.spouse).toBe(b);
});

it("keeps a betrothal exclusive, prevents early direct weddings, and rechecks willingness",()=>{
  const {a,b,head,view}=families(),v=view();v.days=7;
  runSocialActions(v,"arrange",a,b,{summary:true});
  expect(marry(v,a,b,true)).toBe(false);
  expect(canCourt(v,a,head)).toBe(false);
  v.days=14;v.ecs.relationships[a].unmetGoodwill={[b]:-1};
  expect(courtTogether(v,a,b,2,true)).toBe(false);
  expect(v.ecs.relationships[a].commitment).toBeUndefined();
  expect(v.ecs.relationships[b].commitment).toBeUndefined();
});

it("lets each head make only one proposal per season, including across siblings",()=>{
  const {a,b,head,view}=families(),v=view();
  const sibling="younger-sibling";
  for(const component of ["personable","personality","kinship","relationships","household","village","nameable"])v.ecs[component][sibling]=JSON.parse(JSON.stringify(v.ecs[component][a]));
  v.ecs.kinship[head].children.push(sibling);
  v.ecs.personality[a].opinionThresholds={hate:100,love:101};
  expect(runSocialActions(v,"arrange",a,b,{summary:true})[0].event.type).toBe("betrothal_refusal");
  expect(runSocialActions(v,"arrange",sibling,b,{summary:true})).toHaveLength(0);
  v.days+=7;
  expect(runSocialActions(v,"arrange",sibling,b,{summary:true})[0].event.type).toBe("betrothal");
});

it("publishes betrothals and refusals as ordinary news with generated conversation rows",()=>{
  for(const refused of [false,true]) {
    const {a,b,head,view}=families(),v=view();
    if(refused)v.ecs.personality[a].opinionThresholds={hate:100,love:101};
    const event=runSocialActions(v,"arrange",a,b,{summary:true})[0].event;
    expect(knownEvents(v,head).map(e=>e.id)).toContain(event.id);
    expect(canDiscloseEvent(v,head,a,event)).toBe(true);
    expect(seasonLines(v,Math.floor(v.days/7),head).some(row=>row.eventIds.includes(event.id))).toBe(true);
    for(const family of ["event_news","gossip_tell","overheard_news"])expect(LINES.some(row=>row.family==family&&row.situation=="catalogue_"+event.type)).toBe(true);
  }
});
