/* eslint-disable no-undef */
require("./game-register");
const fs = require("fs");
const { generateMap } = require("../src/game/map");
const { historyStep, eligiblePartners, canCourt, romanticInterest } = require("../src/game/social");
const out = process.env.SOCIAL_OUT || "shots/mobility-seasonal";
fs.mkdirSync(out, { recursive: true });

function demographics(s) {
  const live = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && !s.ecs.playable?.[id]);
  const villages = Object.values(s.villages).map(v => {
    const ids = live.filter(id => s.ecs.village[id]?.villageId == v.id);
    const singles = ids.filter(id => s.ecs.personable[id].age >= 18 && (!s.ecs.kinship[id].spouse || s.ecs.personable[s.ecs.kinship[id].spouse].dead));
    const eligible = singles.map(id => {
      const partners = eligiblePartners(s, id);
      return { id, local: partners.filter(b => s.ecs.village[b]?.villageId == v.id).length,
        distant: partners.filter(b => s.ecs.village[b]?.villageId != v.id).length,
        attracted: partners.filter(b => romanticInterest(s, id, b)).length, consenting: partners.filter(b => canCourt(s, id, b)).length };
    });
    return { id: v.id, name: v.name, population: ids.length, singles: singles.length,
      withLocal: eligible.filter(p => p.local).length, withDistant: eligible.filter(p => p.distant).length,
      withAny: eligible.filter(p => p.local + p.distant).length, withAttraction: eligible.filter(p => p.attracted).length,
      eligible };
  });
  const cohorts = { child: 0, adult18to39: 0, adult40to59: 0, elder60plus: 0 };
  for (const id of live) { const a = s.ecs.personable[id].age; cohorts[a < 18 ? "child" : a < 40 ? "adult18to39" : a < 60 ? "adult40to59" : "elder60plus"]++; }
  return { population: live.length, cohorts, villages };
}
function summaryOf(s) {
  const ecs = { nextId: s.ecs.nextId };
  for (const key of ["personable", "personality", "kinship", "relationships", "household", "village", "building", "controllable", "possession", "nameable", "spatial", "profession", "playable"]) ecs[key] = Object.fromEntries(Object.entries(s.ecs[key] || {}).filter(([id]) => s.ecs.personable[id] || s.ecs.building[id] || s.ecs.possession?.[id]));
  return { ecs, villages: s.villages, events: s.events, knowledge: s.knowledge, social: s.social, peopleSeed: s.peopleSeed, opinionThresholds: s.opinionThresholds };
}
function eventCounts(events) { return events.reduce((r, e) => { r[e.type] = (r[e.type] || 0) + 1; return r; }, {}); }
module.exports = { demographics, summaryOf, eventCounts };
if (require.main === module) (async () => {
  const reports = [];
  for (const seed of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [20, 1234, 98765])) {
    const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
    const started = performance.now(); await generateMap(s, seed, async () => {});
    const report = { seed, generationMs: performance.now() - started, historyMs: s.historyGenerationMs, initial: demographics(s), history: eventCounts(s.events), checkpoints: [] };
    let summary = summaryOf(s); const n = s.events.length;
    for (let season = 0; season < 80; season++) {
      summary = historyStep(summary, season);
      if ([19, 79].includes(season)) report.checkpoints.push({ years: (season + 1) / 4, ...demographics(summary), events: eventCounts(summary.events.slice(n)) });
    }
    fs.writeFileSync(out + "/seed-" + seed + ".json", JSON.stringify(report, null, 2));
    reports.push(report);
    console.log(JSON.stringify({ seed, generationMs: report.generationMs, historyMs: report.historyMs, initial: report.initial.population, cohorts: report.initial.cohorts, history: report.history, checkpoints: report.checkpoints.map(c => ({ years: c.years, population: c.population, cohorts: c.cohorts, events: c.events, eligible: c.villages.map(v => [v.name, v.population, v.singles, v.withAny, v.withAttraction]) })) }));
  }
  fs.writeFileSync(out + "/summary.json", JSON.stringify(reports, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
