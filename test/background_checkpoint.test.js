import { createAutosave } from "game/autosave";
import { completeTravel } from "game/travel";
import { createSimulation } from "game/simulation";
import { skipIntro } from "game/intro";
import { encodeWorldSave, decodeWorldSave } from "game/hex_storage";
import { decompressGame } from "game/save_game";
import { community, attach } from "./support/travel";

let source;
beforeAll(() => {
  source = community();
  source.s.travel.wholeWorld = true;
  attach(source.s, community({ namespace: "away-", key: "6,5", player: false }).s);
  attach(source.s, community({ namespace: "next-", key: "6,4", player: false }).s);
});
const fixture = () => {
  const { s, ids } = structuredClone(source), frames = [], disk = new Map();
  let world, held = false, failure = false, acknowledge;
  const client = jest.fn((operation, payload) => {
    if (operation === "hex") return decompressGame(disk.get(payload).bytes);
    const copy = structuredClone(payload);
    return (async () => {
      const packet = await encodeWorldSave(copy.state, copy.hexes, key => disk.get(key));
      if (held) await new Promise(resolve => { acknowledge = resolve; });
      if (failure) throw new Error("disk full");
      // One atomic publication, just like the worker's single transaction.
      for (const [key, record] of Object.entries(packet.records)) disk.set(key, record);
      world = structuredClone(packet.world);
      return { hexRecords: packet.hexRecords };
    })();
  });
  s.persistence = createAutosave(s, client, () => {}, fn => frames.push(fn));
  return { s, ids, frames, client,
    hold() { held = true; }, fail(value) { failure = value; },
    async release() { while (!acknowledge) await new Promise(resolve => setImmediate(resolve)); held = false; acknowledge(); },
    load: () => decodeWorldSave(structuredClone(world), key => disk.get(key)) };
};

it("resumes the simulation on arrival and evicts only after acknowledgement", async () => {
  const f = fixture(), { s } = f, from = s.travel.active;
  const sim = createSimulation(s);
  f.hold();
  s.pendingPlayerTravel = { destination: "6,5", side: 0 };
  await sim.step(0, 0);
  skipIntro(s);
  expect(s.worldBusy).toBe(false);
  expect(s.transition).toBeNull();
  expect(s.travel.active).toBe("6,5");
  expect(f.client).not.toHaveBeenCalled();
  f.frames.shift()();
  const committed = s.persistence.afterCheckpoint();
  expect(s.travel.maps[from].ecs.mappable).toBeDefined();
  const before = s.days;
  s.game_speed = "normal";
  sim.tick();
  expect(s.days).toBeGreaterThan(before);
  await f.release();
  await committed;
  expect(s.travel.maps[from].compact).toBe(true);
});

it("keeps a failed departed hex and retries and evicts it on the next save", async () => {
  const f = fixture(), { s } = f, from = s.travel.active;
  await completeTravel(s, { destination: "6,5", side: 0 });
  f.fail(true);
  f.frames.shift()();
  await s.persistence.flush();
  expect(s.persistence.error).toContain("disk full");
  expect(s.travel.maps[from].ecs.mappable).toBeDefined();
  f.fail(false);
  await s.persistence.request();
  expect(s.persistence.error).toBeNull();
  expect(s.travel.maps[from].compact).toBe(true);
  expect((await f.load()).travel.active).toBe("6,5");
});

it("reloads the complete pre-hop save while the arrival checkpoint is unacknowledged", async () => {
  const f = fixture(), { s, ids } = f;
  await s.persistence.request();
  const before = await f.load();
  f.hold();
  await completeTravel(s, { destination: "6,5", side: 0 });
  f.frames.shift()();
  const committed = s.persistence.afterCheckpoint();
  const reloaded = await f.load();
  expect(reloaded).toEqual(before);
  expect(reloaded.travel.active).toBe("5,5");
  expect(reloaded.days).toBe(.375);
  expect(Object.values(reloaded.travel.maps).filter(map => map.residents[ids[0]])).toHaveLength(1);
  await f.release();
  await committed;
  expect((await f.load()).travel.active).toBe("6,5");
});

it.each([false, true])("waits for the previous checkpoint before a second hop can mutate the world (already submitted=%s)", async submitted => {
  const f = fixture(), { s } = f;
  f.hold();
  await completeTravel(s, { destination: "6,5", side: 0 });
  skipIntro(s);
  if (submitted) f.frames.shift()();
  const days = s.days;
  // Simulation marks the world busy before invoking completeTravel.
  s.worldBusy = true;
  const second = completeTravel(s, { destination: "6,4", side: 2 });
  await new Promise(resolve => setImmediate(resolve));
  expect(f.client).toHaveBeenCalledTimes(1);
  expect(s.travel.active).toBe("6,5");
  expect(s.days).toBe(days);
  await f.release();
  await second;
  expect(s.travel.active).toBe("6,4");
  s.worldBusy = false;
  while (f.frames.length) f.frames.shift()();
  await s.persistence.flush();
});

it("leaves a second hop in place on checkpoint failure, then saves and retries", async () => {
  const f = fixture(), { s } = f;
  f.hold();
  await completeTravel(s, { destination: "6,5", side: 0 });
  skipIntro(s);
  f.fail(true);
  const days = s.days;
  const second = completeTravel(s, { destination: "6,4", side: 2 });
  await f.release();
  await second;
  expect(s.travel.active).toBe("6,5");
  expect(s.days).toBe(days);
  expect(s.transition).toBeNull();
  expect(s.persistence.error).toContain("disk full");
  expect(s.travelError).toBeUndefined();
  f.fail(false);
  await s.persistence.request();
  await completeTravel(s, { destination: "6,4", side: 2 });
  expect(s.travel.active).toBe("6,4");
  while (f.frames.length) f.frames.shift()();
  await s.persistence.flush();
});

it("queues autosaves and pagehide behind the pending arrival checkpoint", async () => {
  const f = fixture(), { s } = f;
  f.hold();
  await completeTravel(s, { destination: "6,5", side: 0 });
  f.frames.shift()();
  const saving = s.persistence.flush();
  s.persistence.request();
  s.persistence.request(true);
  expect(f.client).toHaveBeenCalledTimes(1);
  await f.release();
  await saving;
  await s.persistence.flush();
  expect(f.client.mock.calls.map(([operation]) => operation)).toEqual(["checkpoint", "save"]);
});
