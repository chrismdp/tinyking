/* eslint-disable no-undef */
// Observe the browser's real clock/planners; never replace state or move people.
// Visibility and camera changes are labelled diagnostic in every capture.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");
const SHOTS = path.resolve(__dirname, "../shots");
const BASE = process.argv[2] || "http://localhost:8118/";

(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  });
  const errors = [];
  try {
    for (const [name, viewport, mobile] of [
      ["desktop", { width: 1440, height: 900 }, false],
      ["phone", { width: 390, height: 664 }, true]
    ]) {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      const url = new URL(BASE);
      url.searchParams.set("seed", "1"); url.searchParams.set("intro", "skip"); url.searchParams.set("weather", "clear");
      await page.goto(url.href);
      await page.waitForFunction(() => window.tinyking?.renderer, null, { timeout: 60000 });
      await page.evaluate(() => {
        const s = window.tinyking;
        s.ui.actions.start_game();
        s.ui.actions.change_visibility({ character: false, selected_person: null, main_menu: false });
        // Discovery affects drawing only. No game positions, needs or tasks change.
        s.ecs.playable[s.ui.playerId].known = Object.keys(s.ecs.mappable).map(id => {
          const p = s.ecs.spatial[id], x = Math.round(p.x / 90);
          return { x, y: Math.round(p.y / (60 * Math.sqrt(3)) - (x & 1) / 2) };
        });
        const label = document.createElement("div");
        label.textContent = "DIAGNOSTIC VISIBILITY · seed 1 · natural evening";
        label.style.cssText = "position:fixed;left:6px;bottom:6px;z-index:9999;background:#fffbe9;color:#231d13;font:11px sans-serif;padding:6px;pointer-events:none";
        document.body.appendChild(label);
        s.ui.actions.set_speed("fast");
        window.integrationStarted = performance.now();
        window.integrationWatch = setInterval(() => {
          const hour = s.days % 1 * 24;
          if (hour < 18 || hour >= 21) return;
          const groups = {};
          for (const id of Object.keys(s.ecs.personable)) {
            const planner = s.ecs.planner[id], target = planner?.world.target;
            if (s.ecs.personable[id].dead || planner?.task?.[0] != "wait_for" || !target?.id ||
              !["green", "alehouse"].includes(s.ecs.meetingPlace[target.id]?.kind)) continue;
            const at = s.ecs.spatial[id];
            if (Math.hypot(at.x - target.x, at.y - target.y) < 12) (groups[target.id] ||= []).push(id);
          }
          const best = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)[0];
          if (best?.[1].length >= 6) {
            s.ui.actions.set_speed("paused");
            clearInterval(window.integrationWatch);
            window.integrationGathering = { venue: best[0], people: best[1], days: s.days,
              realSeconds: (performance.now() - window.integrationStarted) / 1000 };
          }
        }, 100);
      });
      // Each wait yields within one second; all progress comes from game frames.
      const deadline = Date.now() + 240000;
      while (!await page.evaluate(() => !!window.integrationGathering)) {
        assert(Date.now() < deadline, "natural evening gathering must arrive within four minutes");
        await page.waitForTimeout(1000);
      }
      const record = await page.evaluate(() => {
        const s = window.tinyking, g = window.integrationGathering;
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const visitors = g.people.map(id => ({ id, ...s.ecs.spatial[id], size: s.ecs.personable[id].size,
          target: s.ecs.planner[id].world.target }));
        let minDistance = Infinity, minBodyClearance = Infinity, minHouseDistance = Infinity, penOverlaps = 0;
        for (let i = 0; i < visitors.length; i++) {
          const p = visitors[i];
          for (const other of visitors.slice(i + 1)) {
            const d = distance(p, other);
            minDistance = Math.min(minDistance, d);
            minBodyClearance = Math.min(minBodyClearance, d - (p.size + other.size) * 0.36);
          }
          for (const id of Object.keys(s.ecs.building)) minHouseDistance = Math.min(minHouseDistance, distance(p, s.ecs.spatial[id]));
          for (const pen of Object.values(s.ecs.pasture)) if (Math.abs(p.x - pen.centre.x) < pen.halfWidth + p.size * 0.36 &&
            Math.abs(p.y - pen.centre.y) < pen.halfDepth + p.size * 0.36) penOverlaps++;
        }
        s.renderer.focusOn(s.ecs.spatial[g.venue], 620);
        return { ...g, viewport: { width: innerWidth, height: innerHeight }, visitors,
          maxVenueDistance: Math.max(...visitors.map(p => distance(p, s.ecs.spatial[g.venue]))),
          minDistance, minBodyClearance, minHouseDistance, penOverlaps };
      });
      assert(record.maxVenueDistance < 300);
      assert(record.minBodyClearance > 0 && record.penOverlaps == 0);
      const collapse = page.getByRole("button", { name: "Collapse task list", exact: true });
      if (await collapse.count()) await collapse.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SHOTS, "integration-evening-" + name + ".png") });
      fs.writeFileSync(path.join(SHOTS, "integration-evening-" + name + ".json"), JSON.stringify(record, null, 2));
      console.log(JSON.stringify({ name, ...record }));
      if (!mobile) {
        await page.evaluate(() => window.tinyking.renderer.focusOn(window.tinyking.ecs.spatial[window.integrationGathering.venue], 1250));
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SHOTS, "integration-diagnostic-overview.png") });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log("PASS desktop and 390x664 touch phone; natural simulated evenings; separated bodies; no pen overlaps; no page errors");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
