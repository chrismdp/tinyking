import { peopleWorld } from './support/people';
import { newEntities, deleteEntity } from 'game/entities';
import { updateFavours, visibleFavours, acceptFavour, finishFavour, fuelReady } from 'game/favours';
import { enqueueTask, cancelTask, reorderTask, readyPlayerTasks } from 'game/manager';
import { trade_work } from 'game/tasks';
import { HOUR } from 'game/time';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameState } from '../src/components/contexts';
import { TaskPanel } from '../src/components/task_panel';
import { do_favour } from 'game/tasks';

jest.mock('components/contexts', () => require('../src/components/contexts'), { virtual: true });
jest.mock('game/name', () => ({ name: n => n?.nickname || '?' }));

const taskMarkup = s => renderToStaticMarkup(<GameState.Provider value={s}><TaskPanel/></GameState.Provider>);
const harvestRow = s => taskMarkup(s).match(/<li class="task[^]*?<\/li>/)?.[0];
function advanceUntil(w, condition) {
  for (let i = 0; i < 2000 && !condition(); i++) w.step(.01);
  expect(condition()).toBeTruthy();
}

it('does not present actual first-patch work overrun as 160% favour completion', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  const task = acceptFavour(s, r.id);
  advanceUntil(w, () => r.working && task.workRemaining > 0);
  const planner = s.ecs.planner[w.player];
  // Real timed crop work with a long final frame, not an injected progress value.
  do_favour(s, w.player, planner.world, task.workRemaining + HOUR / 8 * .6, false, r.id);
  expect(task.progress).toBeCloseTo(1.6);
  expect(r).toMatchObject({ progress: 1, delivered: 0, produced: 2, status: 'accepted' });
  expect(s.ecs.farmable[w.field].slots.filter(slot => slot.state == 'harvested')).toHaveLength(1);
  expect(harvestRow(s)).not.toContain('160%');
  expect(harvestRow(s)).toContain('1/3 patches harvested');
  expect(harvestRow(s)).toContain('0 crop portions carried home');
});

it('shows real patch, hand and home counts through work, partial delivery and completion', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  acceptFavour(s, r.id);
  advanceUntil(w, () => r.working);
  expect(harvestRow(s)).toContain('Harvesting patch 1 of 3');
  expect(harvestRow(s)).toContain('0/3 patches harvested');
  advanceUntil(w, () => r.cargo.some(id => s.ecs.haulable[id]?.heldBy == w.player));
  let row = harvestRow(s);
  for (const text of ['1/3 patches harvested', '1 crop portion in hand', '0 crop portions carried home', 'Carrying the family harvest home']) expect(row).toContain(text);
  expect(row).not.toContain('%');
  advanceUntil(w, () => r.delivered == 1);
  row = harvestRow(s);
  expect(row).toContain('1/3 patches harvested');
  expect(row).toContain('1 crop portion carried home');
  expect(r.status).toBe('accepted');
  advanceUntil(w, () => r.progress == 2);
  expect(harvestRow(s)).toContain('2/3 patches harvested');
  expect(harvestRow(s)).toContain('2 crop portions carried home');
  advanceUntil(w, () => r.progress == 3 && r.delivered == 5);
  row = harvestRow(s);
  expect(row).toContain('3/3 patches harvested');
  expect(row).toContain('5 crop portions carried home');
  expect(row).not.toContain('Completed');
  expect(row).not.toContain('%');
  advanceUntil(w, () => r.status == 'completed');
  expect(taskMarkup(s)).toContain('Completed · +12 goodwill with the requester');
  expect(taskMarkup(s)).toContain('6 crop portions carried home');
  expect(s.ecs.container[w.store].amounts.grain).toBe(36);
  expect(s.events.filter(e => e.type == 'favour')).toHaveLength(1);
});

it('keeps harvest counts honest while reordered, waiting, interrupted and resumed', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  const favour = acceptFavour(s, r.id);
  advanceUntil(w, () => r.cargo.some(id => s.ecs.haulable[id]?.heldBy == w.player));
  const move = enqueueTask(s, { key: 'move_to_here' }, w.tiles[0]);
  reorderTask(s, move.id, 0);
  let html = taskMarkup(s);
  expect(html).toContain('Harvest paused · another task comes first');
  expect(html).toContain('1 crop portion in hand');
  expect(html).not.toContain('Carrying the family harvest home');
  s.ecs.container[w.store].capacity = 30;
  readyPlayerTasks(s);
  expect(taskMarkup(s)).toContain('Household store is full');
  expect(taskMarkup(s)).toContain('0 crop portions carried home');
  s.ecs.container[w.store].capacity = 100;
  s.ecs.personable[w.player].hunger = 1.2;
  advanceUntil(w, () => s.ecs.planner[w.player].task?.[0] == 'eat');
  html = taskMarkup(s);
  expect(html).toContain('Stopped to eat · harvest resumes afterwards');
  expect(html).toContain('1/3 patches harvested');
  advanceUntil(w, () => r.status == 'completed');
  expect(s.ecs.manager[w.player].jobs).not.toContain(favour);
  expect(taskMarkup(s)).toContain('6 crop portions carried home');
  expect(s.ecs.container[w.store].amounts.grain).toBe(36);
  expect(s.ecs.container[w.camp].amounts.grain).toBe(5);
  expect(s.events.filter(e => e.type == 'favour')).toHaveLength(1);
});

it('shows sleep as an interruption before returning to the unfinished harvest', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  s.events = [];
  s.days = 20 / 24;
  s.ecs.planner[w.player].world.days = s.days;
  s.ecs.personable[w.player].tiredness = 1.1;
  acceptFavour(s, r.id);
  advanceUntil(w, () => s.ecs.planner[w.player].task?.[0] == 'sleep');
  expect(taskMarkup(s)).toContain('Stopped to sleep · harvest resumes afterwards');
  expect(taskMarkup(s)).toContain('0/3 patches harvested');
  advanceUntil(w, () => r.working);
  expect(harvestRow(s)).toContain('Harvesting patch 1 of 3');
  expect(s.events.filter(e => e.type == 'favour')).toHaveLength(0);
});

export function favourWorld() {
  const w = peopleWorld(), { state: s, player, person, parent, sibling, tiles } = w;
  const [house, store, workplace, field, camp] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[tiles[3]] }, building: {}, household: { fields: [], farming: true }, controllable: { controllerId: person } },
    { spatial: { ...s.ecs.spatial[tiles[3]] }, container: { amounts: { grain: 30 }, capacity: 100 }, controllable: { controllerId: person } },
    { spatial: { ...s.ecs.spatial[tiles[3]] }, workplace: { trade: 'baker' }, controllable: { controllerId: person } },
    { spatial: { ...s.ecs.spatial[tiles[4]] }, farmable: { slots: Array.from({ length: 5 }, () => ({ state: 'harvestable', content: 'grain', amount: 2 })) }, controllable: { controllerId: person } },
    { spatial: { ...s.ecs.spatial[tiles[0]] }, camp: {}, container: { amounts: { wood: 3, grain: 6 }, capacity: 20 }, sleepable: { capacity: 1, occupiers: [] }, controllable: { controllerId: player } }
  ]);
  Object.assign(s.ecs.household[house], { storeId: store, workplaceId: workplace, fields: [field] });
  s.ecs.workplace[workplace].houseId = house;
  s.ecs.farmable[field].houseId = house;
  for (const id of [person, parent, sibling]) { s.ecs.household[id].houseId = house; delete s.ecs.planner[id]; }
  delete s.ecs.household[player];
  // Known ground and a nearby encounter, without granting a relationship.
  s.ecs.spatial[player] = { ...s.ecs.spatial[tiles[2]] };
  s.ecs.playable[player].known = tiles.map(id => require('game/hex').Hex().fromPoint(s.ecs.spatial[id]));
  updateFavours(s);
  return { ...w, house, store, workplace, field, camp, request: kind => Object.values(s.favours.requests).find(r => r.kind == kind && r.status == 'offered') };
}

it('offers only real household needs, one per household/need, deterministically, without creating goods', () => {
  const a = favourWorld(), b = favourWorld();
  const goods = JSON.stringify(a.state.ecs.good);
  updateFavours(a.state); updateFavours(a.state);
  expect(Object.values(a.state.favours.requests).map(r => r.kind)).toEqual(['harvest', 'wood']);
  expect(a.state.favours).toEqual(b.state.favours);
  expect(JSON.stringify(a.state.ecs.good)).toBe(goods);
  delete a.state.ecs.workplace[a.workplace];
  updateFavours(a.state);
  expect(a.request('wood')).toBeUndefined();
});

it('expires resolved needs, and food requests measure actual family reserves', () => {
  const w = favourWorld(), { state: s, field, store } = w;
  for (const slot of s.ecs.farmable[field].slots) slot.state = 'harvested';
  s.ecs.container[store].amounts.wood = 1;
  updateFavours(s);
  expect(Object.values(s.favours.requests).every(r => r.status == 'expired')).toBe(true);
  s.ecs.container[store].amounts.grain = 0;
  updateFavours(s);
  expect(w.request('food')).toMatchObject({ quantity: 3, householdId: w.house, goodwill: 12 });
  s.ecs.container[store].amounts.grain = 10;
  updateFavours(s);
  expect(w.request('food')).toBeUndefined();
});

it('keeps undiscovered needs private, including known people in unseen households', () => {
  const w = favourWorld(), s = w.state;
  s.knowledge = {}; s.ecs.spatial[w.player] = { x: 10000, y: 0 };
  s.ecs.relationships[w.player].known[w.person] = { ring: 'social', goodwill: 10 };
  updateFavours(s);
  expect(visibleFavours(s)).toEqual([]);
  s.ecs.spatial[w.player] = { ...s.ecs.spatial[w.person] };
  updateFavours(s);
  expect(visibleFavours(s).length).toBe(2);
});

it('explicitly accepts once, joins the ordered queue, reorders and cancels without reward', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  expect(s.ecs.manager[w.player].jobs).toHaveLength(0);
  const own = enqueueTask(s, { key: 'move_to_here' }, w.tiles[0]);
  const task = acceptFavour(s, r.id);
  expect(acceptFavour(s, r.id)).toBeNull();
  expect(s.ecs.manager[w.player].jobs.map(j => j.id)).toEqual([own.id, task.id]);
  reorderTask(s, task.id, 0);
  expect(s.ecs.manager[w.player].jobs[0]).toBe(task);
  cancelTask(s, task.id);
  expect(r.status).toBe('cancelled');
  expect(s.ecs.relationships[w.person].known[w.player]?.goodwill || 0).toBe(0);
});

it('walks and delivers a real log to the requesting home, rewarding exactly once in their direction', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  const task = acceptFavour(s, r.id);
  const before = { ...s.ecs.spatial[w.player] };
  w.step(0.05);
  expect(r.status).toBe('accepted');
  expect(s.ecs.container[w.store].amounts.wood || 0).toBe(0);
  expect(s.ecs.spatial[w.player]).not.toEqual(before);
  w.step(3);
  expect(r.status).toBe('completed');
  expect(task.progress).toBe(1);
  expect(s.ecs.container[w.camp].amounts.wood).toBe(2);
  expect(s.ecs.container[w.store].amounts.wood).toBe(1);
  expect(s.ecs.relationships[w.person].known[w.player].ring).toBe('social');
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBeCloseTo(12 - .025 * 3, 0);
  const earned = s.ecs.relationships[w.person].known[w.player].goodwill;
  finishFavour(s, r); finishFavour(s, r);
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBe(earned);
  expect(s.events.filter(e => e.type == 'favour')).toHaveLength(1);
  expect(s.knowledge[w.player].events).toContain(s.events.find(e => e.type == 'favour').id);
  expect(s.ecs.controllable[w.person].controllerId).toBe(w.person);
});

it('consumes actual delivered wood only as oven work progresses, without wood use in other trades', () => {
  const w = favourWorld(), s = w.state;
  expect(fuelReady(s, w.workplace)).toBe(false);
  s.ecs.container[w.store].amounts.wood = 1;
  const world = { workRemaining: 0 };
  s.ecs.spatial[w.person] = { ...s.ecs.spatial[w.workplace] };
  trade_work(s, w.person, world, HOUR / 4, true, w.workplace);
  expect(s.ecs.container[w.store].amounts.wood).toBe(0);
  expect(s.ecs.workplace[w.workplace].fuelHours).toBeCloseTo(3.75);
  expect(s.ecs.workplace[w.workplace].workHours).toBeCloseTo(.25);
  s.ecs.workplace[w.workplace].trade = 'weaver';
  expect(fuelReady(s, w.workplace)).toBe(true);
});

it('harvests after acceptance, preserves family ownership and physically hauls that crop home', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  const task = acceptFavour(s, r.id);
  w.step(6);
  expect(r.status).toBe('completed');
  expect(r.progress).toBe(3);
  expect(r.delivered).toBe(6);
  expect(s.ecs.container[w.store].amounts.grain).toBe(36);
  expect(s.ecs.container[w.camp].amounts.grain).toBe(6);
  expect(task.progress).toBe(1);
  expect(s.ecs.controllable[w.field].controllerId).toBe(w.person);
  expect(s.ecs.farmable[w.field].slots.filter(slot => slot.state == 'harvested')).toHaveLength(3);
});

it.each(['dead', 'lost', 'resolved'])('resolves a %s accepted target with explicit text and no reward', why => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  const task = acceptFavour(s, r.id);
  if (why == 'dead') s.ecs.personable[r.giverId].dead = true;
  if (why == 'lost') deleteEntity(s, w.store);
  if (why == 'resolved') s.ecs.container[w.store].amounts.wood = 1;
  updateFavours(s); readyPlayerTasks(s);
  expect(r.status).toBe('expired');
  expect(task.waiting).toMatch(/died|gone|met/);
  expect(s.ecs.relationships[r.giverId].known[w.player]?.goodwill || 0).toBe(0);
});

it('waits for unavailable player goods, skips to explicit gathering and never steals family goods', () => {
  const w = favourWorld(), s = w.state;
  s.ecs.container[w.camp].amounts.wood = 0;
  s.ecs.container[w.store].amounts.grain = 99;
  const r = w.request('wood'), task = acceptFavour(s, r.id);
  const move = enqueueTask(s, { key: 'move_to_here' }, w.tiles[0]);
  expect(readyPlayerTasks(s)).toEqual([move]);
  expect(task.waiting).toContain('your wood');
  w.step(2);
  expect(r.progress).toBe(0);
  expect(s.ecs.container[w.store].amounts.grain).toBe(99);
});

it('resumes after a meal, and cancellation leaves collected goods without goodwill', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  const task = acceptFavour(s, r.id);
  for (let i = 0; i < 100 && !r.cargo.length; i++) w.step(.02);
  expect(r.cargo).toHaveLength(1);
  s.ecs.personable[w.player].hunger = 1.2;
  w.step(3);
  expect(s.ecs.personable[w.player].hunger).toBeLessThan(.5);
  expect(r.status).toBe('completed');
  expect(task.progress).toBe(1);
  // A separate accepted request cannot refund goods or claim completion on cancel.
  s.ecs.workplace[w.workplace].fuelHours = 0; s.ecs.container[w.store].amounts.wood = 0;
  updateFavours(s); const next = w.request('wood'), queued = acceptFavour(s, next.id);
  for (let i = 0; i < 200 && !next.cargo.length; i++) w.step(.02);
  const item = next.cargo[0]; cancelTask(s, queued.id);
  expect(s.ecs.haulable[item].heldBy).toBe(w.player);
  expect(next.status).toBe('cancelled');
  expect(s.ecs.container[w.camp].amounts.wood).toBe(1);
});

it('delivers food from genuine player ownership and rechecks a vanished cargo instead of crediting it', () => {
  const w = favourWorld(), s = w.state;
  s.ecs.container[w.store].amounts.grain = 0; updateFavours(s);
  const r = w.request('food'); acceptFavour(s, r.id);
  w.step(6);
  expect(r.status).toBe('completed');
  expect(r.delivered).toBe(3);
  expect(s.ecs.container[w.store].amounts.grain).toBe(3);
  expect(s.ecs.container[w.camp].amounts.grain).toBe(3);
});

it('honours hostile disposition and ring capacity on an otherwise full promised reward', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  s.opinionThresholds = { hate: 100, love: 200 };
  acceptFavour(s, r.id); w.step(3);
  expect(r.status).toBe('completed');
  expect(s.ecs.relationships[r.giverId].known[w.player].goodwill).toBeGreaterThan(11);
  expect(s.ecs.relationships[r.giverId].known[w.player].ring).toBe('public');
});

it('never eats borrowed harvest during a real meal interruption and releases family cargo on cancel', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  const task = acceptFavour(s, r.id);
  for (let i = 0; i < 300 && !r.cargo.some(id => s.ecs.haulable[id]?.heldBy == w.player); i++) w.step(.01);
  const borrowed = r.cargo.find(id => s.ecs.haulable[id]?.heldBy == w.player);
  expect(borrowed).toBeDefined();
  expect(s.ecs.controllable[borrowed].controllerId).toBe(w.person);
  s.ecs.personable[w.player].hunger = 1.2;
  for (let i = 0; i < 500 && s.ecs.personable[w.player].hunger > .5; i++) w.step(.01);
  expect(s.ecs.personable[w.player].hunger).toBeLessThan(.5);
  expect(s.ecs.container[w.camp].amounts.grain).toBe(5);
  expect(s.ecs.good[borrowed] || s.ecs.container[w.store].amounts.grain > 30).toBeTruthy();
  cancelTask(s, task.id);
  for (const id of r.cargo) if (s.ecs.good[id]) {
    expect(s.ecs.controllable[id].controllerId).toBe(w.person);
    expect(s.ecs.haulable[id].heldBy).not.toBe(w.player);
  }
  expect(r.status).toBe('cancelled');
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBe(0);
});

it('does not give credit for an unavailable collected delivery and preserves previous work on cancel', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  const task = acceptFavour(s, r.id);
  for (let i = 0; i < 300 && !r.cargo.length; i++) w.step(.01);
  const item = r.cargo[0]; expect(item).toBeDefined();
  require('game/holder').take(s.ecs, item); deleteEntity(s, item);
  s.ecs.container[w.camp].amounts.wood = 0;
  w.step(2);
  expect(r.delivered).toBe(0); expect(r.status).toBe('accepted');
  expect(task.waiting).toContain('your wood');
});

it('repeats the complete accepted delivery trajectory deterministically', () => {
  const a = favourWorld(), b = favourWorld();
  for (const w of [a,b]) { acceptFavour(w.state, w.request('wood').id); w.step(4); }
  expect(a.state).toEqual(b.state);
});

it('lets the resident family retain ownership under a remote legal heir, without allowing the player to eat their crop', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  s.ecs.controllable[w.house].controllerId = w.parent;
  s.ecs.controllable[w.field].controllerId = w.parent;
  s.ecs.household[w.parent].houseId = w.tiles[5];
  acceptFavour(s, r.id);
  for (let i = 0; i < 300 && !r.cargo.length; i++) w.step(.01);
  const item = r.cargo[0]; expect(item).toBeDefined();
  expect(s.ecs.controllable[item].controllerId).toBe(w.parent);
  expect(require('game/playable').householdAccess(s.ecs, w.person, item)).toBe(true);
  expect(require('game/playable').householdAccess(s.ecs, w.player, item)).toBe(false);
});

it('reserves an accepted harvest for its delivery, then releases it to family haulers on cancellation', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  const task = acceptFavour(s, r.id);
  for (let i = 0; i < 300 && !r.cargo.length; i++) w.step(.01);
  for (const item of r.cargo) expect(s.ecs.haulable[item].reservedFor).toBe(w.player);
  cancelTask(s, task.id);
  for (const item of r.cargo) expect(s.ecs.haulable[item].reservedFor).toBeUndefined();
});

it('applies existing ring capacities when completing a favour', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  const list = s.ecs.relationships[w.person].known;
  for (const bond of Object.values(list)) if (bond.ring == 'social') bond.ring = 'public';
  for (let i = 0; i < 10; i++) list['known-'+i] = { ring: 'social', goodwill: 16+i, base: 16+i };
  // Existing capacity code displaces its weakest member; it never creates an
  // eleventh Social slot or changes the player's opinion in the other direction.
  acceptFavour(s, r.id); w.step(3);
  expect(Object.values(list).filter(b => b.ring == 'social')).toHaveLength(10);
  expect(list[w.player].ring).toBe('social');
  expect(list['known-0'].ring).toBe('public');
  expect(s.ecs.relationships[w.player].known[w.person].ring).toBe('public');
});

it('sleeps automatically before resuming an accepted favour', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  s.villages = {};
  s.days = 20/24; s.ecs.planner[w.player].world.days = s.days;
  s.ecs.personable[w.player].tiredness = 1.1;
  const task = acceptFavour(s, r.id);
  let slept = false;
  for (let i = 0; i < 700; i++) { w.step(.02); slept ||= s.ecs.planner[w.player].task?.[0] == 'sleep'; }
  expect(slept).toBe(true);
  expect(r.status).toBe('completed'); expect(task.progress).toBe(1);
});

it('reports missing harvested cargo rather than completing or endlessly working an impossible request', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  const task = acceptFavour(s, r.id);
  for (let i = 0; i < 300 && !r.cargo.length; i++) w.step(.01);
  deleteEntity(s, r.cargo[0]);
  updateFavours(s); readyPlayerTasks(s);
  expect(r.status).toBe('expired'); expect(task.waiting).toContain('cargo no longer available');
});

it('preserves family cargo when reordering an explicit gathering task ahead of its delivery', () => {
  const w = favourWorld(), s = w.state, r = w.request('harvest');
  const favour = acceptFavour(s, r.id);
  for (let i = 0; i < 300 && !r.cargo.some(id => s.ecs.haulable[id]?.heldBy == w.player); i++) w.step(.01);
  const borrowed = r.cargo.find(id => s.ecs.haulable[id]?.heldBy == w.player);
  const [plant] = newEntities(s, [{ spatial: { ...s.ecs.spatial[w.tiles[0]] }, forageable: { kind: 'berries', biome: 'grassland', amount: 2, growth: 0 } }]);
  const gather = enqueueTask(s, { key: 'forage' }, plant);
  reorderTask(s, gather.id, 0);
  for (let i = 0; i < 400 && s.ecs.manager[w.player].jobs.includes(gather); i++) w.step(.01);
  expect(gather.progress).toBe(1);
  expect(s.ecs.container[w.camp].amounts.grain).toBe(6);
  expect(s.ecs.container[w.camp].amounts.forage).toBe(1);
  expect(s.ecs.haulable[borrowed].heldBy).toBe(w.player);
  expect(s.ecs.controllable[borrowed].controllerId).toBe(w.person);
  cancelTask(s, favour.id);
});

it('learns the visible requesters name through existing knowledge without meeting them or revealing relatives', () => {
  const w = favourWorld(), s = w.state;
  expect(s.knowledge[w.player].people[w.person]).toEqual({ traits: [] });
  expect(s.knowledge[w.player].people[w.parent]).toBeUndefined();
  expect(s.knowledge[w.player].people[w.sibling]).toBeUndefined();
  expect(s.ecs.relationships[w.player].known[w.person]).toBeUndefined();
  expect(require('game/knowledge').displayName(s, w.person, () => 'Agnes Miller')).toBe('Agnes Miller');
});

it('refuses minor favour acceptance before introduction, status, queue or rewards change', () => {
  const w = favourWorld(), s = w.state, r = w.request('wood');
  s.ecs.personable[w.player].age = 10;
  const before = JSON.stringify({ request: r, knowledge: s.knowledge, relationships: s.ecs.relationships, jobs: s.ecs.manager[w.player].jobs });
  expect(acceptFavour(s, r.id)).toBeNull();
  expect(JSON.stringify({ request: r, knowledge: s.knowledge, relationships: s.ecs.relationships, jobs: s.ecs.manager[w.player].jobs })).toBe(before);
  s.ecs.personable[w.player].age = 24;
  const task = acceptFavour(s, r.id);
  expect(task).toMatchObject({ favourId: r.id, forId: r.giverId });
  expect(r).toMatchObject({ status: 'accepted', taskId: task.id, actorId: w.player });
});
