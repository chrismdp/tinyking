import { peopleWorld } from './support/people';
import { newEntities } from 'game/entities';
import { enqueueTask } from 'game/manager';
import { friendWork } from 'game/friend_help';
import { give } from 'game/holder';

function world() {
  const w = peopleWorld(), s = w.state;
  const [site, food] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[w.tiles[5]] }, construction: { stage: 'lean-to', delivered: 4, work: 0 }, shelter: { stage: null }, nameable: { nickname: 'Lean-to' }, controllable: { controllerId: w.player } },
    { spatial: { ...s.ecs.spatial[w.tiles[3]] }, good: { type: 'grain', amount: 1 }, haulable: {}, controllable: { controllerId: w.person } }
  ]);
  s.ecs.spatial[w.person] = { ...s.ecs.spatial[w.tiles[0]] };
  s.ecs.sleepable ||= {}; s.ecs.container ||= {}; s.ecs.camp ||= {};
  s.ecs.relationships[w.person].known[w.player] = { ring: 'personal', goodwill: 36, base: 36 };
  enqueueTask(s, { key: 'build_shelter' }, site);
  return { ...w, site, food };
}

it('requires THEIR Personal ring for the player, a fed free adult, and available materials', () => {
  const w = world(), s = w.state;
  expect(friendWork(s, w.person)).toMatchObject({ kind: 'build', targetId: w.site });
  delete s.ecs.relationships[w.person].known[w.player];
  s.ecs.relationships[w.player].known[w.person] = { ring: 'personal', goodwill: 50 };
  expect(friendWork(s, w.person)).toBeNull();
  s.ecs.relationships[w.person].known[w.player] = { ring: 'personal', goodwill: 36 };
  s.ecs.personable[w.person].hunger = 1;
  expect(friendWork(s, w.person)).toBeNull();
  s.ecs.personable[w.person].hunger = 0;
  s.ecs.construction[w.site].delivered = 0;
  expect(friendWork(s, w.person)).toBeNull();
  expect(Object.keys(s.ecs.good)).toEqual([w.food]);
});

it('walks to the actual site and adds construction work without changing home, jobs or controller', () => {
  const w = world(), s = w.state;
  const before = { ...s.ecs.spatial[w.person] }, home = { ...s.ecs.household[w.person] };
  w.step(.1);
  expect(s.ecs.spatial[w.person]).not.toEqual(before);
  expect(s.ecs.construction[w.site].work).toBe(0);
  let helped = false;
  for (let i = 0; i < 100; i++) {
    w.step(.05);
    if (s.ecs.planner[w.person].task?.[0] == 'help_friend_work') {
      helped = true;
      const point = s.ecs.planner[w.person].world.helpingFriend;
      expect(Math.hypot(s.ecs.spatial[w.person].x - point.x, s.ecs.spatial[w.person].y - point.y)).toBeLessThanOrEqual(10);
      expect(Math.hypot(s.ecs.spatial[w.person].x - s.ecs.spatial[w.site].x, s.ecs.spatial[w.person].y - s.ecs.spatial[w.site].y)).toBeLessThanOrEqual(50);
    }
  }
  expect(helped).toBe(true);
  expect(s.ecs.shelter[w.site].stage).toBe('lean-to');
  expect(s.ecs.household[w.person]).toEqual(home);
  expect(s.ecs.controllable[w.person].controllerId).toBe(w.person);
  expect(s.ecs.manager[w.person].jobs).toEqual([]);
});

it('stops helping when friendship lapses and meals interrupt the helper before resuming', () => {
  const w = world(), s = w.state;
  give(s.ecs, w.food, w.person); s.ecs.planner[w.person].world.holding.grain = true;
  for (let i = 0; i < 100 && s.ecs.planner[w.person].task?.[0] != 'help_friend_work'; i++) w.step(.02);
  expect(s.ecs.planner[w.person].task?.[0]).toBe('help_friend_work');
  s.ecs.personable[w.person].hunger = 1.2;
  w.step(.1);
  expect(s.ecs.planner[w.person].task?.[0]).toBe('eat');
  w.step(1.2);
  expect(s.ecs.personable[w.person].hunger).toBeLessThan(.3);
  s.ecs.relationships[w.person].known[w.player].ring = 'social';
  w.step(.1);
  expect(s.ecs.planner[w.person].task?.[0]).not.toBe('help_friend_work');
});

it('serialises simultaneous builders so the last log and completion cannot be consumed twice', () => {
  const w = world(), s = w.state;
  s.ecs.relationships[w.parent].known[w.player] = { ring: 'intimate', goodwill: 66, base: 66 };
  s.ecs.construction[w.site].work = 1.99;
  w.step(2);
  expect(s.ecs.shelter[w.site].stage).toBe('lean-to');
  expect(s.ecs.construction[w.site]).toBeUndefined();
  expect(s.ecs.container[w.site].capacity).toBe(8);
  expect(s.ecs.manager[w.player].jobs).toEqual([]);
});

it('helps field slots with actual work and preserves the player harvest, without duplicate crops', () => {
  const w = world(), s = w.state;
  s.ecs.manager[w.player].jobs.length = 0;
  delete s.ecs.construction[w.site];
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[w.tiles[5]] }, farmable: { slots: Array.from({length: 5}, () => ({ state: 'harvestable', content: 'grain', amount: 2 })), claimerId: w.player }, controllable: { controllerId: w.player } }]);
  s.ecs.planner[w.player].world.claimedFarmable = field;
  expect(friendWork(s, w.person)).toMatchObject({ kind: 'field', targetId: field });
  let helped = false;
  for (let i = 0; i < 100; i++) { w.step(.03); if (s.ecs.planner[w.person].task?.[0] == 'help_friend_work') helped = true; }
  expect(helped).toBe(true);
  const grain = Object.values(s.ecs.good).filter(g => g.type == 'grain' && s.ecs.controllable[g.id].controllerId == w.player).reduce((n,g) => n+g.amount,0);
  const sown = s.ecs.farmable[field].slots.filter(slot => slot.state == 'sown').length;
  expect(grain + sown + Object.values(s.ecs.container).reduce((n,c) => n+(c.amounts?.grain||0),0)).toBe(10);
  expect(s.ecs.controllable[field].controllerId).toBe(w.player);
});

it('keeps a hungry player eating while the independent helper contributes', () => {
  const w = world(), s = w.state;
  const [food] = newEntities(s, [{ spatial: { ...s.ecs.spatial[w.player] }, good: { type: 'grain', amount: 1 }, haulable: {}, controllable: { controllerId: w.player } }]);
  give(s.ecs, food, w.player); s.ecs.planner[w.player].world.holding.grain = true;
  s.ecs.personable[w.player].hunger = 1.2;
  let ate = false, helped = false;
  for (let i = 0; i < 160; i++) { w.step(.02); ate ||= s.ecs.planner[w.player].task?.[0] == 'eat'; helped ||= s.ecs.planner[w.person].task?.[0] == 'help_friend_work'; }
  expect(ate).toBe(true); expect(helped).toBe(true);
  expect(s.ecs.personable[w.player].hunger).toBeLessThan(.5);
});

it('keeps helper capacity at one and lets its own queued job take precedence', () => {
  const w = world(), s = w.state;
  s.ecs.relationships[w.parent].known[w.player] = { ring: 'personal', goodwill: 36, base: 36 };
  for (let i = 0; i < 100; i++) {
    w.step(.01);
    expect(Object.values(s.ecs.planner).filter(p => p.world.helpingFriend?.targetId == w.site).length).toBeLessThanOrEqual(1);
  }
  s.ecs.manager[w.person].jobs.push({ job: { key: 'move_to_here' }, targetId: w.tiles[0] });
  expect(friendWork(s, w.person)).toBeNull();
});

it('releases a dead helper slot while preserving the player and other workers claims', () => {
  const w = world(), s = w.state;
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[w.tiles[5]] }, farmable: { slots: [{ state: 'harvestable', workerId: w.person }, { state: 'ploughed', workerId: w.player }], claimerId: w.player }, controllable: { controllerId: w.player } }]);
  s.ecs.planner[w.person].world.helpingFriend = { kind: 'field', targetId: field, idx: 0 };
  require('game/possessions').die(s, w.person);
  expect(s.ecs.farmable[field].slots[0].workerId).toBeUndefined();
  expect(s.ecs.farmable[field].slots[1].workerId).toBe(w.player);
  expect(s.ecs.farmable[field].claimerId).toBe(w.player);
  expect(s.ecs.planner[w.person].world.helpingFriend).toBeUndefined();
});

it('stops at a cancelled player build and releases its helper capacity', () => {
  const w = world(), s = w.state;
  for (let i = 0; i < 200 && s.ecs.planner[w.person].task?.[0] != 'help_friend_work'; i++) w.step(.01);
  expect(s.ecs.planner[w.person].world.helpingFriend).toBeDefined();
  require('game/manager').cancelTask(s, s.ecs.manager[w.player].jobs[0].id);
  const work = s.ecs.construction[w.site].work;
  w.step(.1);
  expect(s.ecs.planner[w.person].world.helpingFriend).toBeUndefined();
  expect(s.ecs.construction[w.site].work).toBe(work);
});

it('finishes the queued building when a friend completes it while the player sleeps', () => {
  const w = world(), s = w.state;
  const [bed] = newEntities(s, [{ spatial: { ...s.ecs.spatial[w.tiles[0]] }, sleepable: { capacity: 1, occupiers: [] }, controllable: { controllerId: w.player } }]);
  s.days = 20/24; s.villages = {};
  for (const p of Object.values(s.ecs.planner)) p.world.days = s.days;
  s.ecs.personable[w.player].tiredness = 1.2;
  const job = s.ecs.manager[w.player].jobs[0];
  expect(bed).toBeDefined();
  w.step(12);
  expect(s.ecs.shelter[w.site].stage).toBe('lean-to');
  expect(s.ecs.manager[w.player].jobs).toEqual([]);
  expect(job.progress).toBe(1);
});

it('releases only the movers slot claims and helper capacity when their household routine resets', () => {
  const w = world(), s = w.state;
  const [field, home] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[w.tiles[5]] }, farmable: { slots: [{ state: 'harvestable', workerId: w.person }, { state: 'ploughed', workerId: w.player }], claimerId: w.player }, controllable: { controllerId: w.player } },
    { spatial: { ...s.ecs.spatial[w.tiles[4]] }, building: { rooms: [] }, controllable: { controllerId: w.parent } }
  ]);
  s.ecs.planner[w.person].world.helpingFriend = { kind: 'field', targetId: field, idx: 0 };
  require('game/social').moveHouse(s, w.person, home);
  expect(s.ecs.farmable[field].slots[0].workerId).toBeUndefined();
  expect(s.ecs.farmable[field].slots[1].workerId).toBe(w.player);
  expect(s.ecs.planner[w.person].world.helpingFriend).toBeUndefined();
  expect(s.ecs.planner[w.person].world.moveHome).toBe(home);
});

it('puts a free friends help ahead of routine farming while preserving their own explicit orders', () => {
  const w = world(), s = w.state;
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[w.tiles[0]] }, farmable: { slots: Array.from({length: 3}, () => ({ state: 'empty' })) }, controllable: { controllerId: w.person } }]);
  let firstWork;
  for (let i = 0; i < 200 && !firstWork; i++) {
    w.step(.01);
    const task = s.ecs.planner[w.person].task?.[0];
    if (['help_friend_work', 'perform_subtask_in_slot'].includes(task)) firstWork = task;
  }
  expect(firstWork).toBe('help_friend_work');
  expect(s.ecs.farmable[field].slots.every(slot => slot.state == 'empty')).toBe(true);
  expect(s.ecs.controllable[w.person].controllerId).toBe(w.person);
});

it('gives a builder friend a separate nearby work position so both workers are visible', () => {
  const w = world(), s = w.state;
  let together = false;
  for (let i = 0; i < 300 && !together; i++) { w.step(.01); together = s.ecs.planner[w.person].task?.[0] == 'help_friend_work' && s.ecs.planner[w.player].task?.[0] == 'work_shelter'; }
  expect(together).toBe(true);
  const helper = s.ecs.spatial[w.person], player = s.ecs.spatial[w.player], site = s.ecs.spatial[w.site];
  expect(Math.hypot(helper.x-player.x,helper.y-player.y)).toBeGreaterThan(28);
  expect(Math.hypot(helper.x-site.x,helper.y-site.y)).toBeLessThanOrEqual(50);
});
