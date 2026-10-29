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
const { eveningPlace } = require("../src/game/villages");
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
  let forge, farms, evening, fieldId, greenId, maxGathered = 0, familyWorkers = 0;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  while (state.days < 3) {
    simulation.step(3);
    if (!forge && state.ecs.planner[smith].task?.[0] == "trade_work") forge = copy(state);
    const working = Object.keys(state.ecs.farmable).filter(id => {
      const field = state.ecs.farmable[id];
      return field.claimerId && state.ecs.planner[field.claimerId].task?.[0] == "perform_subtask_in_slot";
    });
    for (const id of working) {
      const field = state.ecs.farmable[id];
      const n = working.filter(other => state.ecs.farmable[other].houseId == field.houseId).length;
      if (n > familyWorkers && field.slots.some(slot => slot.state == "harvestable")) {
        farms = copy(state); fieldId = id; familyWorkers = n;
      }
    }
    if ((state.days % 1) * 24 >= 18 && (state.days % 1) * 24 < 21) {
      const gathered = {};
      for (const id of Object.keys(state.ecs.personable)) {
        if (state.ecs.personable[id].dead || state.ecs.planner[id].task?.[0] != "wait_for") continue;
        const place = eveningPlace(state, id);
        if (place && state.ecs.meetingPlace[place.id].kind == "green" && distance(state.ecs.spatial[id], place) < 12) {
          gathered[place.id] = (gathered[place.id] || 0) + 1;
        }
      }
      for (const [g, n] of Object.entries(gathered)) {
        if (n > maxGathered) { maxGathered = n; evening = copy(state); greenId = g; }
      }
    }
    state.redraws.length = 0;
  }
  assert(forge && farms && evening, "real villagers must work and gather");
  assert(familyWorkers >= 2, "the crop snapshot must show two members working their family's fields");
  const fieldHouse = farms.ecs.farmable[fieldId].houseId;
  const familyPoints = Object.keys(farms.ecs.farmable).filter(id => {
    const field = farms.ecs.farmable[id];
    return field.houseId == fieldHouse && field.claimerId && farms.ecs.planner[field.claimerId].task?.[0] == "perform_subtask_in_slot";
  }).map(id => farms.ecs.spatial[id]);
  const fieldPoint = { x: familyPoints.reduce((sum, p) => sum + p.x, 0) / familyPoints.length,
    y: familyPoints.reduce((sum, p) => sum + p.y, 0) / familyPoints.length };
  const central = (a, b) => Hex(state.map.centre).distance(Hex().fromPoint(state.ecs.spatial[a])) -
    Hex(state.map.centre).distance(Hex().fromPoint(state.ecs.spatial[b]));
  const pastureId = Object.keys(initial.ecs.pasture).filter(id => {
    const pen = initial.ecs.pasture[id];
    return pen.kind == "sheep" && Object.keys(initial.ecs.personable).every(person => {
      const p = initial.ecs.spatial[person];
      return Math.abs(p.x - pen.centre.x) > pen.halfWidth + 15 || Math.abs(p.y - pen.centre.y) > pen.halfDepth + 15;
    });
  }).sort(central)[0];
  assert(pastureId, "the pasture capture needs an unobstructed flock");
  // A compact hamlet fits in the unmodified default camera on desktop and phone.
  const village = Object.values(state.villages).filter(v => v.houses.length <= 5)
    .sort((a, b) => a.houses.length - b.houses.length || central(a.houses[0], b.houses[0]))[0];
  const villageHouse = village.houses.slice().sort((a, b) => Hex(village.centre).distance(Hex().fromPoint(state.ecs.spatial[a])) - Hex(village.centre).distance(Hex().fromPoint(state.ecs.spatial[b])))[0];
  const points = village.houses.map(id => state.ecs.spatial[id]);
  const villagePoint = { x: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
    y: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2 };
  return { initial, forge, farms, evening, smith, fieldId, fieldPoint, greenId, pastureId, villageHouse, villagePoint, maxGathered, familyWorkers, village: village.id, houses: village.houses.length };
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
      const collapse = page.getByRole("button", { name: "Collapse task list", exact: true });
      if (await collapse.count()) await collapse.click();
      await page.waitForTimeout(8000);
      await page.screenshot({ path: path.join(SHOTS, name + ".png") });
    }
    await install(f.initial); await focus(f.villagePoint, 1000); await shot("village-default"); console.log("captured village");
    await install(f.forge); await focus(f.smith, 280); await shot("smith-forge"); console.log("captured forge");
    await install(f.farms); await focus(f.fieldPoint, 600); await shot("family-fields"); console.log("captured fields");
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
    console.log(JSON.stringify({ village: f.village, houses: f.houses, smith: f.smith, field: f.fieldId, familyWorkers: f.familyWorkers, green: f.greenId, gathered: f.maxGathered, pasture: f.pastureId, fieldHex: Hex().fromPoint(f.farms.ecs.spatial[f.fieldId]).toString(), errors }));
    assert.deepEqual(errors, []);
    await mobile.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
