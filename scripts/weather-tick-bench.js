/* eslint-disable no-undef */
require("./game-register");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const { generateMap } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { updateWeather } = require("../src/game/weather");
const { HOUR } = require("../src/game/time");

(async () => {
  const state = { ecs: { nextId: 1 }, ui: {}, days: 0.375, game_speed: "fast" };
  const result = await generateMap(state, 13, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  // Measure hourly bookkeeping independently of HTN plans, which vary as a village plays.
  state.ecs.planner = {};
  const baselinePath = path.resolve(__dirname, "../shots/simulation-before.js");
  const baseline = new Module(baselinePath, module);
  baseline.filename = baselinePath;
  baseline.paths = module.paths;
  const ref = process.argv[2] || "d1b7b4edc0f4a336a92bf6955d16f9d6457b9e5c";
  const source = require("child_process").execFileSync("git", ["show", ref + ":src/game/simulation.js"], { encoding: "utf8" });
  baseline._compile(babel.transformSync(source, { presets: [["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }]], babelrc: false, configFile: false }).code, baselinePath);
  const measure = factory => {
    const copy = structuredClone(state);
    const simulation = factory(copy);
    const start = performance.now();
    for (let i = 0; i < 2000; i++) simulation.step(60.0001);
    return (performance.now() - start) / 2000;
  };
  // Warm the topology, fields and JIT before measuring.
  measure(createSimulation);
  const before = measure(baseline.exports.createSimulation);
  const after = measure(createSimulation);
  const start = performance.now();
  for (let i = 0; i < 2000; i++) {
    state.days = 0.375 + i * HOUR;
    updateWeather(state);
  }
  const report = { seed: 13, hexes: 91, tiles: Object.keys(state.snow).length, iterations: 2000,
    hourlyTickBeforeMs: before, hourlyTickAfterMs: after, weatherAndSnowMs: (performance.now() - start) / 2000 };
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(path.resolve(__dirname, "../shots/perf-tick.json"), JSON.stringify(report, null, 2) + "\n");
})().catch(e => { console.error(e); process.exit(1); });
