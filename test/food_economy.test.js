import { economy } from "./support/economy";
import { newEntities } from "game/entities";
import { enqueueTask, reorderTask } from "game/manager";
import { give } from "game/holder";
import * as tasks from "game/tasks";
import { Task } from "game/htn";
import { HOUR } from "game/time";
import { completeTradeProduction } from "game/settlement_growth";
import { advanceOffscreenNeeds } from "game/needs";
import { settleSeason } from "game/settlement";
import { stationarySupplies } from "game/stationary_care";
import { collectShelterLog, deliverShelterLog, shelterLogSource } from "game/construction";
import { householdFood } from "game/favours";

function goods(f, types) {
  return newEntities(f.s, types.map(type => ({ spatial: { ...f.s.ecs.spatial[f.p] }, good: { type, amount: 1 }, haulable: {}, controllable: { controllerId: f.p } })));
}

it.each(["bread", "flour"])("eats %s in live orders, stationary care and household food accounting", type => {
  const f = economy(), { s, p, camp } = f;
  s.ecs.container[camp].amounts = { [type]: 5 };
  expect(stationarySupplies(s, p).meal).toMatchObject({ type, kind: "container" });
  expect(householdFood(s).get(camp)).toBe(5);
  s.ecs.personable[p].hunger = 2;
  enqueueTask(s, { key: "find_food" }, p);
  f.step(90);
  expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
  expect(s.ecs.container[camp].amounts[type]).toBe(4);
});

it("uses flour for baking and consumes its input exactly once", () => {
  const { s, p, camp } = economy();
  const [mill, oven] = newEntities(s, ["miller", "baker"].map(trade => ({ workplace: { trade, houseId: camp } })));
  s.ecs.container[camp].amounts = { grain: 1 };
  expect(completeTradeProduction(s, mill, p)).toBe(true);
  expect(completeTradeProduction(s, oven, p)).toBe(true);
  expect(s.ecs.container[camp].amounts).toEqual({ grain: 0, flour: 1, bread: 2 });
});

it.each(["grain", "wood", "bread", "flour"])("cannot pick up a whole %s from a fractional reserve", type => {
  const { s, p, camp, world } = economy();
  s.ecs.container[camp].amounts = { [type]: .25 }; world.places.food = camp;
  expect(tasks.pick_up_from_container(s, p, world, 0, true, "food", type)).toBe(Task.ABORT);
  expect(s.ecs.container[camp].amounts[type]).toBe(.25);
  expect(s.ecs.holder[p].held).toEqual([]);
  expect(stationarySupplies(s, p).meal).toBeUndefined();
});

it.each([["miller", "grain"], ["baker", "flour"], ["carpenter", "wood"]])("%s cannot turn fractions into free output", (trade, input) => {
  const { s, p, camp } = economy();
  const [w] = newEntities(s, [{ workplace: { trade, houseId: camp } }]);
  s.ecs.container[camp].amounts = { [input]: .25 };
  for (let i = 0; i < 4; i++) expect(completeTradeProduction(s, w, p)).toBe(false);
  expect(s.ecs.container[camp].amounts).toEqual({ [input]: .25 });
});

it("accepts stored and held planks as shelter timber and rejects fractional timber", () => {
  const { s, p, camp, world } = economy();
  s.ecs.container[camp].amounts = { planks: 2 };
  expect(shelterLogSource(s, p)).toBe(camp);
  expect(collectShelterLog(s, p, world, 0, true, camp)).toBe(Task.FINISH);
  const [site] = newEntities(s, [{ construction: { stage: "lean-to", delivered: 0, work: 0 } }]);
  expect(deliverShelterLog(s, p, world, 0, true, site)).toBe(Task.FINISH);
  expect(s.ecs.construction[site].delivered).toBe(1);
  expect(s.ecs.container[camp].amounts.planks).toBe(1);
  s.ecs.container[camp].amounts = { wood: .25 };
  expect(collectShelterLog(s, p, world, 0, true, camp)).toBe(Task.ABORT);
});

it("leaves a ripe slot intact when household storage cannot fit the yield, including loose backlog", () => {
  const { s, p, camp, world } = economy();
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[p] }, farmable: { houseId: camp, slots: [{ state: "harvestable", content: "grain", amount: 6 }] }, controllable: { controllerId: p } }]);
  world.places.slot = { idx: 0, result: "harvested", ...s.ecs.spatial[p] };
  s.ecs.container[camp].capacity = 100;
  expect(tasks.perform_subtask_in_slot(s, p, world, HOUR, true, field, "slot")).toBe(Task.ABORT);
  expect(s.ecs.farmable[field].slots[0].state).toBe("harvestable");
  s.ecs.container[camp].amounts.grain = 94;
  const [loose] = goods({ s, p }, ["grain"]);
  expect(tasks.perform_subtask_in_slot(s, p, world, HOUR, true, field, "slot")).toBe(Task.ABORT);
  delete s.ecs.good[loose];
  expect(tasks.perform_subtask_in_slot(s, p, world, HOUR, true, field, "slot")).toBe(Task.FINISH);
  expect(Object.values(s.ecs.good).reduce((n,g) => n + g.amount, 0)).toBe(6);
});

it.each([false, true])("makes room for a meal with full non-food hands (ordered=%s)", ordered => {
  const f = economy(), { s, p, camp, world } = f;
  for (const id of goods(f, ["wood", "wood"])) give(s.ecs, id, p);
  world.holding.wood = true;
  s.ecs.personable[p].hunger = 2;
  if (ordered) enqueueTask(s, { key: "find_food" }, p);
  f.step(90);
  expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
  expect(s.ecs.container[camp].amounts.grain).toBe(99);
  expect(Object.values(s.ecs.good).filter(g => g.type == "wood").reduce((n,g) => n + g.amount, 0) + (s.ecs.container[camp].amounts.wood || 0)).toBe(2);
});

it("foraging ahead of a collected commodity gift preserves the promised item and completes both orders", () => {
  const f = economy(), { s, p, camp, tiles, world } = f;
  s.ecs.container[camp].amounts = { wood: 1, grain: 10 };
  const [npc, plant] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[tiles[5]] }, personable: { age: 30, hunger: 0, tiredness: 0 }, controllable: {}, holder: { capacity: 2, held: [] }, planner: { world: { customsHold: true, places: {}, no_place_for: {}, feeling: {}, holding: {} } }, manager: { jobs: [] } },
    { spatial: { ...s.ecs.spatial[tiles[1]], immovable: true }, forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 } }
  ]);
  s.ecs.controllable[npc].controllerId = npc;
  s.ecs.planner[npc].id = npc;
  // Gift dialogue needs ordinary social records.
  for (const key of ["relationships", "personality", "kinship"]) s.ecs[key] = {};
  for (const id of [p, npc]) { s.ecs.relationships[id] = { known: {} }; s.ecs.personality[id] = { traits: [], likes: [], dislikes: [] }; s.ecs.kinship[id] = { parents: [], children: [] }; }
  const gift = enqueueTask(s, { key: "give_gift" }, npc, { gift: { sourceId: camp, type: "wood" } });
  for (let i = 0; i < 60 && !gift.giftItem; i++) f.step(1);
  expect(gift.giftItem).toBeTruthy();
  const forage = enqueueTask(s, { key: "forage" }, plant);
  reorderTask(s, forage.id, 0);
  f.step(4 * 60);
  expect(s.ecs.manager[p].jobs).toEqual([]);
  expect(s.ecs.good[gift.giftItem].type).toBe("wood");
  expect(s.ecs.controllable[gift.giftItem].controllerId).toBe(npc);
  expect(world.currentJob).toBeFalsy();
});

it("offscreen sowing consumes a full seed per slot and meals include bread and flour", () => {
  const { s, p, camp, tiles } = economy();
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[4]] }, farmable: { houseId: camp, slots: [{ state: "empty" }, { state: "empty" }] }, controllable: { controllerId: p } }]);
  s.ecs.building[camp] = { id: camp, rooms: [] };
  s.ecs.household[camp].fields = [field];
  s.ecs.container[camp].amounts = { grain: .25, bread: 1, flour: 3 };
  s.settlement = { lastSeason: 0, journeys: [], sites: {}, estatesInitialized: false };
  s.ecs.growth = { [camp]: { id: camp, builtDay: -10, stage: 0, production: 0, lastProduction: 0, supportedSeasons: 0, additions: [], meetings: {} } };
  s.days = 3;
  settleSeason(s, 1, true);
  expect(s.ecs.farmable[field].slots.map(slot => slot.state)).toEqual(["empty", "empty"]);
  expect(s.ecs.household[camp].livelihood.grainSown).toBe(0);
  advanceOffscreenNeeds(s,3);
  expect(s.ecs.household[camp].livelihood.foodConsumed).toBe(3);
  expect(s.ecs.container[camp].amounts.bread).toBe(0);
  expect(s.ecs.container[camp].amounts.flour).toBe(1);
});

it("rejects a whole delivery when only fractional storage space remains", () => {
  const f=economy(), {s,p,camp,world}=f;
  s.ecs.container[camp].capacity=1;s.ecs.container[camp].amounts={grain:.25};
  const [wood]=goods(f,["wood"]);give(s.ecs,wood,p);world.places.store=camp;
  expect(tasks.drop_entity_into_container(s,p,world,0,true,"store","wood")).toBe(Task.ABORT);
  expect(s.ecs.container[camp].amounts).toEqual({grain:.25});
  expect(s.ecs.holder[p].held).toContain(wood);
});

it("recovers a promised gift set down to make room for a meal", () => {
  const f=economy(2),{s,p,camp,tiles}=f;
  s.ecs.container[camp].amounts={wood:2,grain:10};
  const [npc]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},personable:{age:30,hunger:0,tiredness:0},controllable:{},holder:{capacity:2,held:[]},planner:{world:{customsHold:true,places:{},no_place_for:{},feeling:{},holding:{}}},manager:{jobs:[]}}]);
  s.ecs.controllable[npc].controllerId=npc;
  for(const key of ["relationships","personality","kinship"])s.ecs[key]={};
  for(const id of [p,npc]){s.ecs.relationships[id]={known:{}};s.ecs.personality[id]={traits:[],likes:[],dislikes:[]};s.ecs.kinship[id]={parents:[],children:[]};}
  const first=enqueueTask(s,{key:"give_gift"},npc,{gift:{sourceId:camp,type:"wood"}});
  for(let i=0;i<60&&!first.giftItem;i++)f.step(1);
  const second=enqueueTask(s,{key:"give_gift"},npc,{gift:{sourceId:camp,type:"wood"}});
  reorderTask(s,second.id,0);
  for(let i=0;i<60&&!second.giftItem;i++)f.step(1);
  expect(s.ecs.holder[p].held).toEqual(expect.arrayContaining([first.giftItem,second.giftItem]));
  s.ecs.personable[p].hunger=2;
  f.step(180);
  expect(s.ecs.personable[p].hunger).toBeLessThan(.3);
  expect(s.ecs.manager[p].jobs).toEqual([]);
  for(const gift of [first,second])expect(s.ecs.controllable[gift.giftItem].controllerId).toBe(npc);
});
