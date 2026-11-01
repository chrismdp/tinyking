/* eslint-disable no-undef */
// Bounded builder captures, using one seed-13 snapshot after real night planning.
const fs = require("fs"), path = require("path"), assert = require("node:assert/strict");
require("./game-register");
const { chromium } = require("playwright-core");
const { generateMap } = require("../src/game/map");
const { startIntro } = require("../src/game/intro");
const { createSimulation } = require("../src/game/simulation");
const { occupiedHomes } = require("../src/game/home");
const out = path.resolve("shots/night-light");
const phase = process.argv[2] || "before";
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const fixturePath = path.join(out, "fixture.json");
  if (!fs.existsSync(fixturePath)) {
    const s = { ecs: { nextId: 1 }, ui: { show: {} }, redraws: [], days: 21 / 24, game_speed: "normal" };
    const result = await generateMap(s, 13, async () => {});
    s.map = result.map; s.ui.playerId = result.playerId;
    startIntro(s, { skip: true });
    const sim = createSimulation(s);
    for (let i = 0; i < 120; i++) await sim.step(10*(1), 0);
    assert(occupiedHomes(s).size > 0, "real villagers must have entered their homes");
    fs.writeFileSync(fixturePath, JSON.stringify({ ecs: s.ecs, days: s.days, space: s.space, playerId: s.ui.playerId, occupied: [...occupiedHomes(s)] }));
  }
  const fixture = JSON.parse(fs.readFileSync(fixturePath));
  const report = { phase, seed: 13, setup: "Two hours of real night simulation from 21:00; paused snapshot reused before/after. Observer reveals map. Dusk/noon change only the render clock.", occupied: fixture.occupied, frames: [], errors: [] };
  process.env.TMPDIR = path.join(out, "tmp"); fs.mkdirSync(process.env.TMPDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const [device, width, height] of [["desktop", 1440, 900], ["phone", 390, 664]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on("pageerror", e => report.errors.push(String(e)));
      page.on("console", m => { if (m.type() == "error" && !m.location().url.endsWith("favicon.ico")) report.errors.push(m.text()); });
      const baseline = path.join(out, "baseline");
      if (phase.startsWith("before") && fs.existsSync(baseline)) await page.route("http://localhost:8157/**", async route => {
        const file = path.join(baseline, new URL(route.request().url()).pathname.slice(1) || "index.html");
        if (fs.existsSync(file)) await route.fulfill({ path: file });
        else await route.continue();
      });
      await page.goto("http://localhost:8157/?seed=13&intro=skip&weather=clear");
      await page.waitForFunction(() => window.tinyking?.renderer, null, { timeout: 120000 });
      console.log(device, "seed 13 ready");
      await page.getByText("Start new game", { exact: true }).click();
      await page.getByRole("button", { name: "Start game", exact: true }).click();
      await page.waitForFunction(() => window.tinyking?.intro?.active === false);
      await page.evaluate(f => {
        const s = window.tinyking, count = Math.max(s.ecs.nextId, f.ecs.nextId);
        s.ui.actions.set_speed("paused");
        s.ecs = f.ecs; s.space = f.space; s.days = f.days; s.ui.playerId = f.playerId;
        s.redraws = Array.from({ length: count }, (_, i) => String(i));
        s.ui.actions.change_visibility({ character: false });
        s.renderer.showWholeMap();
      }, fixture);
      const scenes = [["camp-night", 23, "camp"], ["village-night", 23, "village"], ["camp-dusk", 20, "camp"], ["camp-day", 12, "camp"]];
      for (const [scene, hour, focus] of scenes.filter(([, hour]) => !process.argv.includes("--clock-only") || hour != 23)) {
        const info = await page.evaluate(({ hour, focus }) => {
          const s = window.tinyking;
          s.days = Math.floor(s.days) + hour / 24;
          s.ui.actions.end_turn();
          const id = focus == "camp" ? Object.keys(s.ecs.camp)[0] : Object.values(s.villages)[0].houses[1];
          s.renderer.focusOn(s.ecs.spatial[id], focus == "camp" ? 360 : 800);
          // Freeze visual animation at the same instant for matching captures.
          performance.now = () => 100000;
          s.renderer.frame();
          return { hour, focus: id, position: s.ecs.spatial[id], camera: s.renderer.camera.position.toArray(), metrics: s.renderer.metrics };
        }, { hour, focus });
        await page.waitForTimeout(300);
        const file = `${phase}-${device}-${scene}.png`;
        await page.screenshot({ path: path.join(out, file) });
        if (scene == "village-night") {
          info.timing = await page.evaluate(async () => {
            const s = window.tinyking, original = s.renderer.frame, clock = Date.now;
            const gl = document.querySelector("#world canvas").getContext("webgl2");
            const samples = [];
            return new Promise(resolve => {
              let warmup = 4;
              s.renderer.frame = () => {
                const start = clock(); original(); gl.finish();
                if (warmup-- > 0) return;
                samples.push(clock() - start);
                if (samples.length == 24) {
                  s.renderer.frame = original;
                  const sorted = [...samples].sort((a, b) => a - b);
                  resolve({ method: "renderer.frame + gl.finish, Date.now milliseconds, 4 warmup + 24 samples", samples, mean: samples.reduce((a, b) => a + b) / samples.length, median: (sorted[11] + sorted[12]) / 2, p95: sorted[22], metrics: s.renderer.metrics });
                }
              };
            });
          });
        }
        report.frames.push({ file, ...info });
        fs.writeFileSync(path.join(out, `${phase}.json`), JSON.stringify(report, null, 2));
        console.log(file, info.timing ? JSON.stringify(info.timing) : "captured");
      }
      await page.close();
    }
    assert.deepEqual(report.errors, []);
  } finally { fs.writeFileSync(path.join(out, `${phase}.json`), JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
