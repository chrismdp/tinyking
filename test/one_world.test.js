/* global it, expect, require, jest */
import { rollHexContents, advanceHistorySeasons, summarySeason, compactMap } from "game/world_history";
import { community, attach } from "./support/travel";
import { ensureMap, departNpc, initialiseTravel } from "game/travel";
import { serialiseGame, restoreGame } from "game/save_game";
import { newEntities } from "game/entities";

// Two households, six initial adults, three shared seasons. Physical detail
// tests use this completed history rather than generating another prehistory.
const declaredCommunity = (key, options = {}) => {
  const f = community(options), hex = Object.fromEntries(key.split(",").map((n, i) => [i ? "y" : "x", +n]));
  f.s.world.home = hex;
  f.s.world.hexes = [{ x: 5, y: 3 }, { x: 6, y: 3 }].map(h => ({ ...f.s.world.hexes[0], ...h }));
  f.s.map.worldKey = key;
  delete f.s.travel;
  initialiseTravel(f.s, 13);
  return f;
};
const history = async () => {
  const { s, ids, house } = declaredCommunity("5,3");
  const away = declaredCommunity("6,3", { namespace: "away-", player: false });
  attach(s, away.s);
  s.world.hexes = s.world.hexes.filter(h => ["5,3", "6,3"].includes(h.x + "," + h.y));
  s.travel.wholeWorld = true;
  s.world.landSeed = "13:0";
  s.worldHistory = { version: 1, contents: {} };
  for (const [key, map] of Object.entries(s.travel.maps)) {
    const v = Object.values(map.villages)[0];
    s.worldHistory.contents[key] = { kind: "villages", roads: false, discoveries: ["ruins"], settlements: [{ id: v.id, name: v.name, houseCount: 1 }] };
    const home = Object.keys(map.ecs.building)[0];
    const [store] = newEntities(map, [{ container: { capacity: 100, amounts: { grain: 36, wood: 16 } }, controllable: { controllerId: home } }]);
    Object.assign(map.ecs.household[home], { storeId: store, summaryFields: 1 });
    s.travel.maps[key] = compactMap(map);
  }
  Object.assign(s, s.travel.maps[s.travel.active]);
  // An actual road visitor must land once in the shared history batch.
  departNpc(s.travel.maps["5,3"], ids[2], { to: "6,3", side: 0 }, s.travel);
  const updates = [];
  await advanceHistorySeasons(s, 1, 3, async (label, value) => updates.push({ label, value }));
  s.days = .375;
  s.travel.days = s.days;
  return { s, ids, house, updates };
};

it("rolls biome contents deterministically, including wilderness, villages, towns and optional roads", () => {
  const kinds = new Set(), roads = new Set();
  for (let seed = 0; seed < 80; seed++) for (const biome of ["grassland", "desert", "taiga"]) {
    const h = { x: 2, y: 3, biome }, c = rollHexContents(seed, h);
    expect(c).toEqual(rollHexContents(seed, h));
    expect(c.discoveries).toHaveLength(1);
    kinds.add(c.kind); roads.add(c.roads);
    if (c.kind === "town") expect(c.settlements).toHaveLength(1);
    if (c.kind === "villages") expect(c.settlements.length).toBeGreaterThan(1);
  }
  expect([...kinds].sort()).toEqual(["empty", "town", "villages"]);
  expect(roads.size).toBe(2);
  expect(rollHexContents(13, { x: 1, y: 2, biome: "desert" }, true).settlements.length).toBeGreaterThan(0);
});

it("advances shared compact histories together and lands a cross-place person once", async () => {
  const { s, ids, updates } = await history();
  expect(Object.keys(s.travel.maps).sort()).toEqual(["5,3", "6,3"]);
  expect(updates).toHaveLength(3);
  expect((await history()).s.travel.maps).toEqual(s.travel.maps);
  expect(s.travel.season).toBe(3);
  expect(s.travel.transit.every(trip => trip.due > s.days)).toBe(true);
  expect(Object.values(s.travel.maps).every(m => m.compact && !m.ecs.mappable && !m.ecs.walkable && !m.ecs.planner && !m.map.geography)).toBe(true);
  expect(Object.values(s.travel.events).some(e => e.type === "world_visit" || e.type === "world_move")).toBe(true);
  expect(s.travel.maps["6,3"].residents[ids[2]]).toBe(true);
  for (const id of Object.keys(s.travel.people)) expect(Object.values(s.travel.maps).filter(m => m.residents[id]).length + s.travel.transit.filter(t => t.bundle.id === id).length).toBeLessThanOrEqual(1);
  const map = s.travel.maps["5,3"], before = serialiseGame(map);
  summarySeason(map, 4);
  expect(map.social.lastSeason).toBe(4);
  expect(serialiseGame(map)).not.toBe(before);
  const once = serialiseGame(map);
  summarySeason(map, 4);
  expect(serialiseGame(map)).toBe(once);
});

it("builds an arrival from stored history without replaying history and installs runnable residents", async () => {
  const { s } = await history();
  // The saved player's local detail is built separately; arrival has no player.
  const key = "6,3", summary = s.travel.maps[key], ids = Object.keys(summary.residents), events = summary.events.map(e => e.id);
  const replay = jest.spyOn(require("game/history"), "generateHistory");
  try {
    const map = await ensureMap(s, key);
    expect(replay).not.toHaveBeenCalled();
    expect(map.compact).toBeFalsy();
    expect(Object.keys(map.ecs.mappable).length).toBeGreaterThan(0);
    expect(ids.every(id => map.ecs.personable[id])).toBe(true);
    expect(map.events.map(e => e.id)).toEqual(expect.arrayContaining(events));
    expect(map.historyGenerationMs).toBeUndefined();
    for (const id of Object.keys(map.ecs.planner)) if (map.residents[id] && !map.ecs.personable[id].dead) {
      expect(() => require("game/manager").jobQueueFor(map.ecs, id)).not.toThrow();
      expect(Number.isFinite(map.ecs.spatial[id].x) && Number.isFinite(map.ecs.spatial[id].y)).toBe(true);
    }
    expect(restoreGame(serialiseGame(s)).travel.season).toBe(3);
  } finally { replay.mockRestore(); }
});

it("does not reveal an unvisited compact community as a visited world hex", () => {
  const { s } = declaredCommunity("5,3"), away = attach(s, declaredCommunity("6,3", { namespace: "away-", player: false }).s);
  s.travel.maps["6,3"] = compactMap(away);
  expect(require("game/realm_map").reachFacts(s, s.world.hexes.find(h => h.x === 6 && h.y === 3)).visited).toBe(false);
});

it("prepares the interior table for travellers in a hex with no households", () => {
  const { installStoredHistory } = require("game/world_history"), { SUMMARY_COMPONENTS } = require("game/community_summary");
  const s = { ecs: { nextId: 1, spatial: {}, mappable: {} }, space: {}, redraws: [], map: { playerStartTile: { x: 22, y: 2 }, entrances: {} } };
  const summary = { ecs: Object.fromEntries(SUMMARY_COMPONENTS.map(k => [k, {}])), residents: {}, events: [], knowledge: {}, social: { lastSeason: 0 }, villages: {} };
  installStoredHistory(s, summary, {}, { discoveries: ["ruins"] }, true);
  expect(s.ecs.interior).toEqual({});
});

it("advances a founded household harvest through the light season", () => {
  const { s, house } = community();
  delete s.ecs.building[house]; s.ecs.shelter = { [house]: { id: house, stage: "house" } };
  const [store] = newEntities(s, [{ container: { amounts: { grain: 10 } }, controllable: { controllerId: house } }]);
  s.ecs.household[house].storeId = store; s.ecs.household[house].summaryFields = 1;
  summarySeason(s, 2);
  expect(s.ecs.container[store].amounts.grain).toBeGreaterThan(10);
  expect(s.events.some(e => e.type === "harvest" && e.items.includes(house))).toBe(true);
});

it("builds identical physical detail now or after a later approach from the same historical inputs", async () => {
  const { captureDetailOrigins, prepareDetail } = require("game/hex_detail");
  const { s } = await history();
  captureDetailOrigins(s);
  const before = restoreGame(serialiseGame(s)), key = "6,3";
  const early = await prepareDetail(s, key);
  before.days += 21;
  before.world = { ...before.world, home: { x: 6, y: 3 } };
  const later = await prepareDetail(before, key);
  expect(later).toEqual(early);
  expect(early.ecs.mappable).toBeDefined();
  expect(early.map.geography).toBeDefined();
  expect(Object.keys(early.ecs.building)).toHaveLength(1);
});
