/* eslint-disable no-undef */
// Same seed, Babel timers and export boundary as shots/regress-profile.cjs.
// Run under a shared heavy-work lock. Exports are excluded from CPU and wall.
const fs = require("fs"), path = require("path"), os = require("os"), v8 = require("v8");
const Module = require("module"), babel = require("@babel/core");
const root = path.resolve(__dirname, ".."), label = process.argv[2] || "local-population-final";
const names = new Set(("generateWorldHistory advanceWorldClock buildHistoryMap generateMap generateTerrain generateEconomicValue generateSettlements buildGeography gradeRoads generateTrees surveyTrees runSeasonSocialActions advanceSeasonRules references publish reconcileEstates installStoredHistory generateVillageLife initializeEcology generateForage runSocialActions listenerNewsScore chooseNews storyGroups exchangeNews runNearbyCourtships createCourtshipIndex").split(" "));
const resolve = Module._resolveFilename, load = require.extensions[".js"];
const totals = {}, stack = [];
let exportMs = 0, exportCpuMs = 0;
global.__populationProfile = {
  enter(name) { const row = { name, at: performance.now(), cpu: process.cpuUsage(), childMs: 0, childCpuMs: 0 }; stack.push(row); return row; },
  leave(row) {
    const ms = performance.now() - row.at, usage = process.cpuUsage(row.cpu), cpuMs = (usage.user + usage.system) / 1000;
    stack.pop();
    if (stack.length) { stack.at(-1).childMs += ms; stack.at(-1).childCpuMs += cpuMs; }
    const total = totals[row.name] ||= { calls: 0, ms: 0, cpuMs: 0, selfMs: 0, selfCpuMs: 0 };
    total.calls++; total.ms += ms; total.cpuMs += cpuMs; total.selfMs += ms - row.childMs; total.selfCpuMs += cpuMs - row.childCpuMs;
  }
};
global.__populationHistory = state => {
  const at = performance.now(), cpu = process.cpuUsage();
  fs.writeFileSync("shots/regress-history-" + label + ".v8", v8.serialize(state));
  const usage = process.cpuUsage(cpu); exportMs += performance.now() - at; exportCpuMs += (usage.user + usage.system) / 1000;
};
const printedSeasons = new Set();
global.__populationSeason = state => {
  const j = state.travel;
  if (!j || j.season % 20 || printedSeasons.has(j.season)) return;
  printedSeasons.add(j.season);
  console.log(JSON.stringify({ season: j.season, people: Object.keys(j.people).length,
    living: Object.values(j.people).filter(p => !p.personable.dead).length }));
};
Module._resolveFilename = function(request, ...args) {
  if (/^(game|data|render)\//.test(request)) request = path.join(root, "src", request);
  return resolve.call(this, request, ...args);
};
require.extensions[".js"] = function(module, filename) {
  if (!filename.startsWith(path.join(root, "src") + path.sep)) return load(module, filename);
  const { code } = babel.transformFileSync(filename, { presets: [["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }]], babelrc: false, configFile: false,
    plugins: [function({ types: t }) { return { visitor: { FunctionDeclaration(p) {
      if (!names.has(p.node.id?.name)) return;
      const name = p.node.id.name, body = p.node.body.body, token = p.scope.generateUidIdentifier("profile");
      p.node.body.body = [t.variableDeclaration("const", [t.variableDeclarator(token, t.callExpression(t.memberExpression(t.identifier("__populationProfile"), t.identifier("enter")), [t.stringLiteral(path.basename(filename) + ":" + name)]))]),
        t.tryStatement(t.blockStatement(body), null, t.blockStatement([t.expressionStatement(t.callExpression(t.memberExpression(t.identifier("__populationProfile"), t.identifier("leave")), [token]))]))];
      if (name === "generateWorldHistory") p.node.body.body[1].finalizer.body.push(t.expressionStatement(t.callExpression(t.identifier("__populationHistory"), [t.identifier("s")])));
      if (name === "advanceWorldClock") p.node.body.body[1].finalizer.body.push(t.expressionStatement(t.callExpression(t.identifier("__populationSeason"), [t.identifier("s")])));
      p.skip();
    } } }; }]
  }); module._compile(code, filename);
};
require.extensions[".csv"] = (module, filename) => { module.exports = fs.readFileSync(filename, "utf8").trim().split("\n").map(line => line.split(",")); };
(async () => {
  const { generateWorldGame } = require("../src/game/world_history"), { startGame } = require("../src/game/new_game");
  const s = { ecs: { nextId: 1 }, space: {}, redraws: [], days: .375, ui: { show: {} }, game_speed: "paused" };
  const report = { label, seed: 13, node: process.version, cpu: os.cpus()[0].model, loadBefore: os.loadavg(), started: new Date().toISOString(), source: {} };
  const crypto = require("crypto");
  for (const file of ["nearby_courtship", "social", "events", "event_knowledge", "travel", "world_history", "map", "geography", "villages"]) report.source[file] = crypto.createHash("sha256").update(fs.readFileSync("src/game/" + file + ".js")).digest("hex");
  const stages = [], at = performance.now(), cpu = process.cpuUsage(); let last;
  const result = await generateWorldGame(s, 13, async label => {
    if (label !== last) { stages.push({ label, ms: performance.now() - at - exportMs }); last = label; }
  });
  s.map = result.map; s.ui.playerId = result.playerId; startGame(s, { skip: true });
  const usage = process.cpuUsage(cpu);
  report.runs = [{ name: "new", ms: performance.now() - at - exportMs, cpuMs: (usage.user + usage.system) / 1000 - exportCpuMs,
    memory: process.memoryUsage(), peakRssKiB: process.resourceUsage().maxRSS, stages, functions: totals }];
  global.gc(); report.memoryAfterGc = process.memoryUsage(); report.loadAfter = os.loadavg();
  fs.writeFileSync("shots/regress-game-" + label + ".v8", v8.serialize(require("../src/game/save_game").gameData(s)));
  fs.writeFileSync("shots/regress-profile-" + label + ".json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label, cpuMs: report.runs[0].cpuMs, ms: report.runs[0].ms, memoryAfterGc: report.memoryAfterGc }));
})().catch(error => { console.error(error); process.exitCode = 1; });
