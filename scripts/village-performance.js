/* eslint-disable no-undef */
// Compare the same seed, camera, resolution and paused time before/after village life.
// --baseline serves the current branch's original bundle from shots/baseline/dist.
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ executablePath: "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  if (process.argv.includes("--baseline")) await page.route("**/*", async route => {
    const file = path.resolve(__dirname, "../shots/baseline/dist", new URL(route.request().url()).pathname.slice(1) || "index.html");
    if (fs.existsSync(file) && fs.statSync(file).isFile()) await route.fulfill({ path: file });
    else await route.abort();
  });
  await page.addInitScript(() => {
    window.drawStats = { calls: 0, triangles: 0 };
    for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
      const prototype = WebGL2RenderingContext.prototype, original = prototype[name];
      prototype[name] = function(...args) {
        window.drawStats.calls++;
        if (args[0] == 4) window.drawStats.triangles += args[name.startsWith("drawElements") ? 1 : 2] / 3 * (name.endsWith("Instanced") ? (name.startsWith("drawElements") ? args[4] : args[3]) : 1);
        return original.apply(this, args);
      };
    }
  });
  try {
    await page.goto("http://localhost:8106/?seed=20&intro=skip&weather=clear");
    await page.waitForFunction(() => window.tinyking?.renderer, null, { timeout: 60000 });
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.start_game(); s.game_speed = "paused"; s.ui.actions.change_visibility({ character: false }); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.tinyking.renderer.showWholeMap());
    await page.waitForTimeout(2000);
    const measure = () => page.evaluate(() => {
      window.drawStats = { calls: 0, triangles: 0 }; window.tinyking.renderer.frame();
      return { ...window.drawStats };
    });
    const wholeMap = await measure();
    const house = await page.evaluate(() => Object.values(window.tinyking.villages)[0].houses[1]);
    for (let i = 0; i < 3; i++) {
      const p = await page.evaluate(id => window.tinyking.renderer.screenPosition(id), house);
      await page.mouse.move(720, 550); await page.mouse.down({ button: "middle" });
      await page.mouse.move(720 + Math.max(-400, Math.min(400, 720 - p.x)), 550 + Math.max(-250, Math.min(250, 450 - p.y)), { steps: 10 });
      await page.mouse.up({ button: "middle" }); await page.waitForTimeout(150);
    }
    const distance = (22 * 60 * Math.sqrt(3) + 240) / Math.tan(20 * Math.PI / 180);
    await page.mouse.move(720, 450); await page.mouse.wheel(0, Math.log(1000 / distance) / 0.0012); await page.waitForTimeout(300);
    await page.mouse.move(900, 650); await page.mouse.down({ button: "right" }); await page.mouse.move(900, 520, { steps: 10 }); await page.mouse.up({ button: "right" });
    await page.waitForTimeout(1000);
    const village = await measure();
    const entities = await page.evaluate(() => {
      const e = window.tinyking.ecs;
      return Object.fromEntries(["mappable", "personable", "building", "farmable", "animal", "workplace"].map(k => [k, Object.keys(e[k] || {}).length]));
    });
    console.log(JSON.stringify({ seed: 20, viewport: "1440x900", wholeMap, village, entities }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
