/* eslint-disable no-undef */
// Research only: unchanged game generation, public orders, real HTN frames.
require("./week-levers-register.cjs");
const fs = require("node:fs");
const path = require("node:path");
const v8 = require("node:v8");
const crypto = require("node:crypto");
const { generateWorldGame, generateWorldHistory } = require("../../src/game/world_history");
const { ensureMap, advanceWorldClock } = require("../../src/game/travel");
const { startGame } = require("../../src/game/new_game");
const { createSimulation } = require("../../src/game/simulation");
const { gameData, replaceGame } = require("../../src/game/save_game");
const { name } = require("../../src/game/name");
const { disposition } = require("../../src/game/people");
const { householdFood } = require("../../src/game/favours");
const { closeChat } = require("../../src/game/chat");
const OUT = path.resolve(".cache/week-levers");
// Midnight at day 7 runs the NEXT season's demographic boundary.
const END = 7 - 1 / 86400;
fs.mkdirSync(OUT, { recursive: true });
const write = (file, data) => fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2));
const digest = data => crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
const liveIds = s => Object.keys(s.residents).filter(id => !s.ecs.personable[id]?.dead);
const nm = (s, id) => s.ecs.nameable[id] ? name(s.ecs.nameable[id]) : id;
const pair = people => [...people].sort().join(":");
const eventKey = e => [e.type, pair(e.people), e.cause || "", e.courting || false].join("|");
function describe(s, e) {
  return { ...e, names: e.people.map(id => nm(s, id)) };
}
async function initial(seed) {
  const file = path.join(OUT, `initial-${seed}.bin`);
  if (!fs.existsSync(file)) {
    const at = Date.now();
    const s = { ecs: { nextId: 1 }, space: {}, redraws: [], ui: { show: {} }, days: .375, game_speed: "normal" };
    let progressSeason = "";
    const progress = async label => {
      if (label.startsWith("12 years") && label != progressSeason) {
        progressSeason = label; console.log(`HISTORY ${seed} ${label}`);
      }
    };
    // Seed 13 uses the complete browser generation path. The survey builds only
    // its observed hex: unopened neighbouring terrain cannot affect this week.
    let result;
    if (seed == 13) result = await generateWorldGame(s, seed, progress);
    else {
      await generateWorldHistory(s, seed, progress);
      const map = await ensureMap(s, s.travel.active, progress);
      delete s.compact; Object.assign(s, map);
      await advanceWorldClock(s);
      result = { map: s.map, playerId: Object.keys(s.ecs.playable)[0] };
    }
    s.map = result.map; s.ui.playerId = result.playerId;
    startGame(s, { skip: true });
    fs.writeFileSync(file, v8.serialize(gameData(s)));
    write(`generation-${seed}.json`, { seed, ms: Date.now() - at, bytes: fs.statSync(file).size,
      player: s.ui.playerId, active: s.travel.active, villages: s.villages });
    console.log(`GENERATED ${seed} ${Date.now() - at}ms`);
  }
  const s = { redraws: [] };
  replaceGame(s, v8.deserialize(fs.readFileSync(file)));
  return s;
}
function personState(s, id) {
  const p = s.ecs.personable[id];
  return { id, name: nm(s, id), age: p.age, hunger: p.hunger, tiredness: p.tiredness,
    village: s.ecs.village[id]?.villageId, house: s.ecs.household[id]?.houseId,
    task: s.ecs.planner[id]?.task, social: s.ecs.planner[id]?.world.social };
}
async function run(seed, label = "baseline", action = () => {}, frame = 60) {
  const liveClock = label.startsWith("live");
  const at = Date.now(), s = await initial(seed), ids = liveIds(s), start = s.days;
  const initialCourtships = structuredClone(s.social.courtships);
  const initialAvoidance = structuredClone(s.social.avoidance);
  const history = s.events.map(e => describe(s, e)), initialCount = s.events.length;
  const hunger = [], visits = [], courtships = [], actions = [], triggers = [];
  const hungerOpen = new Map(), visitOpen = new Map();
  let seenEvents = initialCount, lastCourts = JSON.stringify(s.social.courtships);
  const observe = () => {
    const reserves = householdFood(s);
    for (const id of ids) {
      const p = s.ecs.personable[id];
      if (p.hunger > .9 && !hungerOpen.has(id)) {
        const row = { id, name: nm(s, id), start: s.days, peak: p.hunger,
          house: s.ecs.household[id]?.houseId, reserve: reserves.get(s.ecs.household[id]?.houseId) || 0 };
        hunger.push(row); hungerOpen.set(id, row);
      }
      if (hungerOpen.has(id)) {
        const row = hungerOpen.get(id); row.peak = Math.max(row.peak, p.hunger);
        if (p.hunger <= .9) { row.end = s.days; hungerOpen.delete(id); }
      }
      const v = s.ecs.planner[id]?.world.social;
      if (v && !visitOpen.has(id)) {
        const row = { day: s.days, id, partnerId: v.partnerId, visitor: v.visitor, kind: v.kind };
        visits.push(row); visitOpen.set(id, row);
      }
      if (!v) visitOpen.delete(id);
    }
    const now = JSON.stringify(s.social.courtships);
    if (now != lastCourts) { courtships.push({ day: s.days, courtships: { ...s.social.courtships } }); lastCourts = now; }
  };
  const sim = createSimulation(s, { onHour: observe,
    onDay: () => console.log(`DAY ${seed} ${label} ${Math.floor(s.days) + 1}`),
    onError: error => { throw error; } });
  while (s.days < END - 1e-9) {
    action(s, actions);
    // A conversation panel pauses the real clock. The default observer leaves immediately.
    if (s.chat?.active) { actions.push({ day: s.days, kind: "close-autonomous-chat", npc: s.chat.active.npcId }); closeChat(s); }
    s.game_speed = "normal";
    // Live callers supply wall time too: it enables the game's own overnight
    // fast-forward. Bound its possible 120x advance at this season's end.
    const accelerates = liveClock && s.nightSleep && s.nightSleep.fadeSeconds + frame / 60 >= .5;
    const remaining = (END - s.days) * 14400 / (accelerates ? 120 : 1);
    const beforeContacts = new Map();
    for (const [id, planner] of Object.entries(s.ecs.planner)) {
      const other = planner.world.social?.partnerId;
      if (other) beforeContacts.set(pair([id, other]), [id, other].map((from, i) => ({
        from, to: [other, id][i], disposition: disposition(s, from, [other, id][i]),
        bond: structuredClone(s.ecs.relationships[from]?.known[[other, id][i]])
      })));
    }
    const stepFrame = Math.min(frame, remaining);
    sim.step(stepFrame, liveClock ? stepFrame / 60 : 0);
    if (sim.pending) await sim.pending;
    if (s.travelError) throw new Error(s.travelError);
    for (const e of s.events.slice(seenEvents)) {
      triggers.push({ eventId: e.id, day: e.day, type: e.type,
        beforeBonds: beforeContacts.get(pair(e.people)),
        people: e.people.map(id => personState(s, id)),
        bonds: e.people.length == 2 ? e.people.map((id, i) => ({ from: id, to: e.people[1 - i],
          disposition: disposition(s, id, e.people[1 - i]), bond: structuredClone(s.ecs.relationships[id]?.known[e.people[1 - i]]) })) : [],
        avoidance: s.social.avoidance[pair(e.people)] });
    }
    seenEvents = s.events.length;
    s.redraws.length = 0;
  }
  observe();
  const events = s.events.slice(initialCount).map(e => describe(s, e));
  const final = ids.map(id => personState(s, id));
  const village = Object.keys(s.villages)[0];
  const result = { seed, label, frame, liveClock, start, end: s.days, village, villages: s.villages,
    initialCourtships, initialAvoidance,
    initialPeople: ids.map(id => ({ id, name: nm(s, id), village: s.ecs.village[id]?.villageId })),
    history, events, hunger, visits, courtships, actions, triggers, final,
    requests: s.favours?.requests, chatHistory: s.chat?.history,
    playerRelationships: Object.fromEntries(ids.map(id => [id, s.ecs.relationships[id]?.known[s.ui.playerId]])),
    hash: digest({ events, hunger, visits, courtships, final }), ms: Date.now() - at };
  write(`${seed}-${label}.json`, result);
  console.log(JSON.stringify({ seed, label, ms: result.ms, hash: result.hash,
    events: events.reduce((r, e) => { r[e.type] = (r[e.type] || 0) + 1; return r; }, {}),
    courtships, hungryAtEnd: final.filter(p => p.hunger > .9).length }));
  return result;
}
if (require.main === module) {
  const args = process.argv.slice(2);
  const seeds = args.filter(arg => !arg.startsWith("--")).map(Number);
  const frame = Number(args.find(arg => arg.startsWith("--frame="))?.split("=")[1] || 60);
  const label = args.find(arg => arg.startsWith("--label="))?.split("=")[1] || "baseline";
  (async () => { for (const seed of seeds.length ? seeds : [13]) await run(seed, label, () => {}, frame); })()
    .catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { run, initial, write, describe, nm, pair, eventKey, OUT };
