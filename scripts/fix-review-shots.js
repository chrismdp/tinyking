/* eslint-disable no-undef */
// Real UI orders on seed 13. State reads choose raycast-verified click targets;
// focusOn changes only the observer camera. No fixtures or game-state writes.
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const OUT = path.resolve(__dirname, "../shots");
const URL = process.argv[2] || "http://localhost:8117/";
const records = [];

async function run(browser, phone) {
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 664 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const label = phone ? "phone" : "desktop";
  const speed = async n => {
    const button = page.locator("#speed-controls button").nth(n);
    if (await button.isEnabled()) await button.click();
  };
  const focus = async (id, distance = 600, above = false) => {
    await page.evaluate(({ id, distance, above }) => {
      const s = window.tinyking, p = s.ecs.spatial[id];
      s.renderer.focusOn({ x: p.x, y: p.y + (above ? 150 : 0) }, distance);
    }, { id, distance, above });
    await page.waitForTimeout(700);
  };
  async function clickEntity(id) {
    const point = await page.evaluate(id => {
      const s = window.tinyking, at = s.ecs.spatial[id], canvas = document.querySelector("#world canvas");
      const camera = s.renderer.camera;
      const project = (x, y, z) => {
        const v = camera.matrixWorldInverse.elements, p = camera.projectionMatrix.elements, e = [x, y, z, 1];
        const view = [0, 1, 2, 3].map(r => v[r] * e[0] + v[4 + r] * e[1] + v[8 + r] * e[2] + v[12 + r]);
        const clip = [0, 1, 2, 3].map(r => p[r] * view[0] + p[4 + r] * view[1] + p[8 + r] * view[2] + p[12 + r] * view[3]);
        return { x: (clip[0] / clip[3] + 1) / 2 * canvas.clientWidth, y: (1 - clip[1] / clip[3]) / 2 * canvas.clientHeight };
      };
      const top = s.renderer.objectOf(id)?.userData.anchorHeight || 10;
      const candidates = s.ecs.mappable[id] ? [[0, 0], [30, 0], [15, 26], [-15, 26], [-30, 0], [-15, -26], [15, -26]].map(([dx, dy]) => project(at.x + dx, s.renderer.ground.heightAt(at.x + dx, at.y + dy) + 0.5, at.y + dy)) :
        [0.6, 0.3, 0.9].map(f => project(at.x, s.renderer.ground.heightAt(at.x, at.y) + top * f, at.y));
      for (const p of candidates) for (const dx of [0, -5, 5, -10, 10, -20, 20]) for (const dy of [0, -5, 5, -10, 10, -20, 20]) {
        const x = p.x + dx, y = p.y + dy;
        if (x > 10 && x < canvas.clientWidth - 10 && y > 60 && y < canvas.clientHeight - 80 && document.elementFromPoint(x, y) == canvas && s.renderer.pick(x, y) == id) return { x, y };
      }
      return null;
    }, id);
    if (!point) return false;
    if (phone) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(id => window.tinyking.ui.selected == id, id);
    return true;
  }
  async function order(id, button) {
    await focus(id);
    assert(await clickEntity(id), `Cannot pick ${id} for ${button}`);
    await page.getByRole("button", { name: button, exact: true }).click();
    console.log(label, "UI order", button, id);
  }
  async function capture(phase, id, extra = {}) {
    const focusId = phase == "delivered" ? await page.evaluate(() => Object.keys(window.tinyking.ecs.camp)[0]) : id;
    await focus(focusId, phase == "ownership" ? 350 : 600, phone && phase != "ownership");
    const filename = `fix-${label}-${phase}.png`;
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, filename) });
    const record = await page.evaluate(() => {
      const s = window.tinyking, id = s.ui.playerId;
      return { days: s.days, task: s.ecs.planner[id].task, jobs: s.ecs.manager[id].jobs,
        held: s.ecs.holder[id].held, panel: document.querySelector("#task-panel").innerText,
        popup: s.ui.selected ? document.querySelector(".popper").innerText : null,
        viewport: { width: innerWidth, height: innerHeight }, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    records.push({ label, phase, filename, ...extra, ...record });
    fs.writeFileSync(path.join(OUT, "fix-ui-observations.json"), JSON.stringify(records, null, 2));
    console.log(label, phase, JSON.stringify(record));
    assert(!record.overflow, "horizontal overflow");
    if (phase == "delivered") assert.equal(extra.deliveredLogs.length, 2, "Both harvested logs must be delivered");
  }
  try {
    await page.goto(URL + "?seed=13&intro=skip&weather=clear");
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 60000 });
    await page.getByText("Start new game", { exact: true }).click();
    await page.waitForSelector(".character canvas");
    if (phone) await page.getByRole("button", { name: "Start game", exact: true }).click();
    else await page.locator(".panel .close").click();
    await speed(0);
    const player = await page.evaluate(() => window.tinyking.ui.playerId);
    const trees = await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      return Object.keys(s.ecs.good).filter(id => s.ecs.good[id].type == "wood" && s.ecs.good[id].amount > 1 && !s.ecs.haulable?.[id] && s.renderer.objectOf(id)?.visible)
        .sort((a, b) => Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y) - Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y));
    });
    let tree;
    for (const id of trees) {
      await focus(id);
      if (await clickEntity(id)) {
        await page.getByRole("button", { name: "Cut down", exact: true }).click();
        tree = id; console.log(label, "UI order Cut down", tree); break;
      }
    }
    assert(tree, "Need a real, visible tree");
    await speed(1);
    await page.waitForFunction(() => {
      const s = window.tinyking;
      return s.ecs.planner[s.ui.playerId].task?.[0] == "chop_tree" && s.ecs.manager[s.ui.playerId].jobs[0].progress > 0.15;
    }, null, { timeout: 60000 });
    await speed(0);
    const expand = page.getByRole("button", { name: "Expand task list", exact: true });
    if (await expand.count()) await expand.click();
    await capture("chopping", player, { tree });
    await speed(1);
    await page.waitForFunction(() => {
      const s = window.tinyking, id = s.ui.playerId;
      return s.ecs.manager[id].jobs[0]?.gatheredDone && s.ecs.holder[id].held.length;
    }, null, { timeout: 60000 });
    await speed(0);
    await capture("carrying", player, { tree });
    await speed(2);
    await page.waitForFunction(() => {
      const s = window.tinyking, id = s.ui.playerId, j = s.ecs.manager[id].jobs[0];
      return j?.gatheredDone && j.gathered.length < j.gatheredTotal && j.gathered.length && !s.ecs.holder[id].held.length;
    }, null, { timeout: 120000 });
    await speed(0);
    await capture("collecting", player, { tree });
    await speed(2);
    await page.waitForFunction(() => {
      const s = window.tinyking;
      return !s.ecs.manager[s.ui.playerId].jobs.length;
    }, null, { timeout: 180000 });
    await speed(0);
    await capture("delivered", player, { tree, deliveredLogs: await page.evaluate(() => {
      const s = window.tinyking;
      return Object.keys(s.ecs.haulable).filter(id => s.ecs.good[id]?.type == "wood" && s.ecs.controllable[id].controllerId == s.ui.playerId && !s.ecs.haulable[id].heldBy);
    }) });
    const collapse = page.getByRole("button", { name: "Collapse task list", exact: true });
    if (phone && await collapse.count()) await collapse.click();
    // Discover the nearest household through real Move here orders on known tiles.
    const animal = await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      return Object.keys(s.ecs.animal).sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y))[0];
    });
    for (let n = 0; n < 15; n++) {
      if (await page.evaluate(id => window.tinyking.renderer.objectOf(id)?.visible, animal)) break;
      const target = await page.evaluate(animal => {
        const s = window.tinyking;
        const key = p => { const x = Math.round(p.x / 90); return x + "," + Math.round(p.y / (60 * Math.sqrt(3)) - (x & 1) / 2); };
        const tileAt = point => s.space[key(point)].find(id => s.ecs.walkable[id]);
        const start = tileAt(s.ecs.spatial[s.ui.playerId]), goal = tileAt(s.ecs.spatial[animal]);
        const parents = { [start]: null }, queue = [start];
        for (let i = 0; i < queue.length && !(goal in parents); i++) for (const next of Object.values(s.ecs.walkable[queue[i]].neighbours)) {
          if (!(next in parents)) { parents[next] = queue[i]; queue.push(next); }
        }
        if (!(goal in parents)) return null;
        const route = [];
        for (let at = goal; at; at = parents[at]) route.unshift(at);
        const known = new Set(s.ecs.playable[s.ui.playerId].known.map(p => p.x + "," + p.y));
        return route.filter(id => known.has(key(s.ecs.spatial[id])) && id != start).pop();
      }, animal);
      assert(target, "Known route must advance toward household");
      await order(target, "Move here");
      await speed(2);
      await page.waitForFunction(() => { const s = window.tinyking; return !s.ecs.manager[s.ui.playerId].jobs.length; }, null, { timeout: 120000 });
      await speed(0);
    }
    await focus(animal, 350);
    assert(await clickEntity(animal), "Animal must be picked through UI");
    await capture("ownership", animal, { animal });
    const ownership = records[records.length - 1].popup;
    assert(ownership.includes("Household:") && ownership.includes("Village:"));
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({ path: path.join(OUT, `fix-${label}-capture-failure.png`) });
    throw error;
  } finally { await context.close(); }
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
  try { await run(browser, false); await run(browser, true); } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
