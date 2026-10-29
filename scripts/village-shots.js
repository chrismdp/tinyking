/* eslint-disable no-undef */
// Real planner snapshots for village inspection. No orders or animals are staged.
// node scripts/village-shots.js http://localhost:8106/
require("./game-register");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { generateMap } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { updateWeather } = require("../src/game/weather");
const { Hex } = require("../src/game/hex");
const BASE = process.argv[2] || "http://localhost:8106/";
const SHOTS = path.resolve(__dirname, "../shots");
const CHROME = "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const copy = state => structuredClone({ ecs: state.ecs, space: state.space, days: state.days, villages: state.villages, map: state.map, world: state.world, weather: state.weather });

async function fixtures() {
  const state = { ecs: { nextId: 1 }, ui: {}, redraws: [], days: 0.375, game_speed: "fast" };
  const result = await generateMap(state, 1, async () => {});
  state.ui.playerId = result.playerId; state.map = result.map;
  state.weatherOverride = "clear"; updateWeather(state, 0);
  const initial = copy(state);
  const smiths = Object.keys(state.ecs.profession).filter(id => state.ecs.profession[id].trade == "smith");
  const smith = smiths.sort((a, b) => {
    const c = Hex(state.map.centre);
    return c.distance(Hex().fromPoint(state.ecs.spatial[a])) - c.distance(Hex().fromPoint(state.ecs.spatial[b]));
  })[0];
  const simulation = createSimulation(state);
  let forge, farms, evening, fieldId, greenId, maxGathered = 0;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  while (state.days < 3) {
    simulation.step(3);
    if (!forge && state.ecs.planner[smith].task?.[0] == "trade_work") forge = copy(state);
    if (!farms) for (const f of Object.keys(state.ecs.farmable)) {
      const farmer = state.ecs.farmable[f].claimerId;
      if (farmer && state.ecs.planner[farmer].task?.[0] == "perform_subtask_in_slot" && state.ecs.farmable[f].slots.some(slot => slot.state == "harvestable")) {
        farms = copy(state); fieldId = f; break;
      }
    }
    if ((state.days % 1) * 24 >= 18 && (state.days % 1) * 24 < 20) {
      for (const g of Object.keys(state.ecs.meetingPlace).filter(id => state.ecs.meetingPlace[id].kind == "green")) {
        const n = Object.keys(state.ecs.personable).filter(id => !state.ecs.personable[id].dead && distance(state.ecs.spatial[id], state.ecs.spatial[g]) < 40).length;
        if (n > maxGathered) { maxGathered = n; evening = copy(state); greenId = g; }
      }
    }
    state.redraws.length = 0;
  }
  assert(forge && farms && evening, "real villagers must work and gather");
  const pastureId = Object.keys(state.ecs.pasture).find(id => state.ecs.pasture[id].kind == "sheep");
  const smithVillage = state.ecs.village[smith].villageId;
  const village = state.villages[smithVillage];
  const villageHouse = village.houses.slice().sort((a, b) => Hex(village.centre).distance(Hex().fromPoint(state.ecs.spatial[a])) - Hex(village.centre).distance(Hex().fromPoint(state.ecs.spatial[b])))[0];
  const points = village.houses.map(id => state.ecs.spatial[id]);
  const villagePoint = { x: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
    y: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2 };
  return { initial, forge, farms, evening, smith, fieldId, greenId, pastureId, villageHouse, villagePoint, maxGathered };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const f = await fixtures();
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto(BASE + "?seed=1&intro=skip&weather=clear");
    await page.waitForFunction(() => window.tinyking?.renderer, null, { timeout: 60000 });
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.start_game(); s.game_speed = "paused"; s.ui.show.character = false; });
    await page.waitForTimeout(8000);
    async function install(snapshot) {
      await page.evaluate(snapshot => {
        const s = window.tinyking, count = Math.max(s.ecs.nextId, snapshot.ecs.nextId);
        Object.assign(s, snapshot); s.game_speed = "paused";
        s.ecs.playable[s.ui.playerId].known = Object.keys(s.ecs.mappable).map(id => {
          const p = s.ecs.spatial[id], x = Math.round(p.x / 90);
          return { x, y: Math.round(p.y / (60 * Math.sqrt(3)) - (x & 1) / 2) };
        });
        s.redraws = Array.from({ length: count }, (_, i) => String(i));
        s.ui.actions.change_visibility({ selected_person: null, character: false, main_menu: false, info: null, clock: true, speed_controls: true });
      }, snapshot);
      await page.waitForTimeout(500);
    }
    async function focus(id, distance) {
      await page.evaluate(({ id, distance }) => {
        const s = window.tinyking;
        s.renderer.focusOn(typeof id == "object" ? id : s.ecs.spatial[id], distance);
      }, { id, distance });
      await page.waitForTimeout(500);
    }
    async function shot(name) {
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(SHOTS, name + ".png") });
    }
    await install(f.initial); await focus(f.villagePoint, 1000); await shot("village-default"); console.log("captured village");
    await install(f.forge); await focus(f.smith, 280); await shot("smith-forge"); console.log("captured forge");
    await install(f.farms); await focus(f.fieldId, 600); await shot("family-fields"); console.log("captured fields");
    await install(f.initial); await focus(f.pastureId, 370); await shot("animals-pasture"); console.log("captured pasture");
    await install(f.evening); await focus(f.greenId, 600); await shot("green-evening"); console.log("captured green");
    const mobile = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(BASE + "?seed=1&intro=skip&weather=clear");
    await phone.waitForFunction(() => window.tinyking?.renderer, null, { timeout: 60000 });
    await phone.evaluate(() => {
      const s = window.tinyking; s.ui.actions.start_game(); s.game_speed = "paused";
      s.ui.actions.change_visibility({ character: false });
    });
    await phone.waitForTimeout(8000);
    phone.on("pageerror", e => errors.push(e.message));
    await phone.evaluate(({ snapshot, house }) => {
      const s = window.tinyking;
      Object.assign(s, snapshot); s.game_speed = "paused";
      s.ecs.playable[s.ui.playerId].known = Object.keys(s.ecs.mappable).map(id => {
        const p = s.ecs.spatial[id], x = Math.round(p.x / 90);
        return { x, y: Math.round(p.y / (60 * Math.sqrt(3)) - (x & 1) / 2) };
      });
      s.redraws = Array.from({ length: s.ecs.nextId }, (_, i) => String(i));
      s.renderer.focusOn(house, 1000);
      s.ui.actions.change_visibility({ main_menu: false, info: null, selected_person: null, clock: true, speed_controls: true });
    }, { snapshot: f.initial, house: f.villagePoint });
    await phone.waitForTimeout(8000);
    await phone.screenshot({ path: path.join(SHOTS, "village-phone.png") });
    console.log(JSON.stringify({ smith: f.smith, field: f.fieldId, green: f.greenId, gathered: f.maxGathered, pasture: f.pastureId, fieldHex: Hex().fromPoint(f.farms.ecs.spatial[f.fieldId]).toString(), errors }));
    assert.deepEqual(errors, []);
    await mobile.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
