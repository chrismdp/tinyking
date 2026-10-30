import { newEntities } from "game/entities";
import { generateMap, generateFamilies, Hex, TRIANGLES } from "game/map";
import { disposition, RING_CAPS } from "game/people";
import { historyStep } from "game/social";
const generate = async seed => {
  const s = { ecs: { nextId: 1 }, days: 0.375, redraws: [], ui: { show: {} } };
  await generateMap(s, seed, async () => {});
  return s;
};

it("generates forty-five years of dated history, dead ancestors and inherited objects deterministically", async () => {
  const s = await generate(13), again = await generate(13);
  expect(s.events).toEqual(again.events);
  expect(s.ecs.kinship).toEqual(again.ecs.kinship);
  expect(s.events.some(e => e.type == "birth")).toBe(true);
  expect(s.events.some(e => e.type == "marriage")).toBe(true);
  expect(s.events.some(e => e.type == "marriage" && new Set(e.fromVillages).size > 1)).toBe(true);
  const player = Object.keys(s.ecs.playable)[0];
  expect(s.knowledge?.[player]?.events || []).toEqual([]);
  expect(s.events.some(e => e.type == "death")).toBe(true);
  expect(s.events.some(e => e.type == "inheritance")).toBe(true);
  expect(Math.min(...s.events.map(e => e.season))).toBeLessThanOrEqual(-176);
  expect(Object.values(s.ecs.possession).some(p => p.owners.length > 1)).toBe(true);
  const living = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead);
  expect(living.some(id => s.ecs.kinship[id].parents.some(p => s.ecs.personable[p].dead))).toBe(true);
  for (const id in s.ecs.kinship) {
    const k = s.ecs.kinship[id];
    for (const p of k.parents) expect(s.ecs.kinship[p].children).toContain(id);
    for (const c of k.children) expect(s.ecs.kinship[c].parents).toContain(id);
    if (k.spouse) expect(s.ecs.kinship[k.spouse].spouse).toBe(id);
    for (const [ring, cap] of Object.entries(RING_CAPS)) expect(Object.values(s.ecs.relationships[id].known).filter(b => b.ring == ring).length).toBeLessThanOrEqual(cap);
  }
  const counts = { hate: 0, like: 0, love: 0 };
  for (const a of living) for (const b of living) if (a != b) counts[disposition(s, a, b)]++;
  const n = living.length * (living.length - 1);
  expect(counts.hate / n).toBeCloseTo(0.2, 2);
  expect(counts.love / n).toBeCloseTo(0.2, 2);
  for (const v of Object.values(s.villages)) { expect(v.houses.length).toBeGreaterThanOrEqual(3); expect(v.houses.length).toBeLessThanOrEqual(8); }
  for (const v of Object.values(s.villages)) for (const house of v.houses) {
    const residents = living.filter(id => s.ecs.household[id]?.houseId == house).length;
    const store = s.ecs.building[house].rooms.find(id => s.ecs.container[id]);
    expect(s.ecs.container[store].amounts.gruel).toBe(Math.max(1, residents));
    expect(s.ecs.container[store].amounts.grain).toBe(Math.max(1, residents) * TRIANGLES.length);
  }
});

it.each([20, 1234, 98765])("keeps seed %s's population roughly stable over five seasonal years", async seed => {
  const generated = await generate(seed);
  const components = ["personable", "personality", "kinship", "relationships", "household", "village", "building", "controllable", "possession", "nameable", "spatial", "profession"];
  let s = { peopleSeed: generated.peopleSeed, opinionThresholds: generated.opinionThresholds, villages: generated.villages, knowledge: generated.knowledge, events: generated.events, ecs: { nextId: generated.ecs.nextId } };
  for (const key of components) s.ecs[key] = generated.ecs[key] || {};
  const count = s => Object.values(s.ecs.personable).filter(p => !p.dead).length;
  const before = count(s);
  for (let season = 0; season < 20; season++) s = historyStep(s, season);
  expect(count(s) / before).toBeGreaterThanOrEqual(0.75);
  expect(count(s) / before).toBeLessThanOrEqual(1.3);
});

it("keeps goodwill earned during history when calibrating the arriving population", async () => {
  const s = await generate(20);
  expect(Object.values(s.ecs.relationships).some(r => Object.values(r.known).some(b => b.goodwill != b.base))).toBe(true);
});

it("starts history with adult founding households so the seasonal step produces the children", () => {
  const s = { ecs: { nextId: 1 }, days: .375, villages: { v: { id: "v", houses: [] } } };
  for (let n = 0; n < 3; n++) {
    const [id] = newEntities(s, [{ spatial: { ...Hex(5 + n * 2, 5).toPoint(), immovable: true }, building: { entrance: 0 }, controllable: {}, village: { villageId: "v" } }]);
    s.villages.v.houses.push(id);
  }
  generateFamilies({ state: s, seed: 20, playerStartTile: Hex(1, 1), founding: true });
  expect(Object.values(s.ecs.personable).every(p => p.age >= 18)).toBe(true);
});
