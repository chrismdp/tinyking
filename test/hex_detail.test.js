import { captureDetailOrigins, prepareDetail, prepareNeighbourDetails, scheduleNeighbourDetails } from "game/hex_detail";
import { compactMap, buildHistoryMap } from "game/world_history";
import { ensureMap } from "game/travel";
import { encodeWorldSave, decodeWorldSave } from "game/hex_storage";
import { gameData, decompressGame } from "game/save_game";
import { newEntities } from "game/entities";
import { community, attach } from "./support/travel";
import { createAutosave } from "game/autosave";

const makeFixture = () => {
  const { s } = community();
  const away = community({ namespace: "away-", key: "6,5", player: false }).s;
  const house = Object.keys(away.ecs.building)[0];
  const [store] = newEntities(away, [{ container: { capacity: 100, amounts: { grain: 10, wood: 16 } }, controllable: { controllerId: house } }], "store-");
  away.ecs.household[house].storeId = store;
  attach(s, away);
  s.travel.wholeWorld = true;
  s.worldHistory = { version: 1, contents: {} };
  for (const [key, map] of Object.entries(s.travel.maps)) s.travel.maps[key] = compactMap(map);
  captureDetailOrigins(s);
  return { s, away };
};
let storedFixture;
beforeAll(() => { storedFixture = makeFixture(); });
const fixture = () => structuredClone(storedFixture);
afterEach(() => jest.restoreAllMocks());

it("starts neighbours after the arrival checkpoint commits and a further frame", async () => {
  const { s, away } = fixture(), frames = [], disk = new Map();
  let acknowledge, saved;
  const build = jest.spyOn(require("game/world_history"), "buildHistoryMap").mockResolvedValue(structuredClone(away.travel.maps["6,5"]));
  s.persistence = createAutosave(s, async (operation, payload) => {
    const copy = structuredClone(payload);
    const packet = await encodeWorldSave(copy.state, copy.hexes);
    await new Promise(resolve => { acknowledge = resolve; });
    for (const [key, record] of Object.entries(packet.records)) disk.set(key, record);
    saved = structuredClone(packet.world);
    return { hexRecords: packet.hexRecords };
  }, () => {}, fn => frames.push(fn));
  const committed = s.persistence.deferCheckpoint({});
  scheduleNeighbourDetails(s, fn => frames.push(fn));
  frames.shift()(); // Submit the arrival checkpoint.
  frames.shift()(); // Neighbours have a frame, but no durable acknowledgement.
  expect(build).not.toHaveBeenCalled();
  while (!acknowledge) await new Promise(resolve => setImmediate(resolve));
  acknowledge(); await committed;
  await Promise.resolve();
  expect(build).not.toHaveBeenCalled();
  const loaded = await decodeWorldSave(saved, key => disk.get(key));
  expect(loaded.travel.active).toBe(s.travel.active);
  expect(loaded.travel.detailQueue).toEqual(["6,5"]);
  frames.shift()();
  expect(build).toHaveBeenCalledTimes(1);
});

it("deduplicates an unfinished build and owns its historical construction inputs", async () => {
  const { s, away } = fixture();
  let finish;
  const build = jest.spyOn(require("game/world_history"), "buildHistoryMap").mockImplementation(async (context, hex, origin) => {
    expect(context.days).toBe(.375);
    expect(hex.x + "," + hex.y).toBe("6,5");
    expect(origin.ecs.mappable).toBeUndefined();
    expect(origin.events).toEqual([]);
    await new Promise(resolve => { finish = resolve; });
    expect(origin.ecs.personable[Object.keys(origin.residents)[0]].age).not.toBe(99);
    return structuredClone(away.travel.maps["6,5"]);
  });
  const first = prepareDetail(s, "6,5");
  expect(prepareDetail(s, "6,5")).toBe(first);
  const person = Object.keys(s.travel.maps["6,5"].residents)[0];
  s.travel.maps["6,5"].ecs.personable[person].age = 99;
  finish(); await first;
  expect(build).toHaveBeenCalledTimes(1);
  expect(s.travel.preparedMaps["6,5"].unopenedDetail).toBe(true);
  expect(s.travel.maps["6,5"].compact).toBe(true);
});

it("persists the intent before the arrival frame and resumes a save made during an unfinished neighbour", async () => {
  const { s, away } = fixture(), frames = [], disk = new Map();
  let finish;
  const build = jest.spyOn(require("game/world_history"), "buildHistoryMap").mockImplementation(async () => {
    await new Promise(resolve => { finish = resolve; });
    return structuredClone(away.travel.maps["6,5"]);
  });
  scheduleNeighbourDetails(s, fn => frames.push(fn));
  expect(build).not.toHaveBeenCalled();
  expect(s.travel.detailQueue).toEqual(["6,5"]);
  frames.shift()();
  expect(build).toHaveBeenCalledTimes(1);
  const packet = await encodeWorldSave(structuredClone(gameData(s)));
  for (const [key, record] of Object.entries(packet.records)) disk.set(key, record);
  const loaded = await decodeWorldSave(structuredClone(packet.world), key => disk.get(key));
  expect(loaded.travel.detailQueue).toEqual(["6,5"]);
  expect(loaded.travel.preparedMaps).toBeUndefined();
  expect(loaded.travel.hexRecords["6,5"]).toBeUndefined();
  finish(); await Promise.resolve(); await Promise.resolve();
  build.mockImplementation(async () => structuredClone(away.travel.maps["6,5"]));
  await prepareNeighbourDetails(loaded);
  expect(loaded.travel.detailQueue).toEqual([]);
  expect(loaded.travel.preparedMaps["6,5"].ecs.mappable).toBeDefined();
});

it("stores completed unopened detail separately, then applies current residents and ownership when opening it", async () => {
  const { s, away } = fixture(), disk = new Map();
  const built = structuredClone(away.travel.maps["6,5"]);
  const house = Object.keys(built.ecs.building)[0], store = built.ecs.household[house].storeId;
  built.ecs.container[store].amounts.wood = 12;
  jest.spyOn(require("game/world_history"), "buildHistoryMap").mockResolvedValue(built);
  await prepareNeighbourDetails(s);
  const packet = await encodeWorldSave(structuredClone(gameData(s)));
  for (const [key, record] of Object.entries(packet.records)) disk.set(key, record);
  const loaded = await decodeWorldSave(structuredClone(packet.world), key => disk.get(key));
  expect(loaded.travel.preparedMaps).toBeUndefined();
  expect(Object.keys(loaded.travel.hexRecords)).toHaveLength(2);
  const reach = loaded.world.hexes.find(h => h.x === 6 && h.y === 5);
  expect(require("game/realm_map").reachFacts(loaded, reach).visited).toBe(false);
  const summary = loaded.travel.maps["6,5"], person = Object.keys(summary.residents)[0];
  summary.ecs.nameable[person] = { ...summary.ecs.nameable[person], nickname: "Changed while away" };
  summary.ecs.personable[person].age = 42;
  const owner = Object.keys(summary.residents)[2];
  summary.ecs.controllable[house].controllerId = owner;
  summary.ecs.container[store].amounts.wood = 9;
  loaded.persistence = { readHex: async key => decompressGame(disk.get(key).bytes) };
  const detailed = await ensureMap(loaded, "6,5");
  expect(detailed.ecs.nameable[person].nickname).toBe("Changed while away");
  expect(detailed.ecs.personable[person].age).toBe(42);
  expect(detailed.ecs.controllable[house].controllerId).toBe(owner);
  expect(detailed.ecs.container[store].amounts.wood).toBe(5);
  expect((await ensureMap(loaded, "6,5")).ecs.container[store].amounts.wood).toBe(5);
  expect(detailed.ecs.mappable).toEqual(away.ecs.mappable);
  expect(detailed.unopenedDetail).toBeUndefined();
  expect(buildHistoryMap).toHaveBeenCalledTimes(1);
  await require("game/travel").completeTravel(loaded, { destination: "6,5", side: 0 });
  expect(require("game/realm_map").reachFacts(loaded, reach).visited).toBe(true);
  expect(loaded.travel.unopenedHexes["6,5"]).toBeUndefined();
});

it("captures shared remote identities once while keeping construction inputs detached from live state", () => {
  const { s } = fixture(), keys = Object.keys(s.travel.maps);
  const home = s.travel.maps[keys[0]], away = s.travel.maps[keys[1]];
  const id = Object.keys(home.residents)[0];
  // Ordinary remote references point at the same published component heads.
  for (const component of ["personable", "personality", "relationships"]) away.ecs[component][id] = home.ecs[component][id];
  captureDetailOrigins(s);
  const first = s.worldHistory.detailOrigins[keys[0]], second = s.worldHistory.detailOrigins[keys[1]];
  for (const component of ["personable", "personality", "relationships"]) {
    expect(first.ecs[component][id]).toBe(second.ecs[component][id]);
    expect(first.ecs[component][id]).not.toBe(home.ecs[component][id]);
  }
  const before = structuredClone(first);
  home.ecs.personable[id].age = 99;
  home.ecs.personality[id].traits.push("changed during play");
  home.ecs.relationships[id].known = {};
  expect(first).toEqual(before);
});
