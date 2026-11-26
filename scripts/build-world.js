/* eslint-disable no-undef */
const started = performance.now();
require("./game-register");
const { parseArgs } = require("node:util");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { weekSeed } = require("../src/game/world_seed");
const { generateWorldTemplate } = require("../src/game/world_history");
const { compressGame } = require("../src/game/save_game");

async function main() {
  const { values } = parseArgs({ options: { seed: { type: "string" }, out: { type: "string", default: "dist/world.json.gz" } } });
  const seed = values.seed === undefined ? weekSeed() : Number(values.seed);
  if (!Number.isSafeInteger(seed)) throw new Error("--seed must be an integer");
  console.log("Building world for seed " + seed);
  const state = { ecs: { nextId: 1 }, space: {}, ui: { show: {} }, redraws: [], days: .375, game_speed: "normal" };
  await generateWorldTemplate(state, seed);
  const bytes = Buffer.from(await compressGame(state));
  const out = path.resolve(values.out);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(JSON.stringify({ seed, out, seconds: +((performance.now() - started) / 1000).toFixed(3), compressedBytes: bytes.length, MiB: +(bytes.length / 1048576).toFixed(3) }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
