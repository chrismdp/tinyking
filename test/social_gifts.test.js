import { peopleWorld } from "./support/people";
import { createPossession } from "game/possessions";
import { giftChoices } from "game/gift_choices";
import { collect_gift, talk } from "game/tasks";
import { Task } from "game/htn";
import { newEntities } from "game/entities";

it("leaves separately carried heirlooms alone while NPCs eat and haul ordinary supplies", () => {
  const { state: s, person, tiles, step } = peopleWorld();
  const item = createPossession(s, person, "Family sword", "heirloom");
  const before = JSON.parse(JSON.stringify(s.ecs.possession[item]));
  const [store, wood] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[tiles[3]] }, interior: { buildingId: tiles[3] },
      container: { capacity: 20, amounts: { gruel: 3, wood: 0 } }, controllable: { controllerId: person } },
    { spatial: { ...s.ecs.spatial[tiles[3]] }, good: { type: "wood", amount: 1 },
      haulable: {}, controllable: { controllerId: person } }
  ]);
  s.ecs.personable[person].hunger = .95;
  step(3);
  expect(s.ecs.personable[person].hunger).toBeLessThan(.95);
  expect(s.ecs.container[store].amounts.gruel).toBeLessThan(3);
  expect(s.ecs.container[store].amounts.wood).toBe(1);
  expect(s.ecs.good[wood]).toBeUndefined();
  expect(s.ecs.possession[item]).toEqual(before);
  expect(s.ecs.good[item]).toMatchObject({ type: "heirloom", amount: 1, value: 12 });
  expect(s.ecs.haulable[item].heldBy).toBeUndefined();
  expect(s.ecs.controllable[item].controllerId).toBe(person);
  expect(Object.values(s.ecs.holder).some(h => h.held.includes(item))).toBe(false);
});

it("keeps unique gifts separate and preserves identity, maker, inscription and owner chain on real delivery", () => {
  const { state: s, player, person } = peopleWorld();
  const a = createPossession(s, player, "Alice's brooch", "heirloom");
  const b = createPossession(s, player, "Edith's brooch", "heirloom");
  s.ecs.possession[a].inscription = "For Alice";
  expect(giftChoices(s, player).map(c => c.gift.sourceId)).toEqual(expect.arrayContaining([a, b]));
  expect(giftChoices(s, player).filter(c => c.gift.type == "heirloom")).toHaveLength(2);
  const w = s.ecs.planner[player].world;
  s.ecs.spatial[player] = { ...s.ecs.spatial[person] };
  s.ecs.manager[player].jobs.push({ assignedId: player, gift: { sourceId: a, type: "heirloom" } });
  expect(collect_gift(s, player, w, 0, true, a, "heirloom")).toBe(Task.FINISH);
  talk(s, player, w, 0, true, person, "give_gift");
  expect(talk(s, player, w, 1, false, person, "give_gift")).toBe(Task.FINISH);
  expect(s.ecs.possession[a]).toMatchObject({ name: "Alice's brooch", ownerId: person, maker: player, inscription: "For Alice" });
  expect(s.ecs.possession[a].owners.map(o => o.personId)).toEqual([player, person]);
  expect(s.ecs.possession[b].ownerId).toBe(player);
});

it("keeps a personal gift safe when both working hands are full", () => {
  const { state: s, player } = peopleWorld();
  const item = createPossession(s, player, "Carved box", "heirloom");
  s.ecs.holder[player].held = ["left", "right"]; s.ecs.holder[player].capacity = 2;
  s.ecs.manager[player].jobs.push({ assignedId: player });
  expect(collect_gift(s, player, s.ecs.planner[player].world, 0, true, item, "heirloom")).toBe(Task.ABORT);
  expect(s.ecs.possession[item].carried).toBe(true);
});

it("records the real handover positions independently of later walking", () => {
  const { state: s, player, person } = peopleWorld();
  const item = createPossession(s, player, "Silver ring", "heirloom");
  s.ecs.spatial[player] = { ...s.ecs.spatial[person] };
  s.ecs.manager[player].jobs.push({ assignedId: player });
  const w = s.ecs.planner[player].world;
  collect_gift(s, player, w, 0, true, item, "heirloom");
  talk(s, player, w, 0, true, person, "give_gift");
  talk(s, player, w, 1, false, person, "give_gift");
  const e = s.events.find(e => e.type == "gift");
  expect(e.positions[player]).toEqual(e.positions[person]);
  const point = { ...e.positions[player] };
  s.ecs.spatial[player].x += 500;
  expect(e.positions[player]).toEqual(point);
});

it("keeps the delivered food identity and owner in the receipt after consumption", () => {
  const { state: s, player, person } = peopleWorld();
  const item = createPossession(s, player, "Bread", "heirloom");
  delete s.ecs.possession[item]; s.ecs.good[item].type = "grain";
  s.ecs.spatial[item] = { ...s.ecs.spatial[person] };
  s.ecs.spatial[player] = { ...s.ecs.spatial[person] };
  const w = s.ecs.planner[player].world;
  s.ecs.manager[player].jobs.push({ assignedId: player });
  collect_gift(s, player, w, 0, true, item, "grain");
  talk(s, player, w, 0, true, person, "give_gift");
  talk(s, player, w, 1, false, person, "give_gift");
  expect(s.ecs.controllable[item].controllerId).toBe(person);
  delete s.ecs.good[item]; delete s.ecs.controllable[item];
  expect(s.events.find(e => e.type == "gift").gifts).toContainEqual({ id: item, type: "grain", ownerId: person });
});

it('preserves a physically collected unique gift through reordered gathering and resumes the same-item delivery', () => {
  const { state: s, player, person, tiles, step } = peopleWorld();
  const { enqueueTask, reorderTask } = require('game/manager');
  const item = createPossession(s, player, 'Engraved family brooch', 'heirloom');
  s.ecs.possession[item].inscription = 'Keep this in the family';
  const [camp, plant] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[tiles[0]] }, camp: {}, container: { capacity: 20, amounts: {} }, controllable: { controllerId: player } },
    { spatial: { ...s.ecs.spatial[tiles[0]] }, forageable: { kind: 'berries', biome: 'grassland', amount: 2, growth: 0 } }
  ]);
  const choice = giftChoices(s, player).find(c => c.gift.sourceId == item).gift;
  const gift = enqueueTask(s, { key: 'give_gift' }, person, { gift: choice });
  for (let i=0;i<100 && !gift.giftItem;i++) step(.01);
  expect(gift.giftItem).toBe(item);
  expect(s.ecs.haulable[item].heldBy).toBe(player);
  const collected = JSON.parse(JSON.stringify(s.ecs.possession[item]));
  const good = { ...s.ecs.good[item] };
  const gather = enqueueTask(s, { key: 'forage' }, plant); reorderTask(s, gather.id, 0);
  for (let i=0;i<400 && s.ecs.manager[player].jobs.includes(gather);i++) step(.01);
  expect(gather.progress).toBe(1);
  expect(s.ecs.possession[item]).toEqual(collected);
  expect(s.ecs.good[item]).toEqual(good);
  expect(s.ecs.haulable[item].heldBy).toBe(player);
  expect(s.ecs.container[camp].amounts).toEqual({ forage: 1 });
  step(4);
  expect(gift.progress).toBe(1);
  expect(s.ecs.good[item]).toEqual(good);
  expect(s.ecs.haulable[item]).toBeDefined();
  expect(s.ecs.possession[item]).toMatchObject({ ownerId: person, maker: player, originalOwner: player, inscription: 'Keep this in the family' });
  expect(s.ecs.possession[item].owners.slice(0,-1)).toEqual(collected.owners);
  expect(s.ecs.possession[item].owners.at(-1)).toMatchObject({ personId: person, reason: 'gift' });
});
