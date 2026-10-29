/* eslint-disable no-undef */
// Reproducible visual fixtures made by the real simulation, then viewed in Chromium.
// node scripts/survival-shots.js http://localhost:8098/
require("./game-register");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright-core");
const { generateMap } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { updateEcology } = require("../src/game/ecology");
const { deleteEntity } = require("../src/game/entities");
const { walk_to } = require("../src/game/tasks");
const { topController } = require("../src/game/playable");
const { HOUR } = require("../src/game/time");
const URL = process.argv[2] || "http://localhost:8098/";
const SHOTS = path.resolve(__dirname, "../shots");

async function world(seed) {
  const state = { ecs: { nextId: 1 }, ui: {}, redraws: [], days: 0.375, game_speed: "fast" };
  const result = await generateMap(state, seed, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  return state;
}
const snapshot = state => structuredClone({ ecs: state.ecs, days: state.days, playerId: state.ui.playerId });

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const feeding = await world(1);
  const actor = feeding.ui.playerId;
  for (const id in feeding.ecs.container) {
    if (topController(feeding.ecs, id) == actor) feeding.ecs.container[id].amounts = {};
  }
  feeding.ecs.personable[actor].hunger = 1.3;
  const pristineState = structuredClone(feeding);
  const simulation = createSimulation(feeding);
  let plant;
  for (let frame = 0; frame < 1200; frame++) {
    simulation.step(1);
    const p = feeding.ecs.planner[actor];
    if (p.task && p.task[0] == "forage") {
      plant = p.world.places[p.task[1]] || p.task[1];
      break;
    }
  }
  assert(plant, "the hungry player must actually forage");
  const before = snapshot(feeding);
  // Move the observer home so the before-picking bush is fully visible.
  const home = Object.keys(pristineState.ecs.container).find(id => topController(pristineState.ecs, id) == actor);
  const walk = { places: {} };
  walk_to(pristineState, actor, walk, 0.001, true, home);
  for (let frame = 0; frame < 30; frame++) walk_to(pristineState, actor, walk, 0.001, false, home);
  const pristine = snapshot(pristineState);
  for (let frame = 0; feeding.ecs.forageable[plant].amount && frame < 300; frame++) simulation.step(1);
  assert.equal(feeding.ecs.forageable[plant].amount, 0);
  for (let frame = 0; frame < 240; frame++) {
    const a = feeding.ecs.spatial[actor];
    const p = feeding.ecs.spatial[plant];
    if (Math.hypot(a.x - p.x, a.y - p.y) > 45) break;
    simulation.step(1);
  }
  const after = snapshot(feeding);

  const woods = await world(20);
  const centre = woods.ecs.spatial[woods.ui.playerId];
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // A felled patch frees room for the existing forest to seed its edges.
  const cut = Object.keys(woods.ecs.tree).sort((a, b) =>
    distance(woods.ecs.spatial[a], centre) - distance(woods.ecs.spatial[b], centre)).slice(0, 60);
  cut.forEach(id => deleteEntity(woods, id));
  let saplings = [];
  for (let hour = 0; hour < 48 && !saplings.length; hour++) {
    woods.days += HOUR;
    updateEcology(woods);
    saplings = Object.keys(woods.ecs.tree).filter(id => woods.ecs.tree[id].stage == "sapling");
  }
  assert(saplings.length, "the cut woodland must regrow");
  const mature = Object.keys(woods.ecs.tree).filter(id => woods.ecs.tree[id].stage == "mature");
  const neighbours = id => mature.filter(m => distance(woods.ecs.spatial[id], woods.ecs.spatial[m]) < 100).length;
  const sapling = saplings.sort((a, b) => neighbours(a) - neighbours(b) || distance(woods.ecs.spatial[a], centre) - distance(woods.ecs.spatial[b], centre))[0];
  const small = snapshot(woods);
  for (let hour = 0; hour < 74; hour++) { woods.days += HOUR; updateEcology(woods); }
  assert.equal(woods.ecs.tree[sapling].stage, "young");
  const young = snapshot(woods);
  for (let hour = 0; hour < 74; hour++) { woods.days += HOUR; updateEcology(woods); }
  assert.equal(woods.ecs.tree[sapling].stage, "mature");
  const grown = snapshot(woods);

  const browser = await chromium.launch({
    executablePath: path.join(require("os").homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", m => { if (m.type() == "error" && !m.location().url.endsWith("favicon.ico")) errors.push(m.text()); });

  async function install(scene, selected) {
    await page.evaluate(({ scene, selected }) => {
      const s = window.tinyking;
      const count = Math.max(s.ecs.nextId, scene.ecs.nextId);
      s.ecs = scene.ecs;
      s.days = scene.days;
      s.ui.playerId = scene.playerId;
      s.game_speed = "paused";
      // Reveal the fixture so woodland beyond the start can be inspected.
      s.ecs.playable[s.ui.playerId].known = Object.keys(s.ecs.mappable).map(id => {
        const p = s.ecs.spatial[id];
        const size = 60;
        const x = Math.round(p.x / (size * 1.5));
        return { x, y: Math.round(p.y / (size * Math.sqrt(3)) - (x & 1) / 2) };
      });
      s.redraws = Array.from({ length: count }, (_, i) => String(i));
      s.ui.actions.start_game();
      s.ui.actions.change_visibility({ selected_person: selected || null });
    }, { scene, selected });
    await page.waitForTimeout(600);
  }
  async function open(seed, scene, selected) {
    await page.goto(URL + "?seed=" + seed + "&weather=clear");
    await page.waitForFunction(() => window.tinyking && window.tinyking.renderer, null, { timeout: 60000 });
    await install(scene, selected);
    await page.waitForTimeout(8000);
  }
  async function centreOn(id) {
    for (let i = 0; i < 3; i++) {
      const p = await page.evaluate(id => window.tinyking.renderer.screenPosition(id), id);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(760, 490, { steps: 12 });
      await page.mouse.up({ button: "middle" });
      await page.waitForTimeout(200);
    }
  }
  async function shot(name, id) {
    const popup = page.locator(".popper .close");
    if (await popup.isVisible()) await popup.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SHOTS, name + ".png") });
    const evidence = await page.evaluate(id => {
      const s = window.tinyking;
      return { days: s.days, person: s.ecs.personable[id], plant: s.ecs.forageable[id], tree: s.ecs.tree[id], screen: s.renderer.screenPosition(id) };
    }, id);
    console.log(name, JSON.stringify(evidence));
  }

  try {
    await open(1, before, actor);
    await centreOn(plant);
    await page.mouse.move(760, 490);
    await page.mouse.wheel(0, -1000);
    await page.waitForTimeout(400);
    await centreOn(plant);
    if (!process.argv.includes("--bush-only")) await shot("person-foraging", actor);
    await install(pristine);
    await shot("bush-before-picking", plant);
    if (process.argv.includes("--bush-only")) return;
    await install(after, actor);
    await shot("bush-after-picking", plant);
    assert((await page.locator("#selected-person").innerText()).includes("Hungry"));
    await shot("selected-person-hungry", actor);

    await open(20, small);
    await page.evaluate(() => window.tinyking.renderer.showWholeMap());
    await page.waitForTimeout(500);
    const p = await page.evaluate(id => window.tinyking.renderer.screenPosition(id), sapling);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -2300);
    await page.waitForTimeout(400);
    await centreOn(sapling);
    await page.mouse.move(760, 490);
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(300);
    await centreOn(sapling);
    await shot("wood-edge-sapling", sapling);
    await install(young);
    await shot("wood-edge-young", sapling);
    await install(grown);
    await shot("wood-edge-mature", sapling);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
