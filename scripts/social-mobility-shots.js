/* eslint-disable no-undef */
// Supplemental discovery/layout evidence. State snapshots are real simulation
// output. Terrain/camera setup is diagnostic; every UI control below is clicked/tapped.
require("./game-register");
const fs = require("fs");
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const { askAbout } = require("../src/game/people");
const base = process.argv[2] || "http://localhost:8108/";
const input = process.env.SOCIAL_OUT || "shots/mobility-final";
const out = process.env.MOBILITY_SHOTS || "shots/mobility-ui";
fs.mkdirSync(out, { recursive: true });
const load = name => JSON.parse(fs.readFileSync(input + "/" + name, "utf8"));
const evidence = { setup: "Natural simulation snapshots; observer reveals terrain and focuses camera. Heard news separately uses a Social speaker and real Ask about. UI uses physical clicks/taps.", shots: [], layout: [], errors: [] };
(async () => {
  const travelling = load("mobility-travelling-state.json"), travellingMeta = load("mobility-travelling-meta.json");
  const visit = load("mobility-visit-state.json"), visitMeta = load("mobility-visit-meta.json");
  const move = load("mobility-move-state.json"), moveMeta = load("mobility-move-meta.json");
  const heard = structuredClone(move), player = Object.keys(heard.ecs.playable)[0], person = moveMeta.people[0];
  const speaker = moveMeta.people[1];
  heard.ecs.relationships[speaker].known[player] = { ring: "social", goodwill: 16, base: 16 };
  assert(askAbout(heard, player, speaker, person).ok);
  evidence.person = person; evidence.speaker = speaker; evidence.visit = visitMeta; evidence.move = moveMeta;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const phone of [false, true]) {
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 664 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
      const page = await context.newPage();
      page.on("pageerror", e => evidence.errors.push(e.stack || e.message));
      page.on("console", m => { if (m.type() == "error" && !m.location().url?.endsWith("favicon.ico")) evidence.errors.push(m.text()); });
      const press = locator => phone ? locator.tap() : locator.click();
      await page.goto(base + "?seed=20&intro=skip");
      await page.waitForFunction(() => window.tinyking?.renderer, null, { timeout: 60000 });
      const install = async (snapshot, focus) => {
        await page.evaluate(({ snapshot, focus }) => {
          const s = window.tinyking, before = Object.keys(s.ecs.spatial);
          Object.assign(s, snapshot); s.game_speed = "paused"; s.intro = null;
          s.ui.playerId = Object.keys(s.ecs.playable)[0];
          s.ecs.playable[s.ui.playerId].known = Object.keys(s.ecs.mappable).map(id => {
            const p = s.ecs.spatial[id], x = Math.round(p.x / 90); return { x, y: Math.round(p.y / (60 * Math.sqrt(3)) - (x & 1) / 2) };
          });
          s.redraws = [...new Set([...before, ...Object.keys(s.ecs.spatial)])];
          s.ui.actions.change_visibility({ selected_person: null, character: false, main_menu: false, info: null, clock: true, speed_controls: true });
          s.renderer.focusOn(s.ecs.spatial[focus], 650);
        }, { snapshot, focus });
        await page.waitForTimeout(1200);
      };
      const shot = async label => {
        const file = out + "/" + label + (phone ? "-phone" : "-desktop") + ".png";
        await page.screenshot({ path: file }); evidence.shots.push(file);
      };
      const layout = async label => {
        const data = await page.evaluate(() => {
          const bounds = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          const panel = document.querySelector(".people-sheet") || document.querySelector("#task-panel");
          const feed = document.querySelector(".event-feed"), speed = document.querySelector("#speed-controls");
          const a = bounds(panel), b = bounds(feed), c = bounds(speed);
          const intersects = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
          return { panel: a, feed: b, speed: c, overlap: intersects(a, b), speedOverlap: intersects(b, c), scrollable: feed.querySelector(".event-entries").scrollHeight >= feed.querySelector(".event-entries").clientHeight };
        });
        evidence.layout.push({ phone, label, ...data });
        assert(!data.overlap, label + ": news overlaps panel"); assert(!data.speedOverlap, label + ": news overlaps speed");
      };
      await install(travelling, travellingMeta.id); await shot("travelling");
      await install(visit, visitMeta.people[0]); await layout("collapsed"); await shot("visit-collapsed");
      const mapClick = await page.evaluate(id => {
        const s = window.tinyking, p = s.renderer.screenPosition(id), canvas = document.querySelector("#world canvas");
        // Read-only hit discovery. Selection itself must go through the canvas.
        for (let dy = -35; dy <= 35; dy += 5) for (let dx = -15; dx <= 15; dx += 5) {
          const x = p.x + dx, y = p.y + dy;
          if (s.renderer.pick(x, y) == id && document.elementFromPoint(x, y) == canvas) return { x, y };
        }
        return null;
      }, visitMeta.people[0]);
      assert(mapClick, "visitor must have a discoverable map target");
      if (phone) await page.touchscreen.tap(mapClick.x, mapClick.y); else await page.mouse.click(mapClick.x, mapClick.y);
      await page.locator(".person-window").waitFor(); await shot("visit-selected");
      await press(page.locator(".person-window .sheet-close"));
      // Physical discovery of task expansion, news disclosure and accessible speed buttons.
      await press(page.getByRole("button", { name: phone ? "Expand task list" : "Collapse task list", exact: true }));
      await press(page.locator(".event-feed summary")); await layout("tasks-news-expanded"); await shot("visit-expanded");
      await press(page.getByRole("button", { name: "Normal speed", exact: true }));
      await press(page.getByRole("button", { name: "Pause", exact: true }));
      await press(page.locator(".event-feed summary"));
      await install(heard, person);
      await press(page.locator(".event-feed summary"));
      const news = page.locator(".event-entries button").filter({ hasText: "married" }).first();
      await news.scrollIntoViewIfNeeded(); await press(news);
      await page.locator(".person-window").waitFor(); await layout("person-news-expanded"); await shot("remembered-move");
      await press(page.locator(".event-feed summary"));
      await press(page.getByRole("button", { name: "Open family tree »" }));
      await shot("family-link");
      await context.close();
    }
    assert.equal(evidence.errors.length, 0, evidence.errors.join("\n"));
    console.log("PASS physical disclosure, selectable remembered marriage, family link and non-overlapping desktop/phone news; " + evidence.shots.length + " screenshots");
  } finally { fs.writeFileSync(out + "/evidence.json", JSON.stringify(evidence, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
