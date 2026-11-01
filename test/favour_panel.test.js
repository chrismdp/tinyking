import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { peopleWorld } from './support/people';
import { GameState } from '../src/components/contexts';
import { RequestList, PersonRequests } from '../src/components/favour_requests';
import { ActivityDetails, StatusStrip } from '../src/components/status_strip';
import { acceptFavour } from 'game/favours';

jest.mock('components/contexts', () => require('../src/components/contexts'), { virtual: true });
jest.mock('game/name', () => ({ name: n => n?.nickname || '?' }));
function setup() {
  const w = peopleWorld(), s = w.state;
  s.villages.village.centre = { x: 3, y: 0 }; s.villages.village.houses = [w.tiles[3]];
  s.ecs.container = { [w.tiles[3]]: { capacity: 10, amounts: {} } };
  s.ecs.household[w.tiles[3]] = { storeId: w.tiles[3], fields: [] };
  s.ecs.workplace = { oven: { trade: 'baker', houseId: w.tiles[3] } };
  s.ecs.spatial.oven = { ...s.ecs.spatial[w.tiles[3]], id: 'oven' };
  s.favours = { nextId: 1, requests: { f: { id: 'f', giverId: w.person, householdId: w.tiles[3], targetId: w.tiles[3], workplaceId: 'oven', kind: 'wood', reason: 'The oven needs fuel', quantity: 1, goodwill: 12, progress: 0, delivered: 0, produced: 0, cargo: [], status: 'offered' } } };
  s.knowledge = { [w.player]: { people: { [w.person]: { traits: [], conversation: { day: s.days } } }, feelings: {}, favours: ['f'], offers: { f: { speakerId: w.person, day: s.days } } } };
  return w;
}
const render = (s, child) => renderToStaticMarkup(<GameState.Provider value={s}>{child}</GameState.Provider>);
it('uses known-person naming and hides unlearned requests in the compact list', () => {
  const w = setup(); w.state.knowledge[w.player].people = {}; let html = render(w.state, <RequestList/>);
  expect(html).toContain('an unknown person');
  expect(html).not.toContain('Agnes Miller');
  expect(html).toContain('+12 goodwill');
  expect(html).toContain('Discuss this in Chat');
  expect(html).not.toContain('Accept favour');
  w.state.knowledge[w.player].favours = [];
  html = render(w.state, <RequestList/>);
  expect(html).not.toContain('The oven needs fuel');
});
it('shows explicit acceptance, order reward and clear completed/expired outcomes', () => {
  const w = setup(), s = w.state;
  acceptFavour(s, 'f');
  expect(render(s, <ActivityDetails/>)).toContain('Deliver wood');
  expect(render(s, <ActivityDetails/>)).toContain('Favour · +12 goodwill');
  expect(render(s, <PersonRequests personId={w.person}/>)).toContain('Accepted');
  s.favours.requests.f.status = 'completed'; s.favours.requests.f.outcome = 'Completed · +12 goodwill with the requester';
  expect(render(s, <RequestList/>)).toContain('Completed · +12 goodwill');
  s.favours.requests.f.status = 'expired'; s.favours.requests.f.outcome = 'The requester died · no goodwill';
  expect(render(s, <RequestList/>)).toContain('The requester died');
});
it('links a heard offer back to its real conversation without accepting it', () => {
  const w=setup(),s=w.state;
  const html=render(s,<RequestList/>);
  expect(html).toContain('Chat with Agnes Miller');
  expect(s.favours.requests.f.status).toBe('offered');
  expect(s.ecs.manager[w.player].jobs).toEqual([]);
});

it('keeps the compact current task favour-aware without claiming a walking-only completion estimate', () => {
  const w = setup(), s = w.state;
  const task = acceptFavour(s, 'f'); task.assignedId = w.player;
  const html = render(s, <ActivityDetails/>);
  expect(render(s,<StatusStrip/>)).toContain('Energy 100 / 100');
  expect(html).toContain('Deliver wood');
  const item = html.slice(html.indexOf('<article class="task'), html.indexOf('</article>'));
  expect(item).not.toContain('m left');
});

it('names the real fuel receiver for a full pantry and keeps normal room-store directions when there is space', () => {
  const w = setup(), s = w.state;
  s.ecs.spatial.oven = { ...s.ecs.spatial[w.tiles[1]], id: 'oven' };
  s.ecs.container[w.tiles[3]].amounts.grain = 10;
  let html = render(s, <RequestList/>);
  expect(html).toContain('Workshop fuel · tile 1, 0');
  expect(html).toContain('Household store is full · bring the log to the oven.');
  expect(html).not.toContain('Household stores · tile 3, 0');
  s.ecs.container[w.tiles[3]].amounts.grain = 9;
  html = render(s, <RequestList/>);
  expect(html).toContain('Household stores · tile 3, 0');
  expect(html).not.toContain('Workshop fuel');
});

it('uses the same actual harvest blockage in the request and task, instead of the original ready-crop reason', () => {
  const w=setup(),s=w.state,r=s.favours.requests.f;
  Object.assign(r,{kind:'harvest',status:'accepted',reason:'The family crop is ready',quantity:3});
  s.ecs.farmable={[r.targetId]:{houseId:r.householdId,claimerId:w.person,slots:[{state:'harvestable',amount:6}]}};
  s.ecs.container[r.householdId].amounts.grain=8;
  const {favourWaiting}=require('game/favours');
  const task={id:'harvest',job:{key:'favour'},favourId:r.id,targetId:r.targetId};
  task.waiting=task.detail=favourWaiting(s,task);s.ecs.manager[w.player].jobs=[task];
  const requestHTML=render(s,<RequestList/>),taskHTML=render(s,<ActivityDetails/>);
  expect(requestHTML).toContain(task.waiting);
  expect(taskHTML).toContain(task.waiting);
  expect(requestHTML).not.toContain('The family crop is ready');
});
