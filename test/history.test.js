/* global it, expect */
import { newEntities } from "game/entities";
import { generateFamilies, Hex } from "game/map";
import { disposition, RING_CAPS, addGoodwill, recalibrateRelationships } from "game/people";
import { consumeStored, depositProduced } from "game/settlement_growth";
import { flatVillage } from "./support/village";
import { generateHistory } from "game/history";
import { foundingVillage } from "./support/founding";
import { freezeOpinions } from "game/travel";

// Two declared hamlets are enough for cross-village marriage, descendants,
// death and inheritance. Only the history component runs its 180 seasons.
const socialHistory = seed => {
  const s = foundingVillage(seed, { twoVillages: true, firstSeason: -180 });
  generateHistory(s, seed);
  return s;
};

it("generates forty-five years of dated history, dead ancestors and inherited objects deterministically", async () => {
  const s = await socialHistory(13), again = await socialHistory(13);
  expect(s).toEqual(again);
  expect(s.events).toEqual(again.events);
  expect(s.ecs.kinship).toEqual(again.ecs.kinship);
  expect(s.events.some(e => e.type == "birth")).toBe(true);
  const descendants = Object.keys(s.ecs.personable).filter(id => s.ecs.personable[id].born < 0);
  expect(descendants.length).toBeGreaterThan(0);
  descendants.forEach(id => expect(s.ecs.personality[id].opinionThresholds).toBeUndefined());
  freezeOpinions(s);
  descendants.forEach(id => expect(s.ecs.personality[id].opinionThresholds).toEqual(s.opinionThresholds));
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
    const store = s.ecs.building[house].rooms.find(id => s.ecs.container[id]);
    const stock=s.ecs.container[store],account=s.ecs.household[house].estateAccount;
    // These are the completed historical crop states, rather than only the
    // freshly sown inputs covered by village layout generation.
    for (const field of s.ecs.household[house].fields) for (const slot of s.ecs.farmable[field].slots) {
      expect(["sown", "harvestable", "harvested", "empty"]).toContain(slot.state);
      if (["sown", "harvestable"].includes(slot.state)) expect(slot.content).toBe("grain");
      else expect(slot.content).toBeNull();
      expect(slot.growth).toBeGreaterThanOrEqual(0);
    }
    expect(account).toBeDefined();
    expect(Object.values(stock.amounts).reduce((n,v)=>n+v,0)).toBeLessThanOrEqual(stock.capacity);
    for(const type of new Set([...Object.keys(account.initial),...Object.keys(account.produced),...Object.keys(account.consumed)])) {
      expect(stock.amounts[type] || 0).toBeGreaterThanOrEqual(0);
      expect(stock.amounts[type] || 0).toBeCloseTo((account.initial[type] || 0)+(account.produced[type] || 0)-(account.consumed[type] || 0),8);
    }
  }
});

it("keeps reciprocal kinship, bounded rings and calibrated dispositions in generated families", () => {
  const { s } = flatVillage(8, { seed: 13, founding: false });
  for (const id in s.ecs.kinship) {
    const k = s.ecs.kinship[id];
    for (const p of k.parents) expect(s.ecs.kinship[p].children).toContain(id);
    for (const c of k.children) expect(s.ecs.kinship[c].parents).toContain(id);
    if (k.spouse) expect(s.ecs.kinship[k.spouse].spouse).toBe(id);
    for (const [ring, cap] of Object.entries(RING_CAPS)) expect(Object.values(s.ecs.relationships[id].known).filter(b => b.ring == ring).length).toBeLessThanOrEqual(cap);
  }
  const living = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead);
  const counts = { hate: 0, like: 0, love: 0 };
  for (const a of living) for (const b of living) if (a != b) counts[disposition(s, a, b)]++;
  const n = living.length * (living.length - 1);
  expect(counts.hate / n).toBeCloseTo(0.2, 2);
  expect(counts.love / n).toBeCloseTo(0.2, 2);
});

it("keeps goodwill earned during history when calibrating the arriving population", () => {
  const { s, village } = flatVillage(3, { seed: 20 });
  const [a, b] = Object.keys(s.ecs.personable).filter(id => s.ecs.household[id]?.houseId == village.houses[1]);
  addGoodwill(s, a, b, 5);
  const earned = s.ecs.relationships[a].known[b].goodwill;
  recalibrateRelationships(s);
  expect(s.ecs.relationships[a].known[b].goodwill).toBe(earned);
  expect(Object.values(s.ecs.relationships).some(r => Object.values(r.known).some(b => b.goodwill != b.base))).toBe(true);
});

it("balances actual household consumption and production without exceeding the store", () => {
  const { s, village } = flatVillage(3);
  const house = village.houses[1], store = s.ecs.building[house].rooms.find(id => s.ecs.container[id]);
  const stock = s.ecs.container[store];
  const account = { initial: { ...stock.amounts }, produced: {}, consumed: {} };
  s.ecs.household[house] = { id: house, storeId: store, estateAccount: account };
  expect(consumeStored(s, house, "grain", 2)).toBe(true);
  expect(depositProduced(s, house, "grain", 1)).toBe(true);
  expect(account).toBeDefined();
  expect(Object.values(stock.amounts).reduce((n,v)=>n+v,0)).toBeLessThanOrEqual(stock.capacity);
  for(const type of new Set([...Object.keys(account.initial),...Object.keys(account.produced),...Object.keys(account.consumed)])) {
    expect(stock.amounts[type] || 0).toBeGreaterThanOrEqual(0);
    expect(stock.amounts[type] || 0).toBeCloseTo((account.initial[type] || 0)+(account.produced[type] || 0)-(account.consumed[type] || 0),8);
  }
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
