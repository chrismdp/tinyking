/* eslint-disable no-undef */
// Diagnostic review captures from unmodified real simulation snapshots.
// Revealing terrain and camera/panel selection are observer setup. The heard-news
// fixture gives a speaker Social trust, then runs the real Ask about function.
require("./game-register");
const fs = require("fs");
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const { askAbout } = require("../src/game/people");
const { knownEvents } = require("../src/game/events");
const base = process.argv[2] || "http://localhost:8108/";
const load = file => JSON.parse(fs.readFileSync((process.env.SOCIAL_OUT || "shots") + "/" + file, "utf8"));
(async () => {
  const evening = load("social-evening-state.json"), wedding = load("social-wedding-state.json"), meta = load("social-evening-meta.json");
  assert(evening.opinionThresholds && wedding.opinionThresholds, "Run social-check with the current snapshot format first");
  const player = Object.keys(evening.ecs.playable)[0];
  const heirloom = Object.values(evening.ecs.possession).find(p => p.kind == "heirloom" && p.ownerId && !evening.ecs.personable[p.ownerId].dead && p.owners.length > 1);
  assert(heirloom, "a living person must own an inherited heirloom");
  const owner = heirloom.ownerId;
  const speaker = Object.keys(evening.ecs.personable).find(id => id != owner && id != player && !evening.ecs.personable[id].dead && evening.ecs.relationships[id].known[owner] && knownEvents(evening, id, owner).length);
  assert(speaker, "someone must know this person's history");
  const news = structuredClone(evening);
  news.ecs.relationships[speaker].known[player] = { ring: "social", goodwill: 16, base: 16 };
  assert(askAbout(news, player, speaker, owner).ok);
  const browser = await chromium.launch({ executablePath: "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const evidence = { diagnosticSetup: ["Real snapshots from scripts/social-check.js, no NPC position or relationship edits for the evening or wedding", "Observer reveals terrain and uses camera/panels", "For heard news only: speaker granted Social trust, then real Ask about called"], owner, speaker, heirloom: heirloom.id, meta, screenshots: [], errors: [] };
  try {
    for (const phone of [false, true]) {
      const context = await browser.newContext({ viewport: phone ? { width: 390, height: 664 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
      const page = await context.newPage(); page.on("pageerror", e => evidence.errors.push(e.stack || e.message));
      page.on("console", m => { if (m.type() == "error" && !m.location().url?.endsWith("favicon.ico")) evidence.errors.push(m.text()); });
      await page.goto(base + "?seed=20&intro=skip");
      await page.waitForFunction(() => window.tinyking?.renderer, null, { timeout: 60000 });
      const install = async snapshot => {
        await page.evaluate(snapshot => {
          const s = window.tinyking, old = Object.keys(s.ecs.spatial);
          Object.assign(s, snapshot); s.game_speed = "paused"; s.intro = null;
          s.ui.playerId = Object.keys(s.ecs.playable)[0];
          s.ecs.playable[s.ui.playerId].known = Object.keys(s.ecs.mappable).map(id => {
            const p = s.ecs.spatial[id], x = Math.round(p.x / 90); return { x, y: Math.round(p.y / (60 * Math.sqrt(3)) - (x & 1) / 2) };
          });
          s.redraws = [...new Set([...old, ...Object.keys(s.ecs.spatial)])];
          s.ui.actions.change_visibility({ selected_person: null, character: false, main_menu: false, info: null, clock: true, speed_controls: true });
        }, snapshot);
        await page.waitForTimeout(1200);
      };
      const focus = async (id, distance = 650) => page.evaluate(({ id, distance }) => { const s = window.tinyking; s.renderer.focusOn(s.ecs.spatial[id], distance); }, { id, distance });
      const shot = async label => { await page.waitForTimeout(800); const file = "shots/social-" + label + (phone ? "-phone" : "-desktop") + ".png"; await page.screenshot({ path: file }); evidence.screenshots.push(file); };
      await install(evening);
      const green = evening.villages[meta.village].sharedPlaces.find(id => evening.ecs.meetingPlace[id].kind == "green");
      await focus(green); await shot("evening");
      await install(wedding); await focus(wedding.events.filter(e => e.type == "marriage" && e.day >= 0).at(-1).people[0]);
      await page.locator(".event-feed summary").click(); await shot("wedding");
      await page.locator(".event-feed summary").click();
      await install(news); await focus(owner);
      await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), owner);
      await page.locator(".heard-events").scrollIntoViewIfNeeded(); await shot("heard");
      await page.getByRole("button", { name: "Open family tree »" }).click();
      await shot("ancestors");
      await page.getByRole("button", { name: "Close family tree", exact: true }).click();
      await page.locator(".possessions details").filter({ hasText: heirloom.name }).locator("summary").click();
      await page.locator(".possessions").scrollIntoViewIfNeeded(); await shot("heirloom");
      await context.close();
    }
    assert.equal(evidence.errors.length, 0, evidence.errors.join("\n"));
    console.log(JSON.stringify(evidence, null, 2));
  } finally { fs.writeFileSync("shots/social-screenshots.json", JSON.stringify(evidence, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
