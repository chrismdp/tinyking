/* eslint-disable no-undef */
// Read completed runs. Never generates observations or edits simulation state.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
require("../game-register");
require.extensions[".csv"] = (module, filename) => {
  module.exports = fs.readFileSync(filename, "utf8").split("\n").map(line => line.split(","));
};
const { name } = require("../../src/game/name");
const { disposition } = require("../../src/game/people");
const { hashUnit } = require("../../src/game/math");
const { Hex } = require("../../src/game/hex");
const v8 = require("node:v8");
const out = path.resolve(".cache/week-levers");
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), "utf8"));
const partial = process.argv.includes("--partial");
const referencePath = process.argv.slice(2).find(arg => !arg.startsWith("--")) || "/home/cp/code/tinyking-research/spikes/scenes/seed13-week.json";
const reference = JSON.parse(fs.readFileSync(referencePath, "utf8"));
const before = read("13-live-visible-food-juliana-control.json");
const people = read("people-13.json"), names = Object.fromEntries(Object.entries(reference.nameable).map(([id, n]) => [id, name(n)]));
names[reference.player] = "Maren";
const causesState = { ecs: { personality: Object.fromEntries(people.map(p => [p.id, p.personality])) } };
const namesOf = e => e.people.map(id => names[id] || id).join(" / ");
const count = events => events.reduce((r, e) => { r[e.type] = (r[e.type] || 0) + 1; return r; }, {});
const signature = e => [e.type, [...e.people].sort().join(":"), e.cause || ""].join("|");
const core = e => Object.fromEntries(Object.entries(e).filter(([k]) => !["awareness", "names"].includes(k)));
const time = day => {
  const minutes = Math.floor((day % 1 + 1e-8) * 1440);
  return `D${Math.floor(day) + 1} ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
function arrivalBond(from, to) {
  const p = people.find(p => p.id == from);
  if (!p) return "unavailable";
  const b = p.relationships.known[to];
  return b ? `${b.ring} / ${b.goodwill.toFixed(2)}` : `unmet${p.relationships.unmetGoodwill?.[to] != null ? " / " + p.relationships.unmetGoodwill[to].toFixed(2) : ""}`;
}
function referenceVisitCause(e) {
  if (e.day < .375) return "V. Summary contact before arrival";
  const player = reference.personality[reference.player];
  const fixed = { ecs: { personality: reference.personality }, peopleSeed: player.opinionSeed, opinionThresholds: player.opinionThresholds };
  const attitudes = e.people.map((id, i) => disposition(fixed, id, e.people[1 - i])).join(" / ");
  return `V. Fixed dispositions ${attitudes}; arrival bonds ${arrivalBond(e.people[0], e.people[1])} ↔ ${arrivalBond(e.people[1], e.people[0])}${e.courting ? "; canCourt true at contact" : ""}`;
}
let cachedSeed, cachedInitial;
function initialState(seed) {
  if (cachedSeed !== seed) {
    cachedInitial = v8.deserialize(fs.readFileSync(path.join(out, `initial-${seed}.bin`)));
    cachedSeed = seed;
  }
  return cachedInitial;
}
function startingVillage(seed, result) {
  const state = initialState(seed);
  const at = state.intro.campPoint;
  const distance = v => { const p = Hex(v.centre).toPoint(); return Math.hypot(p.x - at.x, p.y - at.y); };
  return Object.values(result.villages).sort((a, b) => distance(a) - distance(b))[0].id;
}
function pendingCourtships() {
  const state = initialState(13);
  return Object.entries(before.initialCourtships).map(([key, since]) => ({
    people: key.split(":"), since,
    names: key.split(":").map(id => name(state.ecs.nameable[id] || state.travel.people[id].nameable))
  }));
}
function surveyRow(result, villageOnly = true, village = result.village) {
  const inScope = e => villageOnly ? e.villageId == village : !!result.villages[e.villageId];
  const events = result.events.filter(inScope);
  const beforeArrival = result.history.filter(e => e.day >= 0 && e.day < result.start && inScope(e));
  const state = initialState(result.seed);
  const locals = Object.keys(state.residents).filter(id => !state.ecs.personable[id]?.dead && state.ecs.village[id]?.villageId == village);
  const hunger = result.hunger.filter(p => !villageOnly || locals.includes(p.id));
  let prior = result.initialCourtships;
  let courtshipChanges = 0;
  for (const row of result.courtships) {
    for (const key of new Set([...Object.keys(prior), ...Object.keys(row.courtships)])) {
      if (prior[key] !== row.courtships[key] && (!villageOnly || key.split(":").some(id => locals.includes(id)))) courtshipChanges++;
    }
    prior = row.courtships;
  }
  return { seed: result.seed, village: result.villages[village].name, villageId: village, frame: result.frame,
    people: locals.length, kinds: count(events), beforeArrival: count(beforeArrival), calendar: count([...beforeArrival, ...events]),
    courtingVisits: events.filter(e => e.type == "visit" && e.courting).length,
    courtingPairs: new Set(events.filter(e => e.courting).map(signature)).size,
    courtshipChanges,
    foodRequestHomes: new Set(Object.values(result.requests || {}).filter(r => r.kind == "food" && (!villageOnly || result.villages[village].houses.includes(r.householdId))).map(r => r.householdId)).size,
    hungryPeople: new Set(hunger.map(p => p.id)).size, hungerEpisodes: hunger.length,
    prolongedPeople: new Set(hunger.filter(p => p.peak > 2.5).map(p => p.id)).size };
}
const historic = reference.events.filter(e => e.day < .375);
const mismatches = historic.filter(e => {
  const generated = before.history.find(f => f.id == e.id);
  return !generated || JSON.stringify(core(e)) != JSON.stringify(core(generated));
});
const demographics = people.filter(p => reference.personable[p.id]).filter(p =>
  JSON.stringify([p.person.age, p.person.dead, p.home?.houseId]) !=
  JSON.stringify([reference.personable[p.id].age, reference.personable[p.id].dead, reference.household[p.id]?.houseId]));
const liveReference = reference.events.filter(e => e.day >= .375);
const refKinds = new Map(liveReference.map(e => [signature(e), e]));
const baselineKinds = new Map(before.events.map(e => [signature(e), e]));
const summary = { complete: !partial, referencePath, referenceEnd: reference.days, referencePlayer: reference.player,
  generatedPlayer: Object.keys(initialState(13).ecs.playable)[0],
  historicalCompared: historic.length, historicalMismatches: mismatches.map(e => e.id),
  demographicCompared: people.filter(p => reference.personable[p.id]).length,
  demographicMismatches: demographics.map(p => p.id),
  reference: count(liveReference), baseline: count(before.events),
  referencePairs: refKinds.size, commonPairs: [...refKinds.keys()].filter(k => baselineKinds.has(k)).length,
  referenceOnly: [...refKinds].filter(([key]) => !baselineKinds.has(key)).map(([, e]) => ({ ...e, names: namesOf(e) })),
  baselineOnly: [...baselineKinds].filter(([key]) => !refKinds.has(key)).map(([, e]) => e),
  survey: [], surveyHex: [] };
summary.pendingCourtships = pendingCourtships();
const protagonist = initialState(13), playerId = summary.generatedPlayer;
summary.protagonists = {
  generated: { id: playerId, name: name(protagonist.ecs.nameable[playerId]), male: protagonist.ecs.nameable[playerId].male,
    age: protagonist.ecs.personable[playerId].age },
  reference: { id: reference.player, name: name(reference.nameable[reference.player]), male: reference.nameable[reference.player].male,
    age: reference.personable[reference.player].age }
};
summary.referenceCauses = liveReference.filter(e => ["quarrel", "reconciliation"].includes(e.type)).map(e => ({
  type: e.type, people: e.people, names: e.people.map(id => names[id]), day: e.day,
  directions: e.people.map((id, i) => ({ name: names[id], towards: names[e.people[1 - i]],
    disposition: disposition(causesState, id, e.people[1 - i]),
    initialBond: people.find(p => p.id == id)?.relationships.known[e.people[1 - i]] })),
  roll: hashUnit(initialState(13).peopleSeed + ":action:quarrel:" + [...e.people].sort().join(":") + ":0")
}));
summary.trustedHelpers = summary.referenceCauses.map(e => ({
  names: e.names, type: e.type,
  helpers: people.filter(p => !p.person.dead && !e.people.includes(p.id) && e.people.every(id =>
    ["personal", "intimate"].includes(people.find(person => person.id == id)?.relationships.known[p.id]?.ring)))
    .map(p => ({ id: p.id, name: p.name })),
  playerDispositions: e.people.map(id => disposition(causesState, id, summary.generatedPlayer))
}));
for (let seed = 1; seed <= 10; seed++) {
  if (partial && !fs.existsSync(path.join(out, `${seed}-live.json`))) continue;
  const result = read(`${seed}-live.json`);
  if (!partial) assert.equal(fs.readFileSync(path.join(out, `survey-live-${seed}.exit`), "utf8").trim(), "0", `seed ${seed}: unsuccessful process receipt`);
  assert.equal(result.frame, 6, `seed ${seed}: browser frame cap changed`);
  assert.equal(result.liveClock, true, `seed ${seed}: wall clock missing`);
  assert(result.end > 6.99 && result.end < 7, `seed ${seed}: wrong first-season boundary`);
  const village = startingVillage(seed, result);
  summary.survey.push(surveyRow(result, true, village)); summary.surveyHex.push(surveyRow(result, false, village));
}
const experiments = ["experiments-live-a.json", "experiments-live-b.json"]
  .filter(file => !partial || fs.existsSync(path.join(out, file))).flatMap(read);
if (!partial) assert.equal(experiments.filter(e => e.spec.visible).length, 5, "five discovery-constrained pairs required");
assert.equal(new Set(experiments.map(e => e.spec.id)).size, experiments.length, "duplicate pair receipt");
const controls = experiments.map(e => e.baselineHash);
assert(new Set(controls).size == 1, "controls diverged");
assert(controls.every(hash => hash == before.hash), "control differs from reported seed-13 week");
for (const e of experiments) {
  for (const suffix of [e.spec.id, e.spec.id + "-control"]) {
    const r = read(`13-${suffix}.json`);
    assert.equal(r.frame, 6, "paired frame interval changed");
    assert.equal(r.liveClock, true, "paired wall clock missing");
    assert.equal(r.seed, 13, "paired seed changed");
    assert.equal(r.start, .375, "paired arrival time changed");
    assert.equal(r.hash, suffix.endsWith("-control") ? e.baselineHash : e.treatmentHash, "receipt does not match observation file");
    assert(r.end > 6.99 && r.end < 7, "paired season boundary changed");
  }
  if (e.spec.visible) for (const action of e.actions.filter(a => a.kind == "order" && ["chat", "give_gift"].includes(a.key))) {
    assert(action.selection?.discovered && action.selection?.outdoors, "interaction target was not selectable on the map");
  }
}
summary.controls = controls; summary.deterministic = true;
summary.timing = { frame: 6, realSeconds: .1, nightFastForward: true };
// Earlier runs remain diagnostic evidence. Their six-minute steps exceed the
// browser cap, and the first 36-second replay suppressed the real-time fade.
summary.exploratory = {};
for (const [key, file, frame] of [["coarse", "13-food-juliana-control.json", 60], ["fineWithoutNight", "13-fine.json", 6]]) {
  if (fs.existsSync(path.join(out, file))) summary.exploratory[key] = { frame, realSeconds: 0, counts: count(read(file).events) };
}
fs.writeFileSync(path.join(out, "experiments-all.json"), JSON.stringify(experiments, null, 2));
summary.turns = before.events.filter(e => ["quarrel", "reconciliation", "marriage", "move", "death", "departure"].includes(e.type)).map(e => ({ event: e,
  trigger: before.triggers.find(t => t.eventId == e.id) }));
fs.writeFileSync(path.join(out, "analysis.json"), JSON.stringify(summary, null, 2));
const rows = ["| When | Event | People | Cause | Reach |", "| --- | --- | --- | --- | --- |"];
for (const e of reference.events.filter(e => e.day >= 0)) {
  const cause = e.day == 0 ? { death: "A", inheritance: "B", reconciliation: "C", quarrel: "D", move: "F", marriage: "E", departure: "G", world_move: "F", visit: "V" }[e.type] : e.type == "quarrel" ? "D" : e.type == "reconciliation" ? "C" : "V";
  const reach = e.day == 0 ? "Out of reach: before arrival" : e.type == "visit" ? "Can change today: timing/food. Each row untested unless named in a pair." : "Could with a small change: trusted mediation. Indirect timing only today.";
  const detail = e.type == "inheritance" ? " · " + e.items.join(", ") : e.type == "move" ? ` · ${e.fromHouse} → ${e.toHouse}` : e.type == "departure" ? ` · ${e.fromWorld} → ${e.toWorld}` : "";
  rows.push(`| ${time(e.day)} | ${e.type}${e.courting ? " (courting)" : ""} · ${e.id.split("event-")[1]}${detail} | ${namesOf(e)} | ${e.type == "visit" ? referenceVisitCause(e) : cause} | ${reach} |`);
}
fs.writeFileSync(path.join(out, "reference-inventory.md"), rows.join("\n") + "\n");
console.log(JSON.stringify({ ...summary, referenceOnly: summary.referenceOnly.map(e => [e.type, e.names, e.day]),
  baselineOnly: summary.baselineOnly.map(e => [e.type, e.names, e.day]), turns: summary.turns.map(t => ({
    event: [t.event.type, t.event.names, time(t.event.day)], before: t.trigger.beforeBonds, after: t.trigger.bonds })) }, null, 2));
console.log(`PASS analysis: ${summary.survey.length} seeds, ${experiments.length} matched pairs, ${historic.length - mismatches.length}/${historic.length} historical records match; exact live-export replay differs`);
