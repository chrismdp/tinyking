/* global it, expect, jest */
import worker from "../src/worker";
import { WORLD_PREFIX, parseWorldKey, parseWorldWeek, worldKey, worldWeek } from "game/world_weeks";

const request = path => new Request("https://tinyking.test" + path);
const fakeBucket = (pages = [[]], bodies = {}) => ({
  list: jest.fn(async ({ cursor }) => {
    const page = Number(cursor || 0);
    return { objects: pages[page].map(key => ({ key })), truncated: page < pages.length - 1, cursor: String(page + 1) };
  }),
  get: jest.fn(async key => key in bodies ? { body: new Blob([bodies[key]]).stream() } : null)
});

it("parses only canonical ISO weeks in the current save version", () => {
  expect(parseWorldKey(WORLD_PREFIX + "2026-W48.json.gz")).toEqual({ id: "2026-W48", monday: "2026-11-23" });
  expect(parseWorldWeek("2020-W53")).toEqual({ id: "2020-W53", monday: "2020-12-28" });
  for (const key of ["v999/2026-W48.json.gz", WORLD_PREFIX + "2021-W53.json.gz", WORLD_PREFIX + "2026-W00.json.gz", WORLD_PREFIX + "2026-W1.json.gz", WORLD_PREFIX + "2026-W48.json", WORLD_PREFIX + "nested/2026-W48.json.gz"]) {
    expect(parseWorldKey(key)).toBeNull();
  }
  expect(worldKey("2026-W48")).toBe(WORLD_PREFIX + "2026-W48.json.gz");
});

it.each([
  ["2026-11-29T23:59:59Z", "2026-W48"],
  ["2026-11-30T00:00:00Z", "2026-W49"],
  ["2026-07-05T22:59:59Z", "2026-W27"],
  ["2026-07-05T23:00:00Z", "2026-W28"],
  ["2024-12-30T00:00:00Z", "2025-W01"]
])("names the London week at %s", (date, id) => {
  expect(worldWeek(new Date(date)).id).toBe(id);
});

it("lists all R2 pages, filters keys and sorts newest first across ISO years", async () => {
  const WORLDS = fakeBucket([
    [WORLD_PREFIX + "2026-W48.json.gz", "v999/2027-W01.json.gz", WORLD_PREFIX + "notes.txt"],
    [WORLD_PREFIX + "2027-W01.json.gz", WORLD_PREFIX + "2026-W47.json.gz", WORLD_PREFIX + "2026-W53.json.gz"]
  ]);
  const response = await worker.fetch(request("/worlds"), { WORLDS });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/json");
  expect(await response.json()).toEqual([
    { id: "2027-W01", monday: "2027-01-04" },
    { id: "2026-W53", monday: "2026-12-28" },
    { id: "2026-W48", monday: "2026-11-23" },
    { id: "2026-W47", monday: "2026-11-16" }
  ]);
  expect(WORLDS.list).toHaveBeenNthCalledWith(1, { prefix: WORLD_PREFIX });
  expect(WORLDS.list).toHaveBeenNthCalledWith(2, { prefix: WORLD_PREFIX, cursor: "1" });
});

it("streams the newest stored week even when this calendar week is missing", async () => {
  const key = worldKey("2026-W47");
  const WORLDS = fakeBucket([[worldKey("2026-W46"), key]], { [key]: "gzip bytes" });
  const response = await worker.fetch(request("/worlds/current.json.gz"), { WORLDS });
  expect(await response.text()).toBe("gzip bytes");
  expect(WORLDS.get).toHaveBeenCalledWith(key);
  expect(response.headers.get("Content-Type")).toBe("application/gzip");
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
});

it("streams an explicit past week with a long cache lifetime and no bucket listing", async () => {
  const key = worldKey("2020-W53"), WORLDS = fakeBucket([], { [key]: "old world" });
  const response = await worker.fetch(request("/worlds/2020-W53.json.gz"), { WORLDS });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("old world");
  expect(response.headers.get("Content-Type")).toBe("application/gzip");
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000");
  expect(WORLDS.list).not.toHaveBeenCalled();
});

it("keeps an explicit current week briefly cached because deploys overwrite it", async () => {
  const week = worldWeek().id, key = worldKey(week);
  const response = await worker.fetch(request("/worlds/" + week + ".json.gz"), { WORLDS: fakeBucket([], { [key]: "world" }) });
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
});

it("returns an empty list and 404 for an empty bucket, missing weeks and malformed routes", async () => {
  const WORLDS = fakeBucket();
  expect(await (await worker.fetch(request("/worlds"), { WORLDS })).json()).toEqual([]);
  for (const path of ["/worlds/current.json.gz", "/worlds/2026-W48.json.gz", "/worlds/2021-W53.json.gz", "/worlds/2026-W1.json.gz", "/worlds/other", "/worlds-extra"]) {
    const response = await worker.fetch(request(path), { WORLDS });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
});

it("delegates other paths to static assets and rejects writes to worlds", async () => {
  const ASSETS = { fetch: jest.fn(async () => new Response("asset")) }, WORLDS = fakeBucket();
  expect(await (await worker.fetch(request("/debug/worldgen"), { ASSETS })).text()).toBe("asset");
  expect(ASSETS.fetch).toHaveBeenCalled();
  expect((await worker.fetch(new Request("https://tinyking.test/worlds", { method: "POST" }), { WORLDS })).status).toBe(405);
  expect(WORLDS.list).not.toHaveBeenCalled();
});
