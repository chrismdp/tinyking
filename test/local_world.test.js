import {community,attach} from './support/travel';
import {advanceWorldClock,completeTravel} from 'game/travel';
import {skipIntro} from 'game/intro';
import {recordEvent,knownEvents} from 'game/events';
import {bindNewsContext} from 'game/event_knowledge';
import {attachPeople} from 'game/person_storage';
function world() {
  const {s}=community(),away=community({namespace:'away-',key:'6,5',player:false}).s;attach(s,away);
  s.newsModel=1;s.travel.localPeople=true;s.travel.wholeWorld=true;
  for(const [key,map] of Object.entries(s.travel.maps)) {
    map.newsModel=1;s.travel.maps[key]=map;attachPeople(s.travel.maps[key],s.travel);bindNewsContext(s.travel.maps[key],s.travel);
  }
  attachPeople(s,s.travel);bindNewsContext(s,s.travel);
  return s;
}
it('keeps an unrelated village out of local news and runs deterministic small histories',async()=>{
  const a=world(),b=world(),remote=Object.keys(a.travel.maps['6,5'].residents)[0],local=a.ui.playerId;
  for(const s of [a,b]) {
    const event=recordEvent(s,'harvest',[local],[],{audienceIds:[local]});
    expect(knownEvents(s,remote)).not.toContain(event);
    for(let i=0;i<8;i++){s.days+=7;await advanceWorldClock(s,{travelling:true});}
  }
  expect(a.travel).toEqual(b.travel);
  for(const map of Object.values(a.travel.maps))for(const id of Object.keys(map.ecs.personable))expect(map.residents[id]).toBe(true);
});
it('takes the same single player and knowledge through a real small-map hop',async()=>{
  const s=world(),id=s.ui.playerId;
  await completeTravel(s,{destination:'6,5',side:0});skipIntro(s);
  expect(s.travel.active).toBe('6,5');
  expect(Object.values(s.travel.maps).filter(m=>m.residents[id])).toHaveLength(1);
  expect(s.knowledge).toBe(s.travel.knowledge);
  expect(s.ecs.personable[id]).toBe(s.travel.people[id].personable);
});
