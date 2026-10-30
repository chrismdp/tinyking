/* eslint-disable no-undef */
// Run under the shared heavy-probe lock. Capture before editing game code:
// node scripts/history-performance.js capture shots/perf-before 20
// Then compare, with each seed in a fresh process for cold/warm measurements:
// node scripts/history-performance.js compare shots/perf-after 20 shots/perf-before
// Optional HISTORY_PROFILE=shots/history.cpuprofile profiles the first generation.
require("./game-register");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const inspector = require("node:inspector");
const history = require("../src/game/history");
const { historyStep } = require("../src/game/social");

let historyTiming;
const generateHistory = history.generateHistory;
history.generateHistory = (...args) => {
  const cpu = process.cpuUsage(), start = performance.now();
  const result = generateHistory(...args);
  const usage = process.cpuUsage(cpu);
  historyTiming = { wallMs: performance.now() - start, cpuMs: (usage.user + usage.system) / 1000 };
  return result;
};
const { generateMap } = require("../src/game/map");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const [mode, out, seedText, baseline] = process.argv.slice(2);
assert(["capture", "compare"].includes(mode) && out && seedText && (mode != "compare" || baseline),
  "usage: history-performance.js capture|compare OUTPUT SEED [BASELINE]");
const seed = Number(seedText);
assert(Number.isFinite(seed));
fs.mkdirSync(out, { recursive: true });

async function main() {
  const report = { seed, node: process.version, cpu: os.cpus()[0].model, cpus: os.cpus().length,
    loadBefore: os.loadavg(), totalMemory: os.totalmem(), freeMemoryBefore: os.freemem(), runs: [], checkpoints: [] };
  let session;
  const post = method => new Promise((resolve, reject) => session.post(method, (error, value) => error ? reject(error) : resolve(value)));
  if (process.env.HISTORY_PROFILE) {
    session = new inspector.Session(); session.connect();
    await post("Profiler.enable"); await post("Profiler.start");
  }
  let generated, generatedJSON;
  const check = (label, json) => {
    const filename = "seed-" + seed + "-" + label + ".json";
    fs.writeFileSync(path.join(out, filename), json);
    if (mode == "compare") assert(json === fs.readFileSync(path.join(baseline, filename), "utf8"), filename + " changed (actual JSON retained in output)");
    return { label, bytes: Buffer.byteLength(json), sha256: hash(json) };
  };
  for (const temperature of ["cold", "warm"]) {
    const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
    const cpu = process.cpuUsage(), start = performance.now();
    const result = await generateMap(s, seed, async () => {});
    const wallMs = performance.now() - start, usage = process.cpuUsage(cpu);
    report.runs.push({ temperature, totalWallMs: wallMs, totalCpuMs: (usage.user + usage.system) / 1000,
      historyWallMs: historyTiming.wallMs, historyCpuMs: historyTiming.cpuMs, load: os.loadavg() });
    if (session) {
      const { profile } = await post("Profiler.stop"); session.disconnect(); session = null;
      fs.writeFileSync(process.env.HISTORY_PROFILE, JSON.stringify(profile));
    }
    // Same results installed by the UI after generateMap, without a renderer.
    s.map = result.map; s.ui.playerId = result.playerId;
    const json = JSON.stringify(s); // No replacer, sorting, projection or omissions.
    assert.deepEqual(Object.getOwnPropertyNames(s).filter(key => !Object.prototype.propertyIsEnumerable.call(s, key)), ["historyGenerationMs"]);
    if (temperature == "cold") {
      generated = s; generatedJSON = json;
      report.generated = check("generated", json);
    } else if (json !== generatedJSON) {
      fs.writeFileSync(path.join(out, "seed-" + seed + "-warm-mismatch.json"), json);
      assert.fail("cold/warm full state differs (actual warm JSON retained)");
    }
  }
  let current = generated;
  for (let season = 0; season < 20; season++) {
    const input = JSON.stringify(current);
    const next = historyStep(current, season);
    assert(JSON.stringify(current) === input, "historyStep mutated input at " + season);
    const json = JSON.stringify(next);
    const checkpoint = { season, bytes: Buffer.byteLength(json), sha256: hash(json) };
    if ([0, 3, 19].includes(season)) Object.assign(checkpoint, check("season-" + season, json));
    report.checkpoints.push(checkpoint);
    current = next;
  }
  if (mode == "compare") {
    const previous = JSON.parse(fs.readFileSync(path.join(baseline, "seed-" + seed + "-report.json"), "utf8"));
    assert.deepEqual(report.checkpoints, previous.checkpoints, "full seasonal hashes differ");
    report.replays = [];
    for (const from of [-1, 0, 3]) {
      const label = from < 0 ? "generated" : "season-" + from;
      const input = fs.readFileSync(path.join(baseline, "seed-" + seed + "-" + label + ".json"), "utf8");
      const captured = JSON.parse(input), next = historyStep(captured, from + 1);
      assert(JSON.stringify(captured) === input, "captured input mutated: " + label);
      const json = JSON.stringify(next), sha256 = hash(json);
      if (sha256 !== previous.checkpoints[from + 1].sha256) {
        fs.writeFileSync(path.join(out, "seed-" + seed + "-replay-mismatch.json"), json);
        assert.fail("captured replay differs: " + label);
      }
      report.replays.push({ from: label, season: from + 1, sha256 });
    }
  }
  report.loadAfter = os.loadavg(); report.freeMemoryAfter = os.freemem();
  fs.writeFileSync(path.join(out, "seed-" + seed + "-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
