/* eslint-disable no-undef */
// Targeted real-time opening capture; no planner, need, position or timing edits.
// node scripts/intro-label-shots.js http://localhost:8118/ before|after
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");
const BASE = process.argv[2] || "http://localhost:8118/";
const MODE = process.argv[3] || "after";
const SHOTS = path.resolve(__dirname, "../shots");
const CAPTURES = [["walking", 1.4], ["lowering", 3.1], ["put-down", 3.72], ["standing", 5.05]];

async function start(page, method) {
  const url = new URL(BASE);
  url.searchParams.set("seed", "13");
  url.searchParams.set("weather", "clear");
  if (method == "url") url.searchParams.set("intro", "skip");
  await page.goto(url.href);
  await page.getByText("Start new game", { exact: true }).click();
  await page.waitForSelector(".character canvas");
  // Let initial terrain/shader work settle before starting the real-time shot.
  await page.waitForTimeout(2000);
  await page.evaluate(({ captures, method }) => {
    const s = window.tinyking;
    const canvas = document.querySelector("#world canvas");
    const snapshot = () => {
      const object = s.renderer.objectOf(s.ui.playerId);
      const bundle = object.getObjectByName("arrival-bundle");
      return { elapsed: s.intro.elapsed, active: s.intro.active, pose: s.intro.pose,
        task: s.ecs.planner[s.ui.playerId].task || null,
        labels: object.children.filter(c => c.isSprite).map(c => c.material.map.image.dataset.introLabel),
        carrying: !!bundle?.visible, seated: !!object.getObjectByName("seated-figure"),
        campBundle: !!s.renderer.objectOf(s.intro.campId)?.getObjectByName("arrival-bundle") };
    };
    const original = s.ui.actions.start_game;
    window.introLabelsFinished = new Promise(resolve => {
      s.ui.actions.start_game = () => {
        original();
        const days = s.days;
        const needs = JSON.stringify(s.ecs.personable);
        const started = performance.now();
        const frames = [];
        let finished = false;
        const finish = () => {
          finished = true;
          s.renderer.frame();
          resolve({ frames, end: { ...snapshot(), frozen: days == s.days && needs == JSON.stringify(s.ecs.personable),
            realSeconds: (performance.now() - started) / 1000, controls: s.ui.show.speed_controls,
            png: canvas.toDataURL("image/png") } });
        };
        const skip = s.ui.actions.skip_intro;
        s.ui.actions.skip_intro = () => { skip(); finish(); };
        const watch = () => {
          if (finished) return;
          const next = captures[frames.length];
          if (method == "watch" && next && s.intro.elapsed >= next[1]) {
            s.renderer.frame();
            frames.push({ name: next[0], target: next[1], ...snapshot(), png: canvas.toDataURL("image/png") });
          }
          if (s.intro.active) return requestAnimationFrame(watch);
          finish();
        };
        watch();
      };
    });
  }, { captures: CAPTURES, method });
  await page.locator(".panel .close").first().click();
  if (method == "click") await page.mouse.click(195, 300);
  if (method == "touch") await page.touchscreen.tap(195, 300);
  if (method == "escape") await page.keyboard.press("Escape");
}

(async () => {
  assert(["before", "after"].includes(MODE));
  const browser = await chromium.launch({
    executablePath: "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  });
  const errors = [];
  try {
    for (const [name, viewport, touch, methods] of [
      ["desktop", { width: 1440, height: 900 }, false, ["watch", "click", "escape", "url"]],
      ["phone", { width: 390, height: 664 }, true, ["watch", "touch", "url"]]
    ]) {
      const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
      // Observe the actual label texture text without changing its rendering.
      await context.addInitScript(() => {
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
          this.canvas.dataset.introLabel = text;
          return original.call(this, text, ...args);
        };
      });
      for (const method of MODE == "before" ? ["watch"] : methods) {
        const page = await context.newPage();
        page.on("pageerror", e => errors.push(e.message));
        page.on("console", m => {
          if (m.type() == "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text());
        });
        await start(page, method);
        const record = await page.evaluate(() => window.introLabelsFinished);
        const save = (frame, suffix) => {
          fs.writeFileSync(path.join(SHOTS, `intro-label-${MODE}-${name}-${method}-${suffix}.png`), Buffer.from(frame.png.split(",")[1], "base64"));
          delete frame.png;
        };
        for (const frame of record.frames) save(frame, frame.name);
        save(record.end, "handover");
        fs.writeFileSync(path.join(SHOTS, `intro-label-${MODE}-${name}-${method}.json`), JSON.stringify(record, null, 2));
        if (method == "watch") {
          assert.equal(record.frames.length, CAPTURES.length);
          for (const frame of record.frames) {
            assert(frame.elapsed < frame.target + 0.3, "missed " + frame.name);
            assert.deepEqual(frame.labels, MODE == "before" ? ["Idle"] : []);
            assert.equal(frame.carrying, frame.name == "walking" || frame.name == "lowering");
            assert.equal(frame.seated, false);
          }
          assert(record.end.realSeconds >= 4 && record.end.realSeconds <= 6);
        }
        assert(record.end.frozen && record.end.controls && record.end.campBundle);
        assert.equal(record.end.active, false);
        assert.equal(record.end.pose, "standing");
        assert.equal(record.end.carrying, false);
        assert.equal(record.end.seated, false);
        assert.deepEqual(record.end.labels, ["Idle"]);
        console.log("PASS", MODE, name, method, JSON.stringify(record));
        await page.close();
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${MODE == "before" ? 2 : 7} watched/skipped openings; 8 cinematic frames; carrying/put-down; immediate ordinary labels; no sitting; no console errors`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
