import { peopleWorld } from './support/people';
import { recordEvent, learnEvent, knownEvents } from 'game/events';
import { canDiscloseEvent } from 'game/people';
import { chooseNews } from 'game/news';

function world() {
  const w=peopleWorld(),s=w.state;
  s.newsModel=1;
  for(const id of Object.keys(s.ecs.personable))s.ecs.village[id].villageId='village';
  return w;
}
it('starts a secret with explicit knowers and never broadcasts it on occurrence',()=>{
  const {state:s,person,sibling,player}=world();
  s.generatingHistory=true;
  const event=recordEvent(s,'affair',[person,sibling]);
  expect(event.awareness.knowers).toEqual([person,sibling]);
  expect(knownEvents(s,player)).not.toContain(event);
  expect(s.knowledge[person].events||[]).toEqual([]);
});
it('replaces individual knowledge with village knowledge after half the village hears it',()=>{
  const {state:s,person,sibling,parent,player}=world();
  const event=recordEvent(s,'gift',[person],[],{audienceIds:[person]});
  expect(event.awareness.status).toBe('private');
  learnEvent(s,sibling,event);
  learnEvent(s,parent,event);
  expect(event.awareness.villages).toContain('village');
  expect(event.awareness.knowers).toEqual([]);
  expect(knownEvents(s,player)).toContain(event);
  expect(chooseNews(s,person,player)).toBeUndefined();
});
it('keeps remote news out of unrelated speech and retains knowledge when a traveller leaves',()=>{
  const {state:s,person,sibling,parent,player}=world();
  const event=recordEvent(s,'harvest',[person],[],{audienceIds:[person]});
  learnEvent(s,sibling,event);learnEvent(s,parent,event);
  const {rememberNewsScopes}=require('game/event_knowledge');
  rememberNewsScopes(s,person);
  s.ecs.village[person].villageId='remote';
  s.ecs.village[player].villageId='remote';
  expect(knownEvents(s,person)).toContain(event);
  expect(canDiscloseEvent(s,person,player,event)).toBe(false);
});
it('applies discovery effects once, including repeated hearing after promotion',()=>{
  const {state:s,person,sibling,player}=world();
  s.generatingHistory=true;
  s.ecs.kinship[person].spouse=player;s.ecs.kinship[player].spouse=person;
  const event=recordEvent(s,'affair',[person,sibling]);
  learnEvent(s,player,event);learnEvent(s,player,event);
  expect(s.events.filter(e=>e.reason==='affair_discovery')).toHaveLength(1);
});
