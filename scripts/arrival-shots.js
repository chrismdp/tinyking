/* eslint-disable no-undef */
// Capture real planner snapshots at desktop and touch-phone sizes.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright-core");
require("./game-register");
const { startIntro } = require("../src/game/intro");
const { generateMap, Hex } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { enqueueTask } = require("../src/game/manager");
const { placeShelter } = require("../src/game/construction");
const { newEntities } = require("../src/game/entities");
const URL = process.argv[2] || "http://localhost:8101/";
const SHOTS = path.resolve(__dirname, "../shots");

async function snapshots() {
  const state = { ecs: { nextId: 1 }, days: 0.375, ui: { show: {} }, redraws: [], game_speed: "fast" };
  const result = await generateMap(state, 13, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  startIntro(state, { skip: true });
  const player = result.playerId;
  const save = () => JSON.parse(JSON.stringify({ ecs: state.ecs, days: state.days, space: state.space, map: state.map, villages: state.villages }));
  const shots = { camp: save() };
  const start = Hex(state.map.playerStartTile);
  const tree = Object.keys(state.ecs.tree).find(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) <= 4);
  const bush = Object.keys(state.ecs.forageable).find(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) <= 2);
  const tile = Object.keys(state.ecs.mappable).find(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) == 1 && state.space[Hex().fromPoint(state.ecs.spatial[id])].length == 1);
  enqueueTask(state, { key: "cut_tree_down" }, tree);
  enqueueTask(state, { key: "forage" }, bush);
  const site = placeShelter(state, tile);
  enqueueTask(state, { key: "build_shelter" }, site);
  shots.tasks = save();
  // Fixture timber only: actors still walk, deliver and do all construction work.
  const camp = Object.keys(state.ecs.camp)[0];
  newEntities(state, Array.from({ length: 14 }, () => ({ spatial: { ...state.ecs.spatial[camp], immovable: false },
    haulable: {}, good: { type: "wood", amount: 1 }, controllable: { controllerId: player } })));
  const sim = createSimulation(state);
  for (let n = 0; n < 3000 && !shots.hut; n++) {
    sim.step(1);
    if (!shots.construction && state.ecs.construction[site]?.delivered >= 2) shots.construction = save();
    if (!shots["lean-to"] && state.ecs.shelter[site].stage == "lean-to") {
      shots["lean-to"] = save();
      placeShelter(state, site);
      enqueueTask(state, { key: "build_shelter" }, site);
    }
    if (state.ecs.shelter[site].stage == "hut") shots.hut = save();
  }
  if (!shots.hut) throw new Error("Snapshot planner did not finish the hut");
  state.ecs.personable[player].hunger = 1.3;
  shots.hunger = save();
  return { shots, player, site, camp };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { shots, player, camp } = await snapshots();
  const browser = await chromium.launch({ executablePath: path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const phone of (process.env.PHONE_ONLY ? [true] : [false, true])) {
    const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(URL + "?seed=13");
    await page.waitForTimeout(8000);
    await page.getByText("Start new game").first().click();
    await page.waitForSelector(".character canvas");
    await page.screenshot({ path: path.join(SHOTS, phone ? "phone-new-game.png" : "desktop-new-game.png") });
    await page.locator(".panel .close").click();
    await page.locator("#speed-controls button").first().click();
    for (const [label, snapshot] of Object.entries(shots)) {
      await page.evaluate(({ snapshot, player }) => {
        const state = window.tinyking;
        Object.assign(state, snapshot);
        state.ui.playerId = player;
        state.game_speed = "paused";
        state.redraws = Array.from({ length: state.ecs.nextId - 1 }, (_, i) => "" + (i + 1));
        state.ui.actions.change_visibility({ selected_person: player });
      }, { snapshot, player });
      if (phone && label == "tasks") await page.getByRole("button", { name: "Expand task list" }).click();
      if (phone && label == "construction") await page.getByRole("button", { name: "Collapse task list" }).click();
      if (phone && label == "hunger") await page.getByRole("button", { name: "Expand task list" }).click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SHOTS, `${phone ? "phone" : "desktop"}-${label}.png`) });
      // Every rendered interactive control on the phone must be touch-sized.
      if (phone) {
        const tiny = await page.locator("#task-panel button, #speed-controls button").evaluateAll(buttons => buttons.filter(b => {
          const r = b.getBoundingClientRect();
          return r.width && r.height && (r.width < 44 || r.height < 44);
        }).map(b => b.getAttribute("aria-label") || b.textContent));
        if (tiny.length) throw new Error("Tiny phone targets: " + tiny.join(", "));
      }
      console.log("captured", phone ? "phone" : "desktop", label);
    }
    if (phone) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SHOTS, "phone-landscape.png") });
      await page.getByRole("button", { name: "Collapse task list" }).click();
      // A touch tap uses the camera module's selection path.
      const at = await page.evaluate(id => {
        const s = window.tinyking;
        const p = s.renderer.screenPosition(id);
        const canvas = document.querySelector("#world canvas");
        return [[0, 0], [0, 15], [15, 15], [-15, 15], [0, 30]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
          .find(p => document.elementFromPoint(p.x, p.y) == canvas && s.renderer.pick(p.x, p.y));
      }, camp);
      if (!at) throw new Error("No visible canvas target by camp for touch check");
      const queuedBeforeTap = await page.evaluate(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length);
      await page.touchscreen.tap(at.x, at.y);
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".popper")).visibility == "visible", null, { timeout: 5000 });
      const queuedAfterTap = await page.evaluate(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length);
      if (queuedAfterTap != queuedBeforeTap) throw new Error("Touch tap activated a popup action");
      const tiny = await page.locator(".popper button").evaluateAll(buttons => buttons.filter(b => {
        const r = b.getBoundingClientRect();
        return r.width && r.height && (r.width < 44 || r.height < 44);
      }).map(b => b.textContent));
      if (tiny.length) throw new Error("Tiny popup targets: " + tiny.join(", "));
      await page.screenshot({ path: path.join(SHOTS, "phone-popup.png") });
    }
    if (errors.length) throw new Error(errors.join("\n"));
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
