/* eslint-disable no-undef */
// Observe real UI watch/skip sessions without changing game state or rendering.
// node scripts/intro-npc-label-shots.js http://localhost:8120/
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright-core");

const BASE = process.argv[2] || "http://localhost:8120/";
const SHOTS = path.resolve(__dirname, "../shots");

async function observe(page) {
  await page.evaluate(() => {
    const state = window.tinyking;
    const people = () => Object.keys(state.ecs.personable).map(id => {
      const object = state.renderer.objectOf(id);
      const point = state.renderer.screenPosition(id);
      return { id, player: id == state.ui.playerId, task: state.ecs.planner[id]?.task,
        sprites: object?.children.filter(c => c.isSprite).length,
        onScreen: !!object?.visible && point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight };
    });
    const frozen = () => JSON.stringify({ days: state.days, needs: state.ecs.personable,
      planners: state.ecs.planner, queues: state.ecs.manager,
      npcs: Object.fromEntries(Object.entries(state.ecs.spatial).filter(([id]) => state.ecs.personable[id] && id != state.ui.playerId)) });
    window.introLabelEvidence = new Promise(resolve => {
      let before, started;
      const frames = [];
      const sample = () => {
        if (!state.intro) return requestAnimationFrame(sample);
        if (started === undefined) {
          started = performance.now() / 1000 - state.intro.elapsed;
          before = frozen();
        }
        const frame = { elapsed: state.intro.elapsed, active: state.intro.active, pose: state.intro.pose,
          campCount: Object.keys(state.ecs.camp || {}).length, frozen: before == frozen(), people: people() };
        if (frame.active) {
          frames.push(frame);
          return requestAnimationFrame(sample);
        }
        const player = state.renderer.objectOf(state.ui.playerId);
        resolve({ frames, end: frame, seconds: performance.now() / 1000 - started,
          frozen: frames.every(f => f.frozen), steps: state.intro.tileIds.length - 1,
          carrying: player.getObjectByName("arrival-bundle").visible,
          bundle: !!state.renderer.objectOf(state.intro.campId).getObjectByName("arrival-bundle"),
          controls: state.ui.show.speed_controls, selected: state.ui.selected,
          jobs: state.ecs.manager[state.ui.playerId].jobs.length });
      };
      requestAnimationFrame(sample);
    });
  });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  try {
    for (const [device, method] of [["desktop", "watch"], ["phone", "watch"], ["desktop", "click"],
      ["phone", "touch"], ["desktop", "escape"], ["desktop", "url"], ["phone", "url"]]) {
      const phone = device == "phone";
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 664 } : { width: 1440, height: 900 },
        isMobile: phone, hasTouch: phone });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", e => errors.push(e.message));
        page.on("console", m => {
          if (m.type() == "error" && !m.location().url?.endsWith("/favicon.ico")) errors.push(m.text());
        });
        const url = new URL(BASE);
        url.searchParams.set("seed", "13");
        if (method == "url") url.searchParams.set("intro", "skip");
        else url.searchParams.delete("intro");
        await page.goto(url.href);
        await page.getByText("Start new game", { exact: true }).click({ timeout: 30000 });
        await page.waitForSelector(".character canvas");
        // Let initial terrain and shader work settle in character setup.
        await page.waitForTimeout(2000);
        await observe(page);
        await page.locator(".panel .close").first().click();
        const prefix = `fix-${device}-${method}`;
        if (method != "url") {
          await page.waitForFunction(() => window.tinyking.intro?.active && window.tinyking.intro.elapsed >= 1.2);
          assert.equal(await page.locator("#intro-skip").innerText(), phone ? "Tap to skip" : "Click to skip");
          assert.equal(await page.locator("#speed-controls").count(), 0);
          await page.screenshot({ path: path.join(SHOTS, `${prefix}-opening.png`) });
          assert(await page.evaluate(() => window.tinyking.intro.active), "Opening screenshot missed the cinematic");
          if (method == "watch") {
            await page.waitForFunction(() => window.tinyking.intro.elapsed >= 4.8);
            await page.screenshot({ path: path.join(SHOTS, `${prefix}-standing.png`) });
          }
          if (method == "click") await page.locator("#intro-skip").click();
          if (method == "touch") await page.locator("#intro-skip").tap();
          if (method == "escape") await page.keyboard.press("Escape");
        }
        const evidence = await page.evaluate(() => window.introLabelEvidence);
        // Save observations before assertions, so a failure keeps its evidence.
        fs.writeFileSync(path.join(SHOTS, `${prefix}.json`), JSON.stringify({ device, method, errors, ...evidence }, null, 2));
        await page.locator("#speed-controls").waitFor();
        await page.locator("#speed-controls button").first().click();
        await page.screenshot({ path: path.join(SHOTS, `${prefix}-handover.png`) });
        const { frames, end } = evidence;
        if (method != "url") {
          assert(frames.length > 0);
          assert(frames.every(f => f.campCount == 0 && f.people.every(p => p.sprites == 0)));
          assert(frames.some(f => f.people.some(p => !p.player && p.onScreen)), "No nearby NPC observed");
          assert(evidence.frozen, "Simulation changed before handover");
        }
        if (method == "watch") assert(evidence.seconds >= 4 && evidence.seconds <= 6);
        assert(end.people.every(p => p.sprites == 1), "An ordinary activity label did not return");
        assert(end.people.some(p => p.player && p.onScreen) && end.people.some(p => !p.player && p.onScreen));
        assert(end.campCount == 1 && end.pose == "standing" && evidence.steps == 2);
        assert(evidence.bundle && !evidence.carrying && evidence.controls && !evidence.selected && !evidence.jobs);
        assert.deepEqual(errors, []);
        console.log("PASS", prefix, JSON.stringify({ frames: frames.length, seconds: evidence.seconds,
          frozen: evidence.frozen, restoredLabels: end.people.length }));
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
