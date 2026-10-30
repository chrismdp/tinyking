/* eslint-disable no-undef */
// Real planner for five years, including food, social meetings and seasonal life.
require("./game-register");
const fs = require("fs");
const path = require("path");
const OUT = process.env.SOCIAL_OUT || "shots";
fs.mkdirSync(OUT, { recursive: true });
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { generateMap } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { startIntro } = require("../src/game/intro");
const { demographics } = require("./social-mobility-probe");
const { eveningPlace } = require("../src/game/villages");
const snapshot = s => JSON.stringify(Object.fromEntries(["ecs", "space", "days", "villages", "map", "world", "weather", "knowledge", "events", "social", "peopleSeed", "opinionThresholds"].map(k => [k, s[k]])));
async function run(seed, capture) {
  const started = performance.now();
  const s = { ecs: { nextId: 1 }, space: {}, ui: { show: {} }, redraws: [], days: .375, game_speed: "fast" };
  const result = await generateMap(s, seed, async () => {}); s.map = result.map; s.ui.playerId = result.playerId;
  startIntro(s, { skip: true });
  const original = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead);
  const initialEvents = s.events.length;
  const initialDemographics = demographics(s);
  const previousHunger = Object.fromEntries(original.map(id => [id, s.ecs.personable[id].hunger]));
  let meals = 0, twoYears, evening, wedding, visit, travelling, move;
  const count = () => Object.values(s.ecs.personable).filter(p => !p.dead).length;
  const sim = createSimulation(s, { onHour() {
    for (const id of Object.keys(s.ecs.personable)) if (!s.ecs.personable[id].dead) {
      const p = s.ecs.personable[id]; assert(Number.isFinite(p.hunger));
      if (p.hunger < previousHunger[id]) meals++;
      previousHunger[id] = p.hunger;
    }
    for (const id of Object.keys(s.ecs.personable)) if (!s.ecs.personable[id].dead && s.ecs.village[id]?.villageId) {
      assert(eveningPlace(s, id), "missing evening destination for " + id + " on seed " + seed);
    }
    if (capture && !evening) {
      const chatting = Object.keys(s.ecs.planner).filter(id => s.ecs.planner[id].task?.[0] == "socialise");
      const village = chatting.map(id => s.ecs.village[id]?.villageId).find(v => chatting.filter(id => s.ecs.village[id]?.villageId == v).length >= 4);
      if (village) { fs.writeFileSync(OUT + "/social-evening-state.json", snapshot(s)); fs.writeFileSync(OUT + "/social-evening-meta.json", JSON.stringify({ village, chatting })); evening = true; console.log("CAPTURE real evening " + s.days); }
    }
    if (capture && !travelling) {
      const id = Object.keys(s.ecs.planner).find(id => {
        const p = s.ecs.planner[id], b = p.world.social?.partnerId;
        return p.task?.[0] == "walk_to" && p.task[1] == "socialDestination" && b && s.ecs.village[id]?.villageId != s.ecs.village[b]?.villageId;
      });
      if (id) { fs.writeFileSync(OUT + "/mobility-travelling-state.json", snapshot(s)); fs.writeFileSync(OUT + "/mobility-travelling-meta.json", JSON.stringify({ id, partnerId: s.ecs.planner[id].world.social.partnerId })); travelling = true; }
    }
    if (capture && !visit) {
      const event = s.events.slice(initialEvents).find(e => e.type == "visit" && e.fromVillage != e.toVillage);
      if (event) { fs.writeFileSync(OUT + "/mobility-visit-state.json", snapshot(s)); fs.writeFileSync(OUT + "/mobility-visit-meta.json", JSON.stringify(event)); visit = true; }
    }
    if (capture && !move) {
      const event = s.events.slice(initialEvents).find(e => e.type == "marriage" && new Set(e.fromVillages).size > 1);
      if (event) { fs.writeFileSync(OUT + "/mobility-move-state.json", snapshot(s)); fs.writeFileSync(OUT + "/mobility-move-meta.json", JSON.stringify(event)); move = true; }
    }
    if (capture && !wedding && s.events.slice(initialEvents).some(e => e.type == "marriage")) {
      fs.writeFileSync(OUT + "/social-wedding-state.json", snapshot(s)); wedding = true; console.log("CAPTURE real wedding " + s.days);
    }
  } });
  const end = s.days + 60, twoYearDay = s.days + 24;
  while (s.days < end - 1e-9) {
    sim.step(6); s.redraws.length = 0;
    if (!twoYears && s.days >= twoYearDay - 1e-9) {
      twoYears = { survivingOriginal: original.filter(id => !s.ecs.personable[id].dead).length, initial: original.length, population: count(), meals };
      assert(twoYears.survivingOriginal / original.length >= .75, "two-year survival fell below 75%");
      console.log("TWO YEARS " + JSON.stringify({ seed, ...twoYears }));
    }
  }
  assert(meals > original.length * 10, "people must actually eat");
  const final = count();
  fs.writeFileSync(OUT + "/social-final-" + seed + ".json", snapshot(s));
  console.log("FINAL " + JSON.stringify({seed, final, deaths: s.events.slice(initialEvents).filter(e => e.type == "death").map(e => e.cause), eventCounts: s.events.slice(initialEvents).reduce((r,e) => { r[e.type]=(r[e.type]||0)+1; return r; }, {}) }));
  assert(final / original.length >= .75 && final / original.length <= 1.3, "five-year population unstable: " + final + "/" + original.length);
  const events = {}; for (const e of s.events.slice(initialEvents)) events[e.type] = (events[e.type] || 0) + 1;
  const hash = crypto.createHash("sha256").update(JSON.stringify(s.ecs)).digest("hex");
  return { seed, initial: original.length, initialDemographics, finalDemographics: demographics(s), crossVillageMarriages: s.events.slice(initialEvents).filter(e => e.type == "marriage" && new Set(e.fromVillages).size > 1).length, twoYears, final, events, meals, evening, wedding, historyMs: s.historyGenerationMs, seconds: (performance.now() - started) / 1000, hash };
}
(async () => {
  const reports = [];
  for (const file of ["social-evening-state.json", "social-evening-meta.json", "social-wedding-state.json"]) {
    const target = path.join(OUT, file); if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  for (const seed of (process.argv.slice(2).filter(s => s != "--determinism").length ? process.argv.slice(2).filter(s => s != "--determinism").map(Number) : [20, 1234, 98765])) {
    try {
      const report = await run(seed, seed == 20); reports.push(report); console.log(JSON.stringify({ ...report, initialDemographics: undefined, finalDemographics: undefined }));
      fs.writeFileSync(OUT + "/social-simulation.json", JSON.stringify(reports, null, 2));
    } catch (error) { console.error("FAIL seed " + seed, error); process.exitCode = 1; }
  }
  if (process.argv.includes("--determinism") && reports.length) { const repeated = await run(reports[0].seed, false); assert.equal(repeated.hash, reports[0].hash); console.log("PASS identical five-year ECS replay"); }
  if (process.exitCode) throw new Error("One or more seed checks failed");
  console.log("PASS real five-year population and two-year survival on every seed");
})().catch(e => { console.error(e); process.exitCode = 1; });
