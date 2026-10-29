/* eslint-disable no-undef */
// Real planner state: build first, chop second, with no fixture timber.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright-core");
require("./game-register");
const { generateMap, Hex } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { enqueueTask } = require("../src/game/manager");
const { placeShelter, canPlaceShelter } = require("../src/game/construction");
const URL = process.argv[2] || "http://localhost:8103/";
const SHOTS = path.resolve(__dirname, "../shots");

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const state = { ecs: { nextId: 1 }, days: 0.375, ui: {}, redraws: [], game_speed: "fast" };
  const result = await generateMap(state, 13, async () => {});
  state.map = result.map;
  const player = state.ui.playerId = result.playerId;
  const start = Hex(state.map.playerStartTile);
  const tree = Object.keys(state.ecs.tree).find(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) <= 4);
  const tile = Object.keys(state.ecs.mappable).find(id => canPlaceShelter(state, id));
  const site = placeShelter(state, tile);
  const build = enqueueTask(state, { key: "build_shelter" }, site);
  enqueueTask(state, { key: "cut_tree_down" }, tree);
  const sim = createSimulation(state);
  for (let n = 0; n < 500 && state.ecs.planner[player].task?.[0] != "chop_tree"; n++) sim.step(1);
  if (build.waiting != "Waiting for logs" || state.ecs.planner[player].task?.[0] != "chop_tree") throw new Error("Did not reach waiting + chopping");
  // A few minutes of actual work makes the current progress visible.
  for (let n = 0; n < 8; n++) sim.step(1);
  const snapshot = JSON.parse(JSON.stringify({ ecs: state.ecs, days: state.days, space: state.space, map: state.map, villages: state.villages }));
  const browser = await chromium.launch({ executablePath: path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const phone of [false, true]) {
      const page = await browser.newPage({ viewport: phone ? { width: 390, height: 664 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(URL + "?seed=13");
      await page.waitForTimeout(8000);
      await page.getByText("Start new game").first().click();
      await page.waitForSelector(".character canvas");
      await page.locator(".panel .close").click();
      await page.locator("#speed-controls button").first().click();
      await page.evaluate(({ snapshot, player }) => {
        const s = window.tinyking;
        Object.assign(s, snapshot);
        s.ui.playerId = player;
        s.game_speed = "paused";
        s.redraws = Array.from({ length: s.ecs.nextId - 1 }, (_, i) => "" + (i + 1));
        s.ui.actions.change_visibility({ selected_person: player });
      }, { snapshot, player });
      if (phone) await page.getByRole("button", { name: "Expand task list" }).click();
      await page.waitForTimeout(1500);
      const label = phone ? "phone" : "desktop";
      const waiting = await page.locator(".task.waiting").innerText();
      const current = await page.locator(".task.current").innerText();
      if (!waiting.includes("Waiting for logs") || !current.includes("Chop wood")) throw new Error("Wrong queue display");
      if (await page.locator("#selected-person").count()) throw new Error("Duplicate selected-player label");
      const playerName = await page.locator("#task-panel footer strong").innerText();
      const occurrences = (await page.locator("#ui").innerText()).split(playerName).length - 1;
      if (occurrences != 1) throw new Error("Player name occurs " + occurrences + " times");
      await page.screenshot({ path: path.join(SHOTS, label + "-waiting-chop.png") });
      if (phone) await page.getByRole("button", { name: "Collapse task list" }).click();
      await page.screenshot({ path: path.join(SHOTS, label + "-single-name.png") });
      if (errors.length) throw new Error(errors.join("\n"));
      console.log(label + ": waiting build, active chop, and one player name; screenshots saved");
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
