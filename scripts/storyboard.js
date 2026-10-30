/* eslint-disable no-undef */
// Standard play review. Actions use the same UI commands as a player; state is
// read for frame metadata. No relationships, clock or simulation results are set.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const url = new URL(process.argv[2] || "http://localhost:8108/");
url.searchParams.set("seed", url.searchParams.get("seed") || "13");
url.searchParams.delete("intro");
const out = path.resolve(process.argv[3] || "shots/storyboard");
const story = { assistance: "Command-assisted: selection, orders and speed use public ui.actions. Chat, news and family controls are clicked. No state/results shortcuts.", url: url.href, actions: [], frames: [], errors: [] };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", e => story.errors.push(e.message));
    page.on("console", m => { if (m.type() == "error" && !m.location().url?.endsWith("favicon.ico")) story.errors.push(m.text()); });
    const frame = async label => {
      const file = String(story.frames.length + 1).padStart(2, "0") + "-" + label + ".png";
      const data = await page.evaluate(() => {
        const s = window.tinyking, player = s.ui.playerId, selected = s.ui.selected || s.ui.show.selected_person;
        const bond = s.ecs.relationships[selected]?.known[player];
        return { day: s.days, gameHours: s.days * 24, playerTasks: s.ecs.manager[player].jobs, hunger: s.ecs.personable[player].hunger,
          selected, ring: bond?.ring || "public", hint: document.querySelector(".feeling-line strong")?.textContent || null,
          latestEvents: (s.events || []).filter(e => e.day >= 0).slice(-5) };
      });
      await page.screenshot({ path: path.join(out, file) }); story.frames.push({ file, label, ...data });
      fs.writeFileSync(path.join(out, "story.json"), JSON.stringify(story, null, 2));
      console.log("FRAME " + file + " at " + data.gameHours.toFixed(2) + "h");
    };
    await page.goto(url.href);
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 60000 });
    await page.getByText("Start new game", { exact: true }).click();
    await page.locator(".character canvas").waitFor();
    await page.locator(".panel .close").first().click();
    await page.waitForFunction(() => window.tinyking.intro?.active);
    await frame("arrival");
    await page.waitForFunction(() => !window.tinyking.intro.active, null, { timeout: 30000 });
    story.actions.push("Watched the complete opening");
    const person = await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      const ids = Object.keys(s.ecs.personable).filter(id => id != s.ui.playerId && !s.ecs.personable[id].dead);
      const id = ids.sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y))[0];
      s.renderer.focusOn(s.ecs.spatial[id], 650); s.ui.actions.select_entity(id, false); return id;
    });
    await page.locator(".person-window").waitFor(); await frame("villager");
    await page.getByRole("button", { name: "Chat", exact: true }).click(); story.actions.push({ action: "Chat", person });
    await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      const tree = Object.keys(s.ecs.good).filter(id => s.ecs.good[id].type == "wood" && !s.ecs.haulable?.[id]).sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y))[0];
      const tile = Object.keys(s.ecs.mappable).filter(id => s.ecs.mappable[id].terrain == "grassland" && !s.ecs.mappable[id].villagePlot &&
        !s.ecs.building[id] && !(s.space[Object.keys(s.space).find(key => s.space[key].includes(id))] || []).some(other => s.ecs.camp?.[other] || s.ecs.farmable?.[other] || s.ecs.stockpile?.[other] || s.ecs.tree?.[other]) && Math.hypot(s.ecs.spatial[id].x - p.x, s.ecs.spatial[id].y - p.y) < 250).sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y))[0];
      s.ui.actions.choose_job(s.ui.playerId, { key: "cut_tree_down" }, tree);
      s.ui.actions.choose_job(s.ui.playerId, { key: "build_shelter" }, tile);
      if (!s.ecs.manager[s.ui.playerId].jobs.some(j => j.job.key == "build_shelter")) throw new Error("The lean-to order was not queued");
      s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.set_speed("fast");
    });
    story.actions.push("Queued chopping and a lean-to through normal order commands; set Fast");
    const start = await page.evaluate(() => window.tinyking.days);
    await frame("orders");
    for (let hours = 4; hours <= 24; hours += 4) {
      await page.waitForFunction(target => window.tinyking.days >= target, start + hours / 24, { timeout: 45000 });
      await frame("day-" + hours + "h");
    }
    await page.locator(".event-feed summary").click(); await frame("news");
    await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), person);
    await page.getByRole("button", { name: "Open family tree »" }).click(); await frame("family");
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.select_entity(s.ui.playerId, false); s.renderer.focusOn(s.ecs.spatial[s.ui.playerId], 650); });
    await frame("player");
    assert.equal(story.errors.length, 0, story.errors.join("\n"));
    console.log("PASS storyboard complete; no console errors");
  } finally {
    fs.writeFileSync(path.join(out, "story.json"), JSON.stringify(story, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
