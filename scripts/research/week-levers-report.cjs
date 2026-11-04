/* eslint-disable no-undef */
// Insert measured tables into the reviewed prose. Raw observations stay in .cache.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const out = path.resolve(".cache/week-levers");
const read = file => JSON.parse(fs.readFileSync(path.join(out, file), "utf8"));
const analysis = read("analysis.json"), experiments = read("experiments-all.json");
assert.equal(analysis.survey.length, 10);
assert(experiments.length >= 5 && analysis.deterministic);
assert(analysis.complete, "run the complete analysis before writing the report");
assert.equal(experiments.filter(e => e.spec.visible).length, 5);
const baseline = read("13-live-visible-food-juliana-control.json");
const time = day => {
  const mins = Math.floor((day % 1 + 1e-8) * 1440);
  return `D${Math.floor(day) + 1} ${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};
const counts = result => ["visit", "quarrel", "reconciliation"].map(type => result.events.filter(e => e.type == type).length).join(" / ");
const interpretations = {
  "food-juliana": "One berry portion arrives at D1 14:06. Sybil–Alice's quarrel and later reconciliation disappear. Sybil–Alan and Elias–Cecily quarrel instead. Juliana's first hunger spell has the same peak, 2.25 days, in both runs.",
  "food-margaret": "One berry portion arrives at D1 13:18. Margaret–Andrew's quarrel moves from D1 11:24 to D4 13:24. Alan–Christina reconcile at D5 16:00. Margaret's first hunger peak rises from 1.375 to 2.417 days.",
  "chat-sybil": "The game refuses the order because Sybil hates the player. Every recorded event, hunger spell, visit, courtship and final sampled state is identical.",
  "chat-edgar": "The game refuses the order because Edgar hates the player. The same full observation hash is unchanged.",
  "favour-mabel": "The player approaches Mabel to ask about help. No conversation panel with Mabel opens, no request is accepted and no favour is completed. The approach still changes meetings. This is a failed favour attempt, not proof of a favour reward.",
  "news-hugh": "The player approaches Hugh to tell news at D4 09:00. No news line is spoken. One visit disappears and several contact times move. The causal effect of actually telling news remains unproved by this pair.",
  "respond-hughseesi": "The player answers Hugh Seesi's actual campfire conversation instead of closing it immediately. This uses the naturally opened panel, with no remote selection or invented acquaintance."
};
const resultRows = ["## Comparison with the played week", "",
  "The comparison reads `/home/cp/code/tinyking-research/spikes/scenes/seed13-week.json` without changing it.", "",
  "| Observation | Played export | Headless control |", "| --- | --- | --- |",
  `| Shared person records checked for age, death and household | ${analysis.demographicCompared} | ${analysis.demographicMismatches.length} differences |`,
  `| Historical events compared, excluding changing news awareness | ${analysis.historicalCompared} | ${analysis.historicalCompared - analysis.historicalMismatches.length} exact matches |`,
  `| Visits after arrival | ${analysis.reference.visit || 0} | ${analysis.baseline.visit || 0} |`,
  `| Quarrels after arrival | ${analysis.reference.quarrel || 0} | ${analysis.baseline.quarrel || 0} |`,
  `| Reconciliations after arrival | ${analysis.reference.reconciliation || 0} | ${analysis.baseline.reconciliation || 0} |`,
  `| Protagonist | ${analysis.protagonists.reference.name}, ${analysis.protagonists.reference.male ? "male" : "female"}, ${analysis.protagonists.reference.age} | ${analysis.protagonists.generated.name}, ${analysis.protagonists.generated.male ? "male" : "female"}, ${analysis.protagonists.generated.age} |`,
  "",
  "The two historical differences are `terrain5_3-event-1161` (Hugh's household arrival) and `terrain5_3-event-1168` (the sealed backstory death). Their new family IDs differ. The generated player is `terrain5_3-person-3904`; the export's player is `terrain5_3-person-3901`. Hugh is `terrain5_3-person-4147` here and `terrain5_3-person-4143` there. All 24 midnight events on day 1 match before news awareness changes.", "",
  `The control contains ${analysis.commonPairs} of the export's ${analysis.referencePairs} distinct event-kind/person-pair combinations. Their times can still differ. The export stops at ${time(analysis.referenceEnd)}, before the control's end. It also includes Maren's four conversations and partial food deliveries. The export does not contain the original frame and input stream. The protagonist's sex and new entity IDs differ. IDs enter opinion variation and seeded social samples, so this is not a cosmetic difference. These limits prevent a claim of an exact replay or proof of preventing a particular event in that recorded session.`, "",
  `The ${experiments.length} separately run controls have the same SHA-256 fingerprint of the recorded observations, \`${experiments[0].baselineHash}\`. This covers events, hourly hunger spells, hourly visit observations, courtship changes and final sampled residents. It does not cover the whole game state, player knowledge or every relationship. Each control uses 36 game seconds per normal call, 0.1 seconds of wall time and the simulation's own night-time acceleration.`, ""];
resultRows.push(`Two courtships already exist at arrival: ${analysis.pendingCourtships.map(c => c.names.join(" / ") + " (" + c.people.join(" / ") + ")").join("; ")}. Both start at season 0. They are distinct from the two Cecily–Stephen visits labelled as courting in the export. The courtship ledger changes ${baseline.courtships.length} times during the control.`, "");
resultRows.push("Earlier diagnostic runs used six-minute steps and no wall time: 84 visits, five quarrels and one reconciliation. Those steps exceed the browser cap. A 36-second diagnostic without wall time gave 156, three and four, but disabled the normal night-time fade and acceleration. Neither is the primary week below. Their differences do not prove a cross-device problem within normal browser timing. The primary survey and all five primary pairs were rerun with the corrected clock.", "",
  "Existing trust also limits a mediation proposal. These are arrival bonds, before any new help. Each named resident already holds Personal or Intimate trust from both parties. There is no current command to recruit them as a mediator.", "",
  "| Exported quarrel pair | Shared trusted residents at arrival | Fixed dispositions towards William, in pair order |", "| --- | --- | --- |");
for (const row of analysis.trustedHelpers.filter(row => row.type == "quarrel")) resultRows.push(`| ${row.names.join(" / ")} | ${row.helpers.map(p => p.name).join(", ") || "None"} | ${row.playerDispositions.join(" / ")} |`);
const expRows = ["## Controlled experiments", "",
  "Each row is two separate week runs from the same cached seed-13 state. The treatment changes only the stated public player orders and available conversation choices. The three counts are visits / quarrels / reconciliations for the whole starting hex. Refused actions remain negative results.", "",
  "All five primary probes first walk to the remembered household through ordinary orders. They only select an NPC on a discovered tile, outside a building, as the map permits. They grant no acquaintance, trust or map visibility. They use the browser's capped normal frame and wall clock, including its night-time acceleration.", "",
  "| Pair | Scripted intention | Without action | With action | Observed result |", "| --- | --- | --- | --- | --- |"];
for (const e of [...experiments].sort((a, b) => Number(!!b.spec.visible) - Number(!!a.spec.visible))) {
  const before = read(`13-${e.spec.id}-control.json`), after = read(`13-${e.spec.id}.json`);
  let note = interpretations[e.spec.id];
  if (e.spec.nativeChat) {
    const id = after.initialPeople.find(p => p.name == e.spec.person).id;
    const lines = after.actions.filter(a => a.kind == "line");
    note += ` ${lines.length} player lines chosen. Hugh's final goodwill towards the player: ${before.playerRelationships[id]?.goodwill || 0} → ${after.playerRelationships[id]?.goodwill || 0}.`;
  }
  if (e.spec.visible) {
    const gifts = after.events.filter(row => row.type == "gift");
    const lines = after.actions.filter(row => row.kind == "line");
    const done = Object.values(after.requests || {}).filter(r => r.status == "completed" && r.actorId == after.initialPeople.find(p => p.id.startsWith("terrain"))?.id);
    const deliveries = Object.values(after.requests || {}).filter(r => r.progress > 0).map(r => `${r.kind}: ${r.progress}/${r.quantity}`);
    const removed = before.events.filter(row => row.type == "quarrel" && !after.events.some(other => other.type == "quarrel" && [...row.people].sort().join(":") == [...other.people].sort().join(":")));
    note = `${gifts.length ? gifts.map(g => "Gift completed " + time(g.day)).join(", ") : "No gift completed"}. ${lines.length} player lines chosen. ${done.length} favours completed${deliveries.length ? " (delivery " + deliveries.join(", ") + ")" : ""}. ${removed.length ? "Quarrels absent: " + removed.map(q => q.names.join(" / ")).join(", ") : "All control quarrel pairs remain"}.`;
  }
  expRows.push(`| ${e.spec.id} | ${e.spec.person}, from ${time(e.spec.day)} | ${counts(before)} | ${counts(after)} | ${note} |`);
}
const inputs = new Map();
for (const e of experiments) {
  const input = JSON.stringify(e.actions.filter(a => a.kind != "close-autonomous-chat"));
  if (!inputs.has(input)) inputs.set(input, []);
  inputs.get(input).push(e.spec.id);
}
expRows.push("", `The five scripted intentions produce ${inputs.size} distinct recorded player input streams. ${[...inputs.values()].filter(ids => ids.length > 1).map(ids => ids.join(" and ") + " execute the same inputs").join(". ") || "No input stream repeats"}. An unsuccessful intention is not evidence of an extra working lever.`, "");
expRows.push("The remembered house models knowledge from an earlier game. These pairs measure the action's effect, rather than whether a first game teaches the route or its timing clearly enough. A changed schedule alone does not prove that a human can predict and choose the resulting feud or reconciliation.", "");
expRows.push("", "Here are the consequential event changes, including unchanged control pairs. Absent means that person-pair event does not occur during the whole week. Times are rounded down to minutes.", "",
  "| Pair | People | Event | Without action | With action |", "| --- | --- | --- | --- | --- |");
const key = e => [e.type, [...e.people].sort().join(":")].join("|");
for (const e of experiments) {
  const b = read(`13-${e.spec.id}-control.json`), a = read(`13-${e.spec.id}.json`);
  const relevant = result => result.events.filter(row => ["quarrel", "reconciliation", "marriage", "move", "death", "departure"].includes(row.type));
  const bMap = new Map(relevant(b).map(row => [key(row), row])), aMap = new Map(relevant(a).map(row => [key(row), row]));
  for (const k of new Set([...bMap.keys(), ...aMap.keys()])) {
    const before = bMap.get(k), after = aMap.get(k), row = before || after;
    expRows.push(`| ${e.spec.id} | ${row.names.join(" / ")} | ${row.type} | ${before ? time(before.day) : "Absent"} | ${after ? time(after.day) : "Absent"} |`);
  }
}
expRows.push("", "The food recipients' first sampled hunger spells were:", "",
  "| Pair | Without action: start; end; peak | With action: start; end; peak |", "| --- | --- | --- |");
for (const e of experiments.filter(row => row.spec.kind == "food")) {
  const spell = h => h ? `${time(h.start)}; ${h.end ? time(h.end) : "season end"}; ${h.peak.toFixed(3)} days` : "None";
  expRows.push(`| ${e.spec.id} | ${spell(e.hungerBefore[0])} | ${spell(e.hungerAfter[0])} |`);
}
const news = read("13-live-visible-news-hugh.json"), newsLines = news.actions.filter(a => a.kind == "line");
expRows.push("", `The primary Hugh news attempt records ${newsLines.length} chosen lines. ${newsLines.map(l => `\`${l.id}\` (${time(l.day)})`).join(", ") || "No news line is spoken."}`, "",
  "The gift path includes an early attention reservation. In [`player.js`](../src/game/player.js), `player_jobs` runs `get_attention` before walking to the recipient. `get_attention` has no proximity check. A gift order can therefore displace another meeting before the food arrives. These results include that behaviour. They do not prove that eating the gift heals a feud. A physical attention check requires these effects to be measured again.", "",
  "Exploratory evidence, outside the primary clock: six original API probes and five discovery probes used six-minute steps with wall time disabled. Two API chat orders were refused because Sybil and Edgar hate the player. The Mabel approaches produced no favour, and the Hugh Jobari approach spoke no news. A twelfth diagnostic pair answered Hugh Seesi's naturally opened campfire panel: 11 player lines changed his final regard towards the player from 0 to −3.436, while its sampled community hash stayed unchanged. This confirms a real conversation path, but does not establish its community effect under the primary clock.", "");
const surveyRows = ["## Seeds 1 to 10", "",
  "These are post-arrival events before the next seasonal boundary. The extra-kinds column counts deaths, sickness, births, inheritances, marriages, moves and departures whenever they occur. An omitted kind has a count of zero. Old age and most family transitions run at season boundaries. Existing mature courtships can still marry after fresh contact.", "",
  "| Seed | Starting village | Residents | Visits | Quarrels | Reconciliations | Courting visits | Courtship changes | Hungry people | Hunger above 2.5 days | Homes asking for food | Extra event kinds |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
for (const row of analysis.survey) {
  const extra = Object.entries(row.kinds).filter(([type]) => !["visit", "quarrel", "reconciliation"].includes(type)).map(([type, n]) => `${type}: ${n}`).join(", ") || "None";
  surveyRows.push(`| ${row.seed} | ${row.village} | ${row.people} | ${row.kinds.visit || 0} | ${row.kinds.quarrel || 0} | ${row.kinds.reconciliation || 0} | ${row.courtingVisits} | ${row.courtshipChanges} | ${row.hungryPeople} | ${row.prolongedPeople} | ${row.foodRequestHomes} | ${extra} |`);
}
const kindList = kinds => Object.entries(kinds).sort(([a], [b]) => a.localeCompare(b)).map(([type, n]) => `${type}: ${n}`).join("; ") || "None";
surveyRows.push("", "The same villages also have events at the opening midnight, before the player can act. This table includes those in the full calendar-season count. Unlisted kinds are zero. Hunger before arrival is not reconstructed.", "",
  "| Seed | Already happened before arrival | Full first calendar season, including those events |", "| --- | --- | --- |");
for (const row of analysis.survey) surveyRows.push(`| ${row.seed} | ${kindList(row.beforeArrival)} | ${kindList(row.calendar)} |`);
surveyRows.push("", "The whole starting hex, including the other villages, produces:", "",
  "| Seed | Visits | Quarrels | Reconciliations | Courting visits | Hungry people | Hunger above 2.5 days | Extra event kinds |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const row of analysis.surveyHex) {
  const extra = Object.entries(row.kinds).filter(([type]) => !["visit", "quarrel", "reconciliation"].includes(type)).map(([type, n]) => `${type}: ${n}`).join(", ") || "None";
  surveyRows.push(`| ${row.seed} | ${row.kinds.visit || 0} | ${row.kinds.quarrel || 0} | ${row.kinds.reconciliation || 0} | ${row.courtingVisits} | ${row.hungryPeople} | ${row.prolongedPeople} | ${extra} |`);
}
surveyRows.push("", "Hunger is a sampled need, not a recorded story event. Each person counts once even when they need several meals. In [`hunger.js`](../src/game/hunger.js), `hungerSpeed` drops to 0.8 above 0.9 days and 0.6 above 2.5. A courting visit can repeat the same pair; it does not prove a new courtship or a wedding.", "");
surveyRows.push(`Quarrels occur in ${analysis.survey.filter(r => r.kinds.quarrel).length}/10 starting villages. Reconciliation occurs in ${analysis.survey.filter(r => r.kinds.reconciliation).length}/10. Courting visits occur in ${analysis.survey.filter(r => r.courtingVisits).length}/10. A courtship ledger changes in ${analysis.survey.filter(r => r.courtshipChanges).length}/10. These are ten specified seeds, not a population estimate.`, "",
  `Across the whole starting hex, weddings occur in ${analysis.surveyHex.filter(r => r.kinds.marriage).length}/10 seeds, deaths in ${analysis.surveyHex.filter(r => r.kinds.death).length}/10, and departures in ${analysis.surveyHex.filter(r => r.kinds.departure).length}/10. The tables retain the rare kinds instead of treating all activity as visits.`, "",
  "I do not count this as evidence that every seed supplies enough distinct choices. Visits and recurring meals provide activity. The tested gifts prove that intervention can change a week. They also expose broad scheduling effects and refused approaches. A player still needs a way to choose an intended social outcome from what they learned. Trusted mediation and a consenting introduction add that distinction to the existing rules.", "");
const rarities = [...new Set(["marriage", "move", "affair_meeting", "birth", "death", "inheritance", "departure", "arrival", "return", "world_move",
  ...analysis.surveyHex.flatMap(row => Object.keys(row.kinds))])].filter(type => !["visit", "quarrel", "reconciliation"].includes(type));
surveyRows.push("Rare kinds after arrival across the whole starting hex: " + rarities.map(type => {
  const seeds = analysis.surveyHex.filter(row => row.kinds[type]).map(row => row.seed);
  return `${type.replaceAll("_", " ")}: ${seeds.length}/10 seeds${seeds.length ? " (" + seeds.join(", ") + ")" : ""}`;
}).join("; ") + ".", "");
surveyRows.push("Full calendar-season frequency in the starting village, including its opening midnight: " + ["marriage", "move", "birth", "death", "inheritance", "departure", "return"].map(type =>
  `${type}: ${analysis.survey.filter(row => row.calendar[type]).length}/10 seeds`).join("; ") + ". Sickness has no rule in this build.", "");
const inventory = ["## Complete exported event inventory", "",
  "D1 00:00 is before arrival. Event numbers preserve the export's IDs. Cause keys refer to the rules above. All visits are listed, including ordinary family contacts and repeat visits. Their presence is not a claim of a separate strategic choice for every contact.", "",
  "Each live visit includes its fixed directional dispositions and the headless arrival bonds, in participant order. These are starting conditions, not reconstructed scores at the exported contact. The export lacks the full intermediate candidate lists and need states. A precise choice between competing visitors in that session remains unproved.", "",
  fs.readFileSync(path.join(out, "reference-inventory.md"), "utf8"), "",
  "## Complete headless control event inventory", "",
  "These are the control's actual records at the browser's maximum normal step, with wall time and night-time acceleration. They have different event identities and times from some exported records. Cause keys have the same meaning. The experiments compare against this week. Bonds are from the preceding frame. Hunger and tiredness are sampled after the event's frame, in participant order.", "",
  "| When | Event | People | Cause | Player's reach |", "| --- | --- | --- | --- | --- |"];
for (const e of baseline.events) {
  const cause = e.type == "quarrel" ? "D" : e.type == "reconciliation" ? "C" : "V";
  const reach = e.type == "visit" ? "Timing through attention, food and work; individual row untested unless named in a pair" : "Meeting timing today; deliberate mediation needs a small change";
  const trace = baseline.triggers.find(t => t.eventId == e.id);
  const bonds = e.people.map(id => trace.beforeBonds?.find(b => b.from == id)).map(b => b ? `${b.disposition} / ${b.bond?.ring || "unmet"} / ${b.bond?.goodwill.toFixed(2) ?? "unmet"}` : "unavailable").join(" ↔ ");
  const needs = trace.people.map(p => `${p.hunger.toFixed(3)} / ${p.tiredness.toFixed(3)}`).join(" ↔ ");
  inventory.push(`| ${time(e.day)} | ${e.type}${e.courting ? " (courting)" : ""} · ${e.id.split("event-")[1]} | ${e.names.join(" / ")} | ${cause}. Before: ${bonds}; after-frame hunger / tiredness: ${needs} | ${reach} |`);
}
inventory.push("",
  "## Hunger during the headless control", "",
  "The played export has only final hunger values, so it cannot date every meal or hunger onset. This table supplies every hourly sampled hunger spell in the control. The threshold is greater than 0.9 days since a meal. The end is the first hourly sample back below the threshold. An open spell runs to the season's end. A household reserve at onset does not prove accessible food at the person’s current task or position. The figures are needs, not sickness or death predictions.", "",
  "| Person | Hunger spells: start → end (peak days since meal) | Cause and reach |", "| --- | --- | --- |");
const grouped = new Map();
for (const h of baseline.hunger) {
  if (!grouped.has(h.id)) grouped.set(h.id, []);
  grouped.get(h.id).push(h);
}
for (const [id, spells] of grouped) inventory.push(`| ${spells[0].name} · ${id} | ${spells.map(h => `${time(h.start)} → ${h.end ? time(h.end) : "season end"} (${h.peak.toFixed(3)})`).join("; ")} | H. ${spells[0].house}; ${spells[0].reserve} portions in the household reserve at first onset. Specific gifts above do not prove reliable relief. |`);
let report = fs.readFileSync("shots/week-levers-report.md", "utf8");
for (const [key, lines] of Object.entries({ RESULTS: resultRows, EXPERIMENTS: expRows, SURVEY: surveyRows, INVENTORY: inventory })) {
  const pattern = new RegExp(`<!-- BEGIN ${key} -->[\\s\\S]*?<!-- END ${key} -->|<!-- ${key} -->`);
  report = report.replace(pattern, `<!-- BEGIN ${key} -->\n${lines.join("\n")}\n<!-- END ${key} -->`);
}
fs.writeFileSync("shots/week-levers-report.md", report);
console.log(`PASS report: ${analysis.survey.length} seeds, ${experiments.length} pairs, ${baseline.hunger.length} hunger spells, complete exported inventory`);
