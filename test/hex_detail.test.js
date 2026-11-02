import { captureDetailOrigins, prepareDetail, prepareNeighbourDetails, scheduleNeighbourDetails } from "game/hex_detail";
import { compactMap, buildHistoryMap } from "game/world_history";
import { ensureMap } from "game/travel";
import { encodeWorldSave, decodeWorldSave } from "game/hex_storage";
import { gameData, decompressGame } from "game/save_game";
import { community, attach } from "./support/travel";

const fixture = () => {
  const { s } = community();
  const away = community({ namespace: "away-", key: "6,5", player: false }).s;
  attach(s, away);
  s.travel.wholeWorld = true;
  s.worldHistory = { version: 1, contents: {} };
  for (const [key, map] of Object.entries(s.travel.maps)) s.travel.maps[key] = compactMap(map);
  captureDetailOrigins(s);
  return { s, away };
};
afterEach(() => jest.restoreAllMocks());

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
  jest.spyOn(require("game/world_history"), "buildHistoryMap").mockResolvedValue(structuredClone(away.travel.maps["6,5"]));
  await prepareNeighbourDetails(s);
  const packet = await encodeWorldSave(structuredClone(gameData(s)));
  for (const [key, record] of Object.entries(packet.records)) disk.set(key, record);
  const loaded = await decodeWorldSave(structuredClone(packet.world), key => disk.get(key));
  expect(loaded.travel.preparedMaps).toBeUndefined();
  expect(Object.keys(loaded.travel.hexRecords)).toHaveLength(2);
  const summary = loaded.travel.maps["6,5"], person = Object.keys(summary.residents)[0];
  summary.ecs.nameable[person] = { ...summary.ecs.nameable[person], nickname: "Changed while away" };
  summary.ecs.personable[person].age = 42;
  loaded.persistence = { readHex: async key => decompressGame(disk.get(key).bytes) };
  const detailed = await ensureMap(loaded, "6,5");
  expect(detailed.ecs.nameable[person].nickname).toBe("Changed while away");
  expect(detailed.ecs.personable[person].age).toBe(42);
  expect(detailed.ecs.mappable).toEqual(away.ecs.mappable);
  expect(detailed.unopenedDetail).toBeUndefined();
  expect(buildHistoryMap).toHaveBeenCalledTimes(1);
});
