/* eslint-disable no-undef */
const started = performance.now();
require("./game-register");
const { parseArgs } = require("node:util");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { weekSeed } = require("../src/game/world_seed");
const { worldWeek, worldKey } = require("../src/game/world_weeks");
const { appendFileSync } = require("node:fs");
const { generateWorldTemplate } = require("../src/game/world_history");
const { compressGame } = require("../src/game/save_game");

async function main() {
  const { values } = parseArgs({ options: { seed: { type: "string" }, out: { type: "string" } } });
  const week = worldWeek(), key = worldKey(week.id);
  const seed = values.seed === undefined ? weekSeed(new Date(week.monday)) : Number(values.seed);
  if (!Number.isSafeInteger(seed)) throw new Error("--seed must be an integer");
  console.log("Building world " + week.id + " for seed " + seed);
  const state = { ecs: { nextId: 1 }, space: {}, ui: { show: {} }, redraws: [], days: .375, game_speed: "normal" };
  await generateWorldTemplate(state, seed);
  const bytes = Buffer.from(await compressGame(state));
  const out = path.resolve(values.out || path.join("worlds", key));
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(JSON.stringify({ week: week.id, key, seed, out, seconds: +((performance.now() - started) / 1000).toFixed(3), compressedBytes: bytes.length, MiB: +(bytes.length / 1048576).toFixed(3) }));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "week=" + week.id + "\nkey=" + key + "\nfile=" + out + "\n");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
