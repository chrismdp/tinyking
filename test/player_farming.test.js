import { economy } from "./support/economy";
import { enqueueTask } from "game/manager";
import { newEntities } from "game/entities";
import { friendWork } from "game/friend_help";
import { create_field } from "game/tasks";
import { HOUR } from "game/time";
import { Task } from "game/htn";
import { fieldOrders } from "game/manager";

it("registers a created camp field and completes plough, sow, tend and harvest orders with real seed and grain", () => {
  const f = economy(2), { s, p, camp, tiles } = f;
  const create = enqueueTask(s, { key: "create_field" }, tiles[1]);
  f.step(180);
  const field = Object.keys(s.ecs.farmable)[0], farm = s.ecs.farmable[field];
  expect(s.ecs.manager[p].jobs).not.toContain(create);
  expect(farm.houseId).toBe(camp);
  expect(s.ecs.household[camp].fields).toContain(field);
  expect(farm.slots).toHaveLength(19);
  // Keep the complete food-loop fixture narrow; the work task must also finish
  // all 19 patches in the separate field-claim regression below.
  farm.slots = farm.slots.slice(0, 2);
  expect(fieldOrders(s, p, field).map(j => j.key)).toContain("plough_field");
  enqueueTask(s, { key: "plough_field" }, field);
  f.step(180);
  expect(farm.slots.every(slot => slot.state == "ploughed")).toBe(true);
  const seed = s.ecs.container[camp].amounts.grain;
  enqueueTask(s, { key: "sow_field" }, field);
  f.step(300);
  expect(farm.slots.every(slot => slot.state == "sown")).toBe(true);
  expect(s.ecs.container[camp].amounts.grain).toBe(seed - 2);
  const growth = farm.slots.reduce((n,slot) => n + slot.growth, 0);
  enqueueTask(s, { key: "tend_field" }, field);
  f.step(120);
  expect(farm.slots.some(slot => slot.tendedBy == p)).toBe(true);
  expect(farm.slots.reduce((n,slot) => n + slot.growth, 0)).toBeGreaterThan(growth);
  // Crop growth itself is covered by survival.test; stage this harvest input.
  for (const slot of farm.slots) Object.assign(slot, { state: "harvestable", content: "grain", amount: 6 });
  enqueueTask(s, { key: "harvest_field" }, field);
  f.step(300);
  expect(farm.slots.every(slot => slot.state == "harvested")).toBe(true);
  expect(s.ecs.container[camp].amounts.grain).toBe(seed - 2 + 12);
  expect(s.ecs.manager[p].jobs).toEqual([]);
});

it("a normal ordered field claim invites a Personal friend without a fabricated planner claim", () => {
  const f = economy(2), { s, p, camp, tiles } = f;
  expect(create_field(s, p, s.ecs.planner[p].world, HOUR, true, tiles[1])).toBe(Task.FINISH);
  const field = s.ecs.household[camp].fields[0];
  const [friend] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]] }, personable: { age: 30, hunger: 0, tiredness: 0 }, holder: { capacity: 2, held: [] }, controllable: {}, planner: { world: { places: {}, no_place_for: {}, feeling: {}, holding: {} } }, manager: { jobs: [] }, relationships: { known: { [p]: { ring: "personal", goodwill: 36 } } } }]);
  s.ecs.controllable[friend].controllerId = friend;
  enqueueTask(s, { key: "plough_field" }, field);
  // Inspect the offer at the first claim, then let the helper perform real work.
  s.ecs.planner[friend].world.customsHold = true;
  f.step(1);
  expect(s.ecs.planner[p].world.claimedFarmable).toBe(field);
  expect(friendWork(s, friend)).toMatchObject({ kind: "field", targetId: field });
  delete s.ecs.planner[friend].world.customsHold;
  let helped=false;
  for(let i=0;i<180;i++){f.step(1);helped ||= s.ecs.planner[friend].task?.[0]=="help_friend_work";}
  expect(helped).toBe(true);
  expect(s.ecs.farmable[field].slots.every(slot => slot.state == "ploughed")).toBe(true);
});

it("rejects farming another household's field", () => {
  const f = economy(), { s, p, tiles } = f;
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[1]] }, farmable: { houseId: "other", slots: [{ state: "empty" }] }, controllable: { controllerId: "other" } }]);
  expect(fieldOrders(s, p, field)).toEqual([]);
  const order = enqueueTask(s, { key: "plough_field" }, field);
  f.step(60);
  expect(order.waiting).toBeTruthy();
  expect(s.ecs.farmable[field].slots[0].state).toBe("empty");
});

it("includes a created camp field in the offscreen household summary", () => {
  const { s, p, camp, tiles } = economy(2);
  expect(create_field(s,p,s.ecs.planner[p].world,HOUR,true,tiles[1])).toBe(Task.FINISH);
  const field=s.ecs.household[camp].fields[0];
  s.settlement={lastSeason:0,journeys:[],sites:{},estatesInitialized:false};
  s.days=3;
  require("game/settlement").settleSeason(s,1,true);
  expect(s.ecs.farmable[field].slots.every(slot=>slot.state=="sown")).toBe(true);
  expect(s.ecs.household[camp].livelihood.grainSown).toBe(19);
});

it("explains missing seed and resumes sowing when owned grain becomes available", () => {
  const f=economy(2),{s,p,camp,tiles}=f;
  create_field(s,p,s.ecs.planner[p].world,HOUR,true,tiles[1]);
  const field=s.ecs.household[camp].fields[0];
  s.ecs.farmable[field].slots=[{state:'ploughed'}];
  s.ecs.container[camp].amounts={};
  const order=enqueueTask(s,{key:'sow_field'},field);
  f.step(1);
  expect(order.waiting).toBe('Needs seed grain. Help with a harvest to earn some.');
  s.ecs.container[camp].amounts.grain=1;
  f.step(120);
  expect(s.ecs.farmable[field].slots[0].state).toBe('sown');
  expect(s.ecs.container[camp].amounts.grain).toBe(0);
});

it("harvests a newcomer crop to owned loose grain when the camp has no pantry", () => {
  const f=economy(2),{s,p,camp,tiles}=f;
  delete s.ecs.container[camp];
  create_field(s,p,s.ecs.planner[p].world,HOUR,true,tiles[1]);
  const field=s.ecs.household[camp].fields[0];
  s.ecs.farmable[field].slots=[{state:'harvestable',content:'grain',amount:6}];
  const order=enqueueTask(s,{key:'harvest_field'},field);
  f.step(300);
  expect(s.ecs.manager[p].jobs).not.toContain(order);
  expect(s.ecs.farmable[field].slots[0].state).toBe('harvested');
  const grain=Object.keys(s.ecs.good).filter(id=>s.ecs.good[id].type=='grain');
  expect(grain).toHaveLength(6);
  for(const id of grain) {
    expect(s.ecs.controllable[id].controllerId).toBe(p);
    const pos=s.ecs.spatial[id],home=s.ecs.spatial[camp];
    expect(Math.hypot(pos.x-home.x,pos.y-home.y)).toBeLessThan(40);
    expect(s.space[require('game/hex').Hex().fromPoint(pos)]).toContain(id);
  }
});
