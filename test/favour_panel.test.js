import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { peopleWorld } from './support/people';
import { GameState } from '../src/components/contexts';
import { RequestList, PersonRequests } from '../src/components/favour_requests';
import { TaskPanel } from '../src/components/task_panel';
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
  s.knowledge = { [w.player]: { people: {}, feelings: {}, favours: ['f'] } };
  return w;
}
const render = (s, child) => renderToStaticMarkup(<GameState.Provider value={s}>{child}</GameState.Provider>);
it('uses known-person naming and hides unlearned requests in the compact list', () => {
  const w = setup(); let html = render(w.state, <RequestList/>);
  expect(html).toContain('an unknown person');
  expect(html).not.toContain('Agnes Miller');
  expect(html).toContain('+12 goodwill');
  expect(html).toContain('Accept favour');
  w.state.knowledge[w.player].favours = [];
  html = render(w.state, <RequestList/>);
  expect(html).not.toContain('The oven needs fuel');
});
it('shows explicit acceptance, queue reward and clear completed/expired outcomes', () => {
  const w = setup(), s = w.state;
  acceptFavour(s, 'f');
  expect(render(s, <TaskPanel/>)).toContain('Deliver wood');
  expect(render(s, <TaskPanel/>)).toContain('Favour · +12 goodwill');
  expect(render(s, <PersonRequests personId={w.person}/>)).toContain('Accepted');
  s.favours.requests.f.status = 'completed'; s.favours.requests.f.outcome = 'Completed · +12 goodwill with the requester';
  expect(render(s, <RequestList/>)).toContain('Completed · +12 goodwill');
  s.favours.requests.f.status = 'expired'; s.favours.requests.f.outcome = 'The requester died · no goodwill';
  expect(render(s, <RequestList/>)).toContain('The requester died');
});

it('keeps the compact current task favour-aware without claiming a walking-only completion estimate', () => {
  const w = setup(), s = w.state;
  const task = acceptFavour(s, 'f'); task.assignedId = w.player;
  const html = render(s, <TaskPanel/>);
  expect(html).toContain('Fed · Deliver wood');
  const item = html.slice(html.indexOf('<li class="task'), html.indexOf('</li>'));
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
