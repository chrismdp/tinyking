/* eslint-disable no-undef */
// Two years of the real planner and simulation, without a renderer or player orders.
// Kept outside Jest so the normal gate stays quick: npm run survival-check
require("./game-register");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { startIntro } = require("../src/game/intro");
const { generateMap } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { season } = require("../src/game/time");
const { homeOf } = require("../src/game/overworld");

async function run(seed) {
  const started = performance.now();
  const state = { ecs: { nextId: 1 }, space: {}, ui: { show: {} }, redraws: [], days: 0.375, game_speed: "fast" };
  const result = await generateMap(state, seed, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  startIntro(state, { skip: true });
  const people = Object.keys(state.ecs.personable).filter(id => !state.ecs.personable[id].dead);
  let meals = 0;
  let winterMeals = 0;
  let maxHunger = 0;
  let winterStartFood;
  const winters = [];
  const previous = Object.fromEntries(people.map(id => [id, state.ecs.personable[id].hunger]));
  const food = () => Object.values(state.ecs.container).reduce((sum, c) =>
    sum + Object.values(c.amounts).reduce((a, n) => a + n, 0), 0);
  const simulation = createSimulation(state, { onHour() {
    const winter = season(state.days) == "winter";
    if (winter && winterStartFood == null) winterStartFood = food();
    if (!winter && winterStartFood != null) {
      winters.push({ startFood: winterStartFood, endFood: food() });
      winterStartFood = null;
    }
    for (const id of people) {
      const p = state.ecs.personable[id];
      assert(Number.isFinite(p.hunger), "invalid hunger: " + id);
      maxHunger = Math.max(maxHunger, p.hunger);
      if (p.hunger < previous[id]) {
        meals++;
        if (winter) winterMeals++;
      }
      previous[id] = p.hunger;
    }
  } });
  // Six game minutes per step; routes still visit every waypoint.
  const end = state.days + 24;
  while (state.days < end - 1e-9) {
    simulation.step(6);
    state.redraws.length = 0;
  }
  const alive = people.filter(id => !state.ecs.personable[id].dead).length;
  assert(alive / people.length >= 0.75, "famine on seed " + seed + ": " + alive + "/" + people.length);
  assert(meals > people.length * 10, "people must actually eat");
  const hash = crypto.createHash("sha256").update(JSON.stringify({ ecs: state.ecs, days: state.days })).digest("hex");
  return { seed, biome: homeOf(state.world).biome, alive, population: people.length, meals, winterMeals,
    maxHunger: +maxHunger.toFixed(3), winters, seconds: +((performance.now() - started) / 1000).toFixed(2), hash };
}

(async () => {
  const seeds = process.argv.slice(2).filter(s => s != "--determinism").map(Number);
  const reports = [];
  for (const seed of seeds.length ? seeds : [20, 1234, 98765]) {
    const report = await run(seed);
    reports.push(report);
    console.log(JSON.stringify(report));
  }
  if (process.argv.includes("--determinism")) {
    const again = await run(reports[0].seed);
    assert.equal(again.hash, reports[0].hash, "same-seed simulation diverged");
    console.log("PASS identical two-year ECS for repeated seed " + again.seed);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
