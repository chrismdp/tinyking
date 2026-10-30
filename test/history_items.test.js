import { generateMap } from "game/map";
import * as history from "game/history";
import * as possessions from "game/possessions";
import { giftOptions } from "game/people";
import { giftChoices } from "game/gift_choices";
import { collect_gift, talk } from "game/tasks";
import { Task } from "game/htn";

const maps = {};
const generate = async seed => {
  if (!maps[seed]) {
    const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
    const result = await generateMap(s, seed, async () => {});
    s.map = result.map; s.ui.playerId = result.playerId;
    maps[seed] = s;
  }
  return maps[seed];
};

it.each([13, 20, 1234, 98765])("materialises every living owner's historical heirloom as one complete gift on seed %s", async seed => {
  const s = await generate(seed);
  const heirs = Object.values(s.ecs.possession).filter(p => p.kind == "heirloom" && p.ownerId && !s.ecs.personable[p.ownerId].dead);
  expect(heirs.length).toBeGreaterThan(0);
  const before = JSON.stringify(s);
  for (const p of heirs) {
    expect(s.ecs.good[p.id]).toEqual({ id: p.id, type: "heirloom", amount: 1, value: 12 });
    expect(s.ecs.haulable[p.id]).toEqual({ id: p.id });
    expect(s.ecs.controllable[p.id]).toEqual({ id: p.id, controllerId: p.ownerId });
    expect(p.carried).toBe(true);
    expect(p.maker).toBe(p.originalOwner);
    expect(p.owners[0]).toEqual({ personId: p.originalOwner, day: -540, reason: "made" });
    expect(p.owners.at(-1).personId).toBe(p.ownerId);
    expect(giftOptions(s, p.ownerId).filter(g => g.sourceId == p.id)).toHaveLength(1);
    expect(giftChoices(s, p.ownerId).filter(c => c.gift.sourceId == p.id)).toHaveLength(1);
    expect(giftOptions(s, s.ui.playerId).some(g => g.sourceId == p.id)).toBe(false);
    expect(Object.values(s.ecs.holder).some(h => h.held.includes(p.id))).toBe(false);
    expect(Object.values(s.space).some(ids => ids.includes(p.id))).toBe(false);
  }
  expect(JSON.stringify(s)).toBe(before);
});

it("retains generated components and map goods across the detached history boundary", async () => {
  const originalHistory = history.generateHistory, originalCreate = possessions.createPossession;
  const created = {};
  const createSpy = jest.spyOn(possessions, "createPossession").mockImplementation((s, ...args) => {
    const id = originalCreate(s, ...args);
    if (s.generatingHistory) {
      created[id] = structuredClone(Object.fromEntries(["good", "haulable", "spatial", "nameable"].map(key => [key, s.ecs[key][id]])));
      // Summary item records contain no terrain or commodity goods.
      expect(Object.keys(s.ecs.good).every(item => s.ecs.possession[item])).toBe(true);
    }
    return id;
  });
  const historySpy = jest.spyOn(history, "generateHistory").mockImplementation((s, seed) => {
    const before = structuredClone({ good: s.ecs.good, haulable: s.ecs.haulable, container: s.ecs.container });
    originalHistory(s, seed);
    for (const key of ["good", "haulable", "container"]) for (const [id, value] of Object.entries(before[key] || {})) expect(s.ecs[key][id]).toEqual(value);
    for (const [id, components] of Object.entries(created)) for (const [key, value] of Object.entries(components)) expect(s.ecs[key][id]).toEqual(value);
  });
  try {
    const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
    await generateMap(s, 13, async () => {});
    expect(Object.keys(created)).toHaveLength(Object.keys(s.villages).length);
  } finally { historySpy.mockRestore(); createSpy.mockRestore(); }
});

it("hands over a genuinely inherited object without duplicating or merging same-type heirlooms", async () => {
  const s = structuredClone(await generate(13)), player = s.ui.playerId;
  const heirs = Object.values(s.ecs.possession).filter(p => p.kind == "heirloom" && p.ownerId && !s.ecs.personable[p.ownerId].dead && p.owners.some(o => o.reason == "inheritance"));
  const a = heirs[0], b = heirs.find(p => p.id != a.id && p.name == a.name), recipient = a.ownerId;
  expect(b).toBeDefined();
  const original = structuredClone(a), good = structuredClone(s.ecs.good[a.id]);
  const ids = Object.keys(s.ecs.possession), nextId = s.ecs.nextId;
  // Ownership-only acquisition fixture: player succession is not implemented.
  possessions.transferPossession(s, a.id, player, "gift");
  possessions.transferPossession(s, b.id, player, "gift");
  const choices = giftChoices(s, player).filter(c => [a.id, b.id].includes(c.gift.sourceId));
  expect(choices).toHaveLength(2);
  expect(choices.every(c => c.amount == 1)).toBe(true);
  s.ecs.spatial[player] = { ...s.ecs.spatial[recipient], id: player };
  s.ecs.manager[player].jobs.push({ assignedId: player });
  const world = s.ecs.planner[player].world;
  expect(collect_gift(s, player, world, 0, true, a.id, "heirloom")).toBe(Task.FINISH);
  talk(s, player, world, 0, true, recipient, "give_gift");
  expect(talk(s, player, world, 1, false, recipient, "give_gift")).toBe(Task.FINISH);
  expect(s.ecs.possession[a.id]).toEqual({ ...original, ownerId: recipient, owners: [...original.owners,
    { personId: player, day: s.days, reason: "gift" }, { personId: recipient, day: s.days, reason: "gift" }] });
  expect(s.ecs.good[a.id]).toEqual(good);
  expect(s.ecs.possession[b.id].ownerId).toBe(player);
  expect(s.ecs.controllable[a.id].controllerId).toBe(recipient);
  expect(s.ecs.haulable[a.id].heldBy).toBeNull();
  expect(Object.keys(s.ecs.possession)).toEqual(ids);
  expect(s.ecs.nextId).toBe(nextId);
  expect(s.events.at(-1)).toMatchObject({ type: "gift", items: [a.id] });
});
