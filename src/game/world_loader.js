import { decompressGame } from "game/save_game";

export async function loadWorldTemplate(progress = async () => {}, fetchWorld = fetch) {
  await progress("Downloading this week's world", 0);
  const response = await fetchWorld("world.json.gz", { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not download this week's world (HTTP " + response.status + "). Please try again.");
  const total = Number(response.headers.get("Content-Length"));
  const reader = response.body.getReader(), chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    await progress("Downloading this week's world", total ? .8 * Math.min(1, received / total) : 0);
  }
  await progress("Unpacking this week's world", .8);
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const world = await decompressGame(bytes);
  await progress("Ready to arrive", 1);
  return world;
}
