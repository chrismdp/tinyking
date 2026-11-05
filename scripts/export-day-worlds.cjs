/* eslint-disable no-undef */
// Convert the supplied immutable generation snapshots into the browser save format.
require("./research/day-with-register.cjs");
const fs = require("node:fs");
const v8 = require("node:v8");
const zlib = require("node:zlib");
const path = require("node:path");
const { replaceGame, serialiseGame, restoreGame } = require("../src/game/save_game");
const source = process.argv[2] || "/home/cp/code/tk-daywith/.cache/day-with";
for (const seed of [13, 7]) {
  const state = { redraws: [] };
  replaceGame(state, v8.deserialize(fs.readFileSync(path.join(source, `initial-${seed}.bin`))));
  const text = serialiseGame(state);
  const bytes = zlib.gzipSync(text);
  const restored = restoreGame(zlib.gunzipSync(bytes).toString());
  if (restored.ui.playerId !== state.ui.playerId || restored.days !== state.days) throw new Error("Round trip failed");
  fs.writeFileSync(path.resolve(`src/assets/day/seed-${seed}.json.gz`), bytes);
  console.log(`seed ${seed}: ${text.length} save bytes, ${bytes.length} gzip bytes; player and clock round trip passed`);
  console.log(JSON.stringify({days:state.days,player:state.ui.playerId,walkable:Object.keys(state.ecs.walkable).length,villages:state.villages,knowledge:state.knowledge[state.ui.playerId],home:state.ecs.household[state.ui.playerId]},null,2).slice(0,7500));
}
