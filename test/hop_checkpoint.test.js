import { createAutosave, bindAutosave } from "game/autosave";
import { completeTravel, acceptTravel } from "game/travel";
import { encodeWorldSave, decodeWorldSave } from "game/hex_storage";
import { community, attach } from "./support/travel";

const fixture = () => {
  const { s, ids } = community();
  s.travel.wholeWorld = true;
  s.worldHistory = { version: 1 };
  attach(s, community({ namespace: "away-", key: "6,5", player: false }).s);
  let world, releaseWrite;
  let held = false;
  const records = new Map(), frames = [], submitted = [];
  const client = jest.fn((operation, payload) => {
    // The real worker takes this copy synchronously in postMessage.
    const copy = structuredClone(payload);
    submitted.push({ operation, copy });
    return (async () => {
      const packet = await encodeWorldSave(copy.state || copy, copy.hexes || {}, key => records.get(key));
      if (held) await new Promise(resolve => { releaseWrite = resolve; });
      for (const [key, value] of Object.entries(packet.records)) records.set(key, value);
      world = structuredClone(packet.world);
      return { hexRecords: packet.hexRecords };
    })();
  });
  s.persistence = createAutosave(s, client, () => {}, fn => frames.push(fn));
  return { s, ids, frames, submitted, hold: () => { held = true; }, release: () => releaseWrite(), waiting: () => !!releaseWrite, load: () => decodeWorldSave(structuredClone(world), key => records.get(key)) };
};
const uniquePlayer = (saved, id) => {
  expect(Object.values(saved.travel.maps).filter(map => map.residents[id]).length + saved.travel.transit.filter(trip => trip.bundle.id === id).length).toBe(1);
};

it("shows the arrival before copying or committing its checkpoint and survives closing during the write", async () => {
  const f = fixture(), { s, ids } = f, from = s.travel.active;
  const house = Object.keys(s.ecs.building)[0];
  s.ecs.nameable[house].nickname = "The home left behind";
  expect(acceptTravel(s, s.map.entrances[0].tileIds[0])).toBe(true);
  await s.persistence.request();
  const before = await f.load();
  expect(before.travel.active).toBe(from);
  expect(before.travel.journey.route).toEqual(["6,5"]);
  uniquePlayer(before, ids[0]);
  const calls = f.submitted.length;
  await completeTravel(s, s.ecs.manager[ids[0]].jobs[0]);
  expect(s.travel.active).toBe("6,5");
  expect(s.transition).toBeNull();
  expect(s.intro.active).toBe(true);
  expect(f.submitted).toHaveLength(calls);
  expect(s.travel.maps[from].ecs.mappable).toBeDefined();
  const page = new EventTarget(), doc = new EventTarget();
  const unbind = bindAutosave(s.persistence, page, doc);
  f.hold();
  // Close before the deferred frame callback: pagehide must submit immediately.
  page.dispatchEvent(new Event("pagehide"));
  expect(f.submitted).toHaveLength(calls + 1);
  const saving = s.persistence.flush();
  // The old committed journey is still complete and contains one player.
  uniquePlayer(await f.load(), ids[0]);
  while (!f.waiting()) await new Promise(resolve => setImmediate(resolve));
  const age = s.ecs.personable[ids[0]].age;
  // Page memory can disappear; only the submitted worker copy may be used.
  s.ecs = {};
  f.release();
  await saving;
  const loaded = await f.load();
  expect(loaded.travel.active).toBe("6,5");
  expect(loaded.travel.journey).toBeNull();
  expect(loaded.ecs.personable[ids[0]].age).toBe(age);
  uniquePlayer(loaded, ids[0]);
  expect(loaded.travel.maps[from].ecs.mappable).toBeUndefined();
  expect(s.travel.maps[from].compact).toBe(true);
  const sourceRecord = f.submitted.at(-1).copy.hexes[from];
  expect(sourceRecord.ecs.nameable[house].nickname).toBe("The home left behind");
  // A late animation callback cannot submit an obsolete second checkpoint.
  f.frames.forEach(fn => fn());
  expect(f.submitted).toHaveLength(calls + 1);
  unbind();
});

it("keeps departed details available when a background checkpoint fails", async () => {
  const { s } = community();
  s.travel.wholeWorld = true;
  attach(s, community({ namespace: "away-", key: "6,5", player: false }).s);
  const frames = [];
  s.persistence = createAutosave(s, async () => { throw new Error("disk full"); }, () => {}, fn => frames.push(fn));
  const from = s.travel.active;
  await completeTravel(s, { destination: "6,5", side: 0 });
  expect(s.travel.active).toBe("6,5");
  frames.shift()();
  await s.persistence.flush();
  expect(s.persistence.error).toContain("disk full");
  expect(s.travel.maps[from].ecs.mappable).toBeDefined();
});
