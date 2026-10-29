/* eslint-disable no-undef */
// Record real opening frames and verify mouse, touch, Escape and URL skipping.
// node scripts/intro-shots.js http://localhost:8105/
const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:8105/";
const SHOTS = path.resolve(__dirname, "../shots");
const CAPTURES = [["edge", 0], ["walking", 1.4], ["lowering", 3.1], ["put-down", 3.72], ["fire", 4.1], ["bedroll", 4.55], ["standing", 5.05]];

async function start(page, skip = false, record = false) {
  const url = new URL(BASE);
  url.searchParams.set("seed", "13");
  if (skip) url.searchParams.set("intro", "skip");
  else url.searchParams.delete("intro");
  await page.goto(url.href);
  await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText("Start new game", { exact: true }).click();
  await page.waitForSelector(".character canvas");
  if (record) await page.evaluate(captures => {
    const s = window.tinyking;
    const canvas = document.querySelector("#world canvas");
    const original = s.ui.actions.start_game;
    window.introFinished = new Promise(resolve => {
      s.ui.actions.start_game = () => {
        original();
        const started = performance.now() / 1000;
        const days = s.days;
        const frames = [];
        const project = point => {
          const v = s.renderer.camera.matrixWorldInverse.elements;
          const m = s.renderer.camera.projectionMatrix.elements;
          const xyz = [point.x, s.renderer.ground.heightAt(point.x, point.y) + 20, point.y, 1];
          const view = [0, 1, 2, 3].map(r => v[r] * xyz[0] + v[4 + r] * xyz[1] + v[8 + r] * xyz[2] + v[12 + r]);
          const clip = [0, 1, 2, 3].map(r => m[r] * view[0] + m[4 + r] * view[1] + m[8 + r] * view[2] + m[12 + r] * view[3]);
          return { x: (clip[0] / clip[3] + 1) / 2 * canvas.clientWidth, y: (1 - clip[1] / clip[3]) / 2 * canvas.clientHeight };
        };
        const watch = () => {
          const next = captures[frames.length];
          if (next && s.intro.elapsed >= next[1]) {
            // Read the WebGL buffer in the same frame it was drawn. Saving a
            // Playwright screenshot between stages can miss the next stage.
            s.renderer.frame();
            const p = s.renderer.screenPosition(s.ui.playerId);
            const framed = [p, project(s.intro.points[0]), project(s.intro.campPoint)];
            frames.push({ label: next[0], target: next[1], seconds: s.intro.elapsed,
              phase: s.intro.phase, pose: s.intro.pose, putDown: s.intro.putDown,
              fire: s.intro.fire, bedroll: s.intro.bedroll, campCount: Object.keys(s.ecs.camp || {}).length,
              inFrame: framed.every(p => p.x > 20 && p.x < canvas.clientWidth - 20 && p.y > 20 && p.y < canvas.clientHeight - 50),
              png: canvas.toDataURL("image/png") });
          }
          if (s.intro.active) return requestAnimationFrame(watch);
          const p = s.ecs.spatial[s.ui.playerId];
          const c = s.ecs.spatial[s.intro.campId];
          resolve({ frames, end: { standing: s.intro.pose == "standing", atCamp: Math.hypot(p.x - c.x, p.y - c.y) < 40,
            bundle: !!s.renderer.objectOf(s.intro.campId).getObjectByName("arrival-bundle"),
            carrying: s.renderer.objectOf(s.ui.playerId).getObjectByName("arrival-bundle").visible,
            controls: s.ui.show.speed_controls, frozen: s.days == days, realSeconds: performance.now() / 1000 - started } });
        };
        watch();
      };
    });
  }, CAPTURES);
  await page.locator(".panel .close").first().click();
}

async function campState(page) {
  return page.evaluate(() => {
    const s = window.tinyking;
    const p = s.ecs.spatial[s.ui.playerId];
    const c = s.ecs.spatial[s.intro.campId];
    return { active: s.intro.active, standing: s.intro.pose == "standing", atCamp: Math.hypot(p.x - c.x, p.y - c.y) < 40,
      bundle: !!s.renderer.objectOf(s.intro.campId).getObjectByName("arrival-bundle"),
      carrying: s.renderer.objectOf(s.ui.playerId).getObjectByName("arrival-bundle").visible,
      selected: !!s.ui.selected, jobs: s.ecs.manager[s.ui.playerId].jobs.length, controls: s.ui.show.speed_controls };
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const [name, viewport, touch] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 664 }, true]]) {
      console.log("Recording opening", name);
      const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, recordVideo: { dir: SHOTS, size: viewport } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await start(page, false, true);
      assert.equal(await page.locator("#intro-skip").innerText(), touch ? "Tap to skip" : "Click to skip");
      assert.equal(await page.locator("#speed-controls").count(), 0);
      const { frames, end } = await page.evaluate(() => window.introFinished);
      assert.equal(frames.length, CAPTURES.length);
      for (const frame of frames) {
        assert(frame.inFrame, name + " loses the entry, traveller or camp: " + JSON.stringify({ ...frame, png: undefined }));
        assert(frame.seconds < frame.target + 0.3, "Missed " + frame.label + " at " + frame.seconds);
        assert.equal(frame.campCount, 0);
        fs.writeFileSync(path.join(SHOTS, `intro-${name}-${frame.label}.png`), Buffer.from(frame.png.split(",")[1], "base64"));
        delete frame.png;
      }
      assert(end.atCamp && end.bundle && end.standing && end.controls && !end.carrying && end.frozen);
      assert(end.realSeconds >= 4 && end.realSeconds <= 6);
      await page.locator("#speed-controls").waitFor();
      await page.locator("#speed-controls button").first().click();
      await page.screenshot({ path: path.join(SHOTS, `intro-${name}-control.png`) });
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(SHOTS, `intro-${name}.json`), JSON.stringify({ viewport, touch, frames, end }, null, 2));
      const video = page.video();
      await page.close();
      await context.close();
      const webm = path.join(SHOTS, `intro-${name}.webm`);
      fs.renameSync(await video.path(), webm);
      execFileSync(process.env.FFMPEG || "ffmpeg", ["-y", "-i", webm, "-an", "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(SHOTS, `intro-${name}.mp4`)], { stdio: "ignore" });
      console.log("PASS opening frames, video and handover", name, JSON.stringify({ frames, end }));
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
      assert(end.standing && end.atCamp && end.bundle && end.controls && !end.selected && !end.jobs && !end.carrying, method + ": " + JSON.stringify(end));
      console.log("PASS skip", method, JSON.stringify(end));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
