/* eslint-disable no-undef */
require("./game-register");
const fs = require("fs");
const { generateMap } = require("../src/game/map");
const { historyStep } = require("../src/game/social");
const { name } = require("../src/game/name");
const { eventSentence } = require("../src/game/events");
(async () => {
  const reports = [];
  for (const seed of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [20, 1234, 98765])) {
    const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
    const started = performance.now(); await generateMap(s, seed, async () => {});
    const count = s => Object.values(s.ecs.personable).filter(p => !p.dead).length;
    const before = count(s), age = {};
    for (const p of Object.values(s.ecs.personable).filter(p => !p.dead)) { const decade = Math.floor(p.age / 10) * 10; age[decade] = (age[decade] || 0) + 1; }
    const report = { seed, generationMs: performance.now() - started, historyMs: s.historyGenerationMs, before, ages: age, historyEvents: s.events.length };
    const ecs = { nextId: s.ecs.nextId };
    for (const key of ["personable", "personality", "kinship", "relationships", "household", "village", "building", "controllable", "possession", "nameable", "spatial", "profession", "playable"]) ecs[key] = Object.fromEntries(Object.entries(s.ecs[key] || {}).filter(([id]) => s.ecs.personable[id] || s.ecs.building[id] || s.ecs.possession?.[id]));
    let summary = { ecs, villages: s.villages, events: s.events, knowledge: s.knowledge, social: s.social, peopleSeed: s.peopleSeed, opinionThresholds: s.opinionThresholds };
    const previous = s.events.length;
    for (let season = 0; season < 20; season++) summary = historyStep(summary, season);
    report.after = count(summary); report.events = {};
    for (const e of summary.events.slice(previous)) report.events[e.type] = (report.events[e.type] || 0) + 1;
    reports.push(report); console.log(JSON.stringify(report));
    if (seed == 20) {
      const v = Object.values(s.villages)[0], display = id => s.ecs.nameable[id] ? name(s.ecs.nameable[id]) : "unclaimed";
      const lines = [v.name + " — 45 years before arrival", "", "Families"];
      for (const house of v.houses) { lines.push("House " + house); for (const id in s.ecs.personable) if (s.ecs.household[id]?.houseId == house) lines.push("  " + display(id) + ", " + s.ecs.personable[id].age + (s.ecs.personable[id].dead ? " (dead)" : "") + "; parents: " + s.ecs.kinship[id].parents.map(display).join(", ")); }
      lines.push("", "Key events"); for (const e of s.events.filter(e => e.villageId == v.id)) lines.push(eventSentence(s, e, display));
      lines.push("", "Heirlooms"); for (const p of Object.values(s.ecs.possession)) if (s.ecs.village[p.originalOwner]?.villageId == v.id) lines.push(p.name + "; made by " + display(p.maker) + "; " + p.owners.map(o => display(o.personId) + " (" + o.reason + ")").join(" → "));
      fs.writeFileSync("shots/history.txt", lines.join("\n"));
    }
  }
  fs.writeFileSync("shots/social-generation.json", JSON.stringify(reports, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
