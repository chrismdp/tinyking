/* global it, expect, jest */
import { loadWorldTemplate } from "game/world_loader";
import { compressGame } from "game/save_game";

const fixture = { ecs: { nextId: 3, playable: {} }, map: { seed: 13 }, ui: { show: {} }, days: .375 };
const download = async (knownLength = true) => {
  const bytes = new Uint8Array(await compressGame(structuredClone(fixture)));
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 10));
    controller.enqueue(bytes.slice(10));
    controller.close();
  } });
  return new Response(body, { headers: knownLength ? { "Content-Length": String(bytes.length) } : {} });
};

it.each([true, false])("downloads and restores the gzip save with progress (length known: %s)", async knownLength => {
  const fetchWorld = jest.fn().mockResolvedValue(await download(knownLength));
  const updates = [];
  const loaded = await loadWorldTemplate(async (label, value) => updates.push({ label, value }), fetchWorld);
  expect(fetchWorld).toHaveBeenCalledWith("/worlds/current.json.gz", { cache: "no-cache" });
  expect(loaded).toMatchObject(fixture);
  expect(loaded.ui.playerId).toBeUndefined();
  expect(updates.some(u => /Downloading/.test(u.label))).toBe(true);
  expect(updates.some(u => /Unpacking/.test(u.label))).toBe(true);
  expect(updates.at(-1).value).toBe(1);
  expect(updates.every((u, i) => u.value >= 0 && u.value <= 1 && (!i || u.value >= updates[i - 1].value))).toBe(true);
});

it("downloads the week selected in the menu", async () => {
  const fetchWorld = jest.fn().mockResolvedValue(await download());
  expect(await loadWorldTemplate(async () => {}, fetchWorld, "2026-W47")).toMatchObject(fixture);
  expect(fetchWorld).toHaveBeenCalledWith("/worlds/2026-W47.json.gz", { cache: "no-cache" });
});

it("rejects an HTTP failure before trying to unpack it", async () => {
  await expect(loadWorldTemplate(async () => {}, async () => new Response("missing", { status: 404 }))).rejects.toThrow(/404/);
});

it("reports network, truncated download and incompatible save failures to its caller", async () => {
  await expect(loadWorldTemplate(async () => {}, async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  await expect(loadWorldTemplate(async () => {}, async () => new Response(new Uint8Array([31, 139, 8])))).rejects.toThrow();
  const bytes = await new Response(new Blob([JSON.stringify({ version: -1 })]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  await expect(loadWorldTemplate(async () => {}, async () => new Response(bytes))).rejects.toThrow(/different version/);
});
