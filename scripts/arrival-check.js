/* eslint-disable no-undef */
// Wider seed and survival coverage outside the quick Jest gate.
require("./game-register");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { generateMap, Hex } = require("../src/game/map");
const { path } = require("../src/game/pathfinding");
const { topController } = require("../src/game/playable");
const { createSimulation } = require("../src/game/simulation");

async function mapFor(seed) {
  const s = { ecs: { nextId: 1 }, ui: {}, days: 0.375, redraws: [], game_speed: "fast" };
  const result = await generateMap(s, seed, async () => {});
  s.ui.playerId = result.playerId;
  s.map = result.map;
  return s;
}
const hash = s => crypto.createHash("sha256").update(JSON.stringify(s.ecs)).digest("hex");
async function survive(seed, eat) {
  const s = await mapFor(seed);
  const id = s.ui.playerId;
  s.ecs.planner = { [id]: s.ecs.planner[id] };
  if (!eat) s.ecs.forageable = {};
  let meals = 0;
  let before = s.ecs.personable[id].hunger;
  const sim = createSimulation(s, { onHour() {
    const hunger = s.ecs.personable[id].hunger;
    if (hunger < before) meals++;
    before = hunger;
  } });
  const days = eat ? 10 : 3;
  for (let tick = 0; tick < days * 1440; tick++) sim.step(1);
  const person = s.ecs.personable[id];
  assert(!person.dead);
  if (eat) { assert(meals >= 5); assert(person.hunger < 2.5); }
  else assert(person.starving);
  console.log(JSON.stringify({ seed, days, eat, meals, hunger: person.hunger, starving: person.starving || false, hash: hash(s) }));
  return hash(s);
}
(async () => {
  const seeds = [...Array.from({ length: 30 }, (_, i) => i + 1), 53, 84, 1234, 98765, 4242424, 7777777, 31337, 2026, "arrival", "0"];
  for (const seed of seeds) {
    const s = await mapFor(seed);
    const id = s.ui.playerId;
    const start = Hex(s.map.playerStartTile);
    assert(Hex(s.map.centre).distance(start) >= 18);
    assert(Object.keys(s.ecs.personable).filter(p => topController(s.ecs, p) == id).length == 1);
    assert(Object.keys(s.ecs.building).every(h => topController(s.ecs, h) != id));
    const tileAt = point => s.space[Hex().fromPoint(point)].find(t => s.ecs.mappable[t]);
    const from = tileAt(s.ecs.spatial[id]);
    assert(Object.keys(s.ecs.building).some(h => start.distance(Hex().fromPoint(s.ecs.spatial[h])) <= 8 && path(s, from, tileAt(s.ecs.spatial[h]))));
    console.log("PASS edge camp and reachable village, seed", seed);
  }
  const a = await survive(13, true);
  assert.equal(a, await survive(13, true));
  await survive(13, false);
  console.log("PASS 40 seeds; ten-day forage survival; starvation without food; deterministic full ECS replay");
})().catch(e => { console.error(e); process.exit(1); });
