/* eslint-disable no-undef */
// Generation, daily allocation and unstaged planner probes for this regression.
require("./game-register");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { generateMap, Hex } = require("../src/game/map");
const { startIntro } = require("../src/game/intro");
const { eveningPlace } = require("../src/game/villages");
const { createSimulation } = require("../src/game/simulation");
const { topController } = require("../src/game/playable");
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const key = p => Hex().fromPoint(p).toString();

async function world(seed) {
  const s = { ecs: { nextId: 1 }, ui: { show: {} }, redraws: [], days: 0.375, game_speed: "fast" };
  const result = await generateMap(s, seed, async () => {});
  s.map = result.map; s.ui.playerId = result.playerId;
  startIntro(s, { skip: true });
  return s;
}

function checkPlaces(s) {
  let maxDistance = 0, minSeparation = Infinity, visitors = 0;
  const fields = new Set(Object.keys(s.ecs.farmable).map(id => key(s.ecs.spatial[id])));
  for (let day = 0; day < 8; day++) {
    s.days = day + 0.8;
    const allPoints = [];
    for (const village of Object.values(s.villages)) {
      const points = Object.keys(s.ecs.personable).filter(id => s.ecs.village[id].villageId == village.id).map(id => {
        const p = eveningPlace(s, id);
        assert(p && Number.isFinite(p.x) && Number.isFinite(p.y), "every visitor has a real space");
        assert.equal(s.ecs.village[p.id].villageId, village.id);
        const d = distance(p, s.ecs.spatial[p.id]);
        assert(d < 300); maxDistance = Math.max(maxDistance, d);
        assert(!fields.has(key(p)), "gathering stays outside fields");
        const tile = (s.space[key(p)] || []).find(t => s.ecs.mappable[t]);
        assert(tile && s.ecs.walkable[tile].speed > 0 && s.ecs.mappable[tile].villagePlot);
        for (const house of Object.keys(s.ecs.building)) assert(distance(p, s.ecs.spatial[house]) >= 55);
        for (const [work, w] of Object.entries(s.ecs.workplace)) assert(distance(p, s.ecs.spatial[work]) >= (w.trade == "miller" ? 45 : 30));
        for (const pen of Object.values(s.ecs.pasture)) assert(Math.abs(p.x - pen.centre.x) >= pen.halfWidth + 12 || Math.abs(p.y - pen.centre.y) >= pen.halfDepth + 12);
        visitors++;
        return p;
      });
      for (let i = 0; i < points.length; i++) for (const p of points.slice(i + 1)) {
        const d = distance(points[i], p);
        assert(d >= 32); minSeparation = Math.min(minSeparation, d);
      }
      allPoints.push(...points);
    }
    for (let i = 0; i < allPoints.length; i++) for (const p of allPoints.slice(i + 1)) assert(distance(allPoints[i], p) >= 32, "body separation also holds between villages");
  }
  s.days = 0.375;
  for (const village of Object.values(s.villages)) for (const house of village.houses) {
    const h = s.ecs.household[house];
    assert(h.fields.length >= 1 && h.fields.length <= 2);
    assert(h.backyards.length >= 1 && h.backyards.length <= 2);
    for (const f of h.fields) assert.equal(topController(s.ecs, f), topController(s.ecs, house));
  }
  return { visitors, maxDistance, minSeparation };
}

async function probe(seed) {
  const s = await world(seed);
  const generationHash = state => crypto.createHash("sha256").update(JSON.stringify([state.ecs, state.map, state.villages])).digest("hex");
  const hash = generationHash(s);
  assert.equal(hash, generationHash(await world(seed)), "same seed repeats the complete generated state");
  const places = checkPlaces(s);
  const ids = Object.keys(s.ecs.personable);
  const previous = new Map(ids.map(id => [id, s.ecs.personable[id].hunger]));
  const sleepers = new Set();
  let meals = 0, gatherings = 0, maxActualDistance = 0, minActualSeparation = Infinity, minActualBodyClearance = Infinity;
  const sim = createSimulation(s);
  while (s.days < 3) {
    sim.step(3);
    const gathered = [];
    for (const id of ids) {
      const person = s.ecs.personable[id], task = s.ecs.planner[id]?.task?.[0];
      if (person.hunger < previous.get(id)) meals++;
      previous.set(id, person.hunger);
      if (task == "sleep") sleepers.add(id);
      if (task == "wait_for" && s.days % 1 >= 0.75 && s.days % 1 < 0.875) {
        const p = eveningPlace(s, id), at = s.ecs.spatial[id];
        if (p && distance(at, p) < 12) {
          gatherings++; gathered.push({ ...at, radius: person.size * 0.36 });
          maxActualDistance = Math.max(maxActualDistance, distance(at, s.ecs.spatial[p.id]));
        }
      }
    }
    for (let i = 0; i < gathered.length; i++) for (const other of gathered.slice(i + 1)) {
      const d = distance(gathered[i], other);
      minActualSeparation = Math.min(minActualSeparation, d);
      minActualBodyClearance = Math.min(minActualBodyClearance, d - gathered[i].radius - other.radius);
    }
    s.redraws.length = 0;
  }
  assert(meals > 0 && sleepers.size > 0 && gatherings > 0, "real planners still eat, sleep and gather");
  assert(maxActualDistance < 300);
  assert(minActualBodyClearance > 0, "gathered bodies do not overlap despite walking tolerance");
  console.log(JSON.stringify({ seed, hash, ...places, meals, sleepers: sleepers.size, gatheringObservations: gatherings, maxActualDistance, minActualSeparation, minActualBodyClearance,
    survivors: ids.filter(id => !s.ecs.personable[id].dead).length, population: ids.length }));
}

(async () => {
  if (process.argv.includes("--generation")) {
    for (const seed of [...Array.from({ length: 100 }, (_, i) => i), 1234, 98765]) {
      console.log(JSON.stringify({ seed, ...checkPlaces(await world(seed)) }));
    }
    console.log("PASS 102 seeds; eight evenings each; every visitor local, near, separated and clear; household ownership");
    return;
  }
  for (const seed of [1, 13, 20, 1234, 98765]) await probe(seed);
  console.log("PASS five repeated seeds; eight evenings each; every visitor local, near, separated and clear; household ownership; real meals, sleep and gatherings");
})().catch(error => { console.error(error); process.exitCode = 1; });
