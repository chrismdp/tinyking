/* eslint-disable no-undef */
// Record the real opening and verify mouse, touch, Escape and URL skipping.
// node scripts/intro-shots.js http://localhost:8104/
const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:8104/";
const SHOTS = path.resolve(__dirname, "../shots");

async function start(page, skip = false) {
  const url = new URL(BASE);
  url.searchParams.set("seed", "13");
  if (skip) url.searchParams.set("intro", "skip");
  else url.searchParams.delete("intro");
  await page.goto(url.href);
  await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText("Start new game", { exact: true }).click();
  await page.waitForSelector(".character canvas");
  await page.locator(".panel .close").first().click();
}

async function campState(page) {
  return page.evaluate(() => {
    const s = window.tinyking;
    const p = s.ecs.spatial[s.ui.playerId];
    const c = s.ecs.spatial[s.intro.campId];
    const player = s.renderer.objectOf(s.ui.playerId);
    const bundle = s.renderer.objectOf(s.intro.campId).getObjectByName("arrival-bundle");
    return { active: s.intro.active, sitting: s.intro.pose == "sitting", atCamp: Math.hypot(p.x - c.x, p.y - c.y) < 40,
      bundle: !!bundle, carrying: player.getObjectByName("arrival-bundle").visible, selected: !!s.ui.selected,
      jobs: s.ecs.manager[s.ui.playerId].jobs.length, controls: s.ui.show.speed_controls, days: s.days };
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 664 }, true], ["landscape", { width: 664, height: 390 }, true]]) {
      const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, recordVideo: { dir: SHOTS, size: viewport } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await start(page);
      const startDays = await page.evaluate(() => {
        // Observe the completion frame before normal simulation resumes. A
        // PNG can finish saving after control has already been handed over.
        window.introFinished = new Promise(resolve => {
          const watch = () => {
            const s = window.tinyking;
            if (s.intro.active) return requestAnimationFrame(watch);
            const p = s.ecs.spatial[s.ui.playerId];
            const c = s.ecs.spatial[s.intro.campId];
            resolve({ active: false, sitting: s.intro.pose == "sitting", atCamp: Math.hypot(p.x - c.x, p.y - c.y) < 40,
              bundle: !!s.renderer.objectOf(s.intro.campId).getObjectByName("arrival-bundle"),
              carrying: s.renderer.objectOf(s.ui.playerId).getObjectByName("arrival-bundle").visible,
              controls: s.ui.show.speed_controls, days: s.days, realSeconds: performance.now() / 1000 - window.introStarted });
          };
          requestAnimationFrame(watch);
        });
        window.introStarted = performance.now() / 1000 - window.tinyking.intro.elapsed;
        return window.tinyking.days;
      });
      assert.equal(await page.locator("#intro-skip").innerText(), touch ? "Tap to skip" : "Click to skip");
      assert.equal(await page.locator("#speed-controls").count(), 0);
      const captures = [["edge", 0.15], ["walking", 3.5], ["lowering", 7.25], ["put-down", 8.05], ["sitting", 9.85]];
      const metadata = [];
      for (const [label, elapsed] of captures) {
        await page.waitForFunction(t => window.tinyking.intro.elapsed >= t, elapsed);
        const snapshot = await page.evaluate(() => {
          const s = window.tinyking;
          const p = s.renderer.screenPosition(s.ui.playerId);
          const canvas = document.querySelector("#world canvas");
          return { seconds: s.intro.elapsed, phase: s.intro.phase, pose: s.intro.pose, screen: p,
            inFrame: p.x > 20 && p.x < canvas.clientWidth - 20 && p.y > 20 && p.y < canvas.clientHeight - 50 };
        });
        assert(snapshot.inFrame, name + " loses the traveller: " + JSON.stringify(snapshot));
        await page.screenshot({ path: path.join(SHOTS, `intro-${name}-${label}.png`) });
        metadata.push({ label, ...snapshot });
      }
      const end = await page.evaluate(() => window.introFinished);
      assert(end.atCamp && end.bundle && end.sitting && end.controls && !end.carrying);
      assert.equal(end.days, startDays);
      assert(end.realSeconds >= 8 && end.realSeconds <= 12);
      await page.locator("#speed-controls").waitFor();
      await page.locator("#speed-controls button").first().click();
      await page.waitForTimeout(1700);
      assert.equal((await campState(page)).sitting, false);
      await page.screenshot({ path: path.join(SHOTS, `intro-${name}-control.png`) });
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(SHOTS, `intro-${name}.json`), JSON.stringify({ viewport, touch, metadata, end }, null, 2));
      const video = page.video();
      await page.close();
      await context.close();
      fs.renameSync(await video.path(), path.join(SHOTS, `intro-${name}.webm`));
      console.log("PASS opening frames and handover", name, JSON.stringify(metadata));
    }
    for (const method of ["click", "touch", "escape", "url"]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: method == "touch", hasTouch: method == "touch" });
      const page = await context.newPage();
      await start(page, method == "url");
      if (method == "click") await page.mouse.click(195, 300);
      if (method == "touch") await page.touchscreen.tap(195, 300);
      if (method == "escape") await page.keyboard.press("Escape");
      await page.waitForFunction(() => !window.tinyking.intro.active);
      const end = await campState(page);
      assert(end.sitting && end.atCamp && end.bundle && end.controls && !end.selected && !end.jobs && !end.carrying, method + ": " + JSON.stringify(end));
      console.log("PASS skip", method, JSON.stringify(end));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
