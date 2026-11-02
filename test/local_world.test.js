import {community,attach} from "./support/travel";
import {advanceWorldClock,completeTravel} from "game/travel";
import {skipIntro} from "game/intro";
import {recordEvent,knownEvents} from "game/events";
import {bindNewsContext} from "game/event_knowledge";
import {attachPeople} from "game/person_storage";
function world() {
  const {s}=community(),away=community({namespace:"away-",key:"6,5",player:false}).s;attach(s,away);
  s.newsModel=1;s.travel.localPeople=true;s.travel.wholeWorld=true;
  for(const [key,map] of Object.entries(s.travel.maps)) {
    map.newsModel=1;s.travel.maps[key]=map;attachPeople(s.travel.maps[key],s.travel);bindNewsContext(s.travel.maps[key],s.travel);
  }
  attachPeople(s,s.travel);bindNewsContext(s,s.travel);
  return s;
}
it("keeps an unrelated village out of local news and runs deterministic small histories",async()=>{
  const a=world(),b=world(),remote=Object.keys(a.travel.maps["6,5"].residents)[0],local=a.ui.playerId;
  for(const s of [a,b]) {
    const event=recordEvent(s,"harvest",[local],[],{audienceIds:[local]});
    expect(knownEvents(s,remote)).not.toContain(event);
    for(let i=0;i<8;i++){s.days+=7;await advanceWorldClock(s,{travelling:true});}
  }
  expect(a.travel).toEqual(b.travel);
  for(const map of Object.values(a.travel.maps))for(const id of Object.keys(map.ecs.personable))expect(map.residents[id]).toBe(true);
});
it("takes the same single player and knowledge through a real small-map hop",async()=>{
  const s=world(),id=s.ui.playerId;
  await completeTravel(s,{destination:"6,5",side:0});skipIntro(s);
  expect(s.travel.active).toBe("6,5");
  expect(Object.values(s.travel.maps).filter(m=>m.residents[id])).toHaveLength(1);
  expect(s.knowledge).toBe(s.travel.knowledge);
  expect(s.ecs.personable[id]).toBe(s.travel.people[id].personable);
});
it("keeps caller history, scope memory and the world directory unchanged in a pure season",()=>{
  const {historyStep}=require("game/social"),{gameData}=require("game/save_game");
  const s=world();s.knowledge[s.ui.playerId]={people:{},newsScopes:{"v:old":-7}};
  const before=structuredClone(gameData(s));
  historyStep(s,1);
  expect(gameData(s)).toEqual(before);
});
it("keeps unwilling adults local while a willing seeker can use the existing road rules",async()=>{
  const s=world(),home=s.travel.maps[s.travel.active],ids=Object.keys(home.residents).filter(id=>!home.ecs.playable[id]);
  for(const map of Object.values(s.travel.maps))for(const id of Object.keys(map.residents)) {
    map.ecs.personality[id].traveller=false;map.ecs.kinship[id].spouse=null;
  }
  s.days+=7;await advanceWorldClock(s,{travelling:true});
  expect(Object.values(s.travel.events).filter(e=>e.type==="departure")).toHaveLength(0);
  const id=ids[0];home.ecs.personality[id].traveller=true;
  // An unrelated compatible local partner keeps any seeker home. Here there
  // are no other unmarried adults, so willingness can lead to a real departure.
  for(const other of Object.keys(home.residents))if(other!==id && !home.ecs.playable[other]){home.ecs.personable[other].age=10;home.ecs.personable[other].lifeYears=.5;}
  s.days+=7;await advanceWorldClock(s,{travelling:true});
  expect(Object.values(s.travel.events).some(e=>e.type==="departure"&&e.people[0]===id)).toBe(true);
  expect(Object.hasOwn(home.ecs.personable,id)).toBe(false);
  expect(home.ecs.personable[id]).toBe(s.travel.people[id].personable);
});

it("adds a real NPC arrival to the active household, village and nearby queries",async()=>{
  const {departNpc}=require("game/travel"),{trackPopulation,householdMembers,villagePeople,nearbyPeople}=require("game/population_index");
  const s=world(),away=s.travel.maps["6,5"],id=Object.keys(away.residents)[0];
  trackPopulation(s);
  departNpc(away,id,{to:s.travel.active,side:3},s.travel);
  expect(s.travel.transit.some(trip=>trip.bundle.id===id)).toBe(true);
  s.days+=7;await advanceWorldClock(s);
  expect(s.residents[id]).toBe(true);
  const home=s.ecs.household[id].houseId,village=s.ecs.village[id].villageId;
  expect(householdMembers(s,home)).toContain(id);
  expect(villagePeople(s,village)).toContain(id);
  expect(nearbyPeople(s,s.ecs.spatial[id],0)).toContain(id);
  expect(s.redraws).toContain(id);
  expect(s.travel.maps[s.travel.active].redraws).toBeUndefined();
});
