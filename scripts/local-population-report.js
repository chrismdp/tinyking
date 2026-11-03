/* eslint-disable no-undef */
// Inspect existing seed-13 exports. This script never generates a world.
require("./game-register");
const fs = require("fs"), v8 = require("v8");
const { WorldHex } = require("../src/game/hex");
const { attachPeople, PERSON_COMPONENTS } = require("../src/game/person_storage");
const { bindNewsContext } = require("../src/game/event_knowledge");
const { knownEvents } = require("../src/game/events");
const size = value => value === undefined ? 0 : v8.serialize(value).byteLength;
const coordinate = key => Object.fromEntries(key.split(",").map((n, i) => [i ? "y" : "x", Number(n)]));
const distance = (a, b) => WorldHex(coordinate(a)).distance(WorldHex(coordinate(b)));
const label = process.argv[2];
const history = v8.deserialize(fs.readFileSync("shots/regress-history-" + label + ".v8"));
const game = v8.deserialize(fs.readFileSync("shots/regress-game-" + label + ".v8"));
const j = history.travel, events = Object.values(j.events), people = Object.entries(j.people);
attachPeople(history, j); bindNewsContext(history, j);
const types = {}, statuses = {}, travellers = new Set(), allMovers = new Set(), beyond = new Set(), displacedBeyond = new Set();
const marriages = { village: 0, hex: 0, adjacent: 0, distant: 0, unknown: 0 }, origins = new Map();
for (const [id] of people) {
  const match = /^w(-?\d+)_(-?\d+)-/.exec(id);
  if (match) origins.set(id, match[1] + "," + match[2]);
}
for (const event of events) {
  types[event.type] = (types[event.type] || 0) + 1;
  const status = event.awareness?.status || "legacy"; statuses[status] = (statuses[status] || 0) + 1;
  if (event.type === "departure") for (const id of event.people) travellers.add(id);
  if (["departure", "world_move"].includes(event.type)) for (const id of event.people) allMovers.add(id);
  if (["departure", "world_visit", "world_move"].includes(event.type) && event.toWorld) for (const id of event.people) {
    const from = origins.get(id) || event.fromWorld;
    if (from && distance(from, event.toWorld) > 1) displacedBeyond.add(id);
  }
  if (event.type === "marriage") {
    const [a, b] = event.fromVillages || [event.villageId, event.villageId];
    const from = j.villages[a]?.worldKey, to = j.villages[b]?.worldKey;
    marriages[a === b ? "village" : !from || !to ? "unknown" : from === to ? "hex" : distance(from, to) === 1 ? "adjacent" : "distant"]++;
  }
}
for (const id of displacedBeyond) if (travellers.has(id)) beyond.add(id);
let bonds = 0, crossHexBonds = 0, knownAssociations = 0;
const location = id => j.locations?.[id] || j.villages[j.people[id]?.village?.villageId]?.worldKey;
for (const [id, person] of people) {
  const others = Object.keys(person.relationships?.known || {}); bonds += others.length;
  for (const other of others) if (location(id) && location(other) && location(id) !== location(other)) crossHexBonds++;
  knownAssociations += knownEvents(history, id).length;
}
const canonical = { foreignPeople: [], duplicateResidents: [], aliasMismatches: [], perPersonEventIds: 0, redrawQueues: 0, preparedPersonRecords: 0, sharedKnowledge: true };
const owners = new Map();
for (const [key, map] of Object.entries(game.travel.maps)) {
  canonical.sharedKnowledge &&= map.knowledge === game.travel.knowledge;
  if (map.redraws?.length) canonical.redrawQueues++;
  for (const id of Object.keys(map.ecs.personable || {})) {
    if (!map.residents[id]) canonical.foreignPeople.push({ key, id });
    if (owners.has(id)) canonical.duplicateResidents.push({ id, keys: [owners.get(id), key] });
    owners.set(id, key);
    for (const component of PERSON_COMPONENTS) if (map.ecs[component]?.[id] && map.ecs[component][id] !== game.travel.people[id]?.[component]) canonical.aliasMismatches.push({ key, id, component });
  }
}
for (const knowledge of Object.values(game.travel.knowledge)) canonical.perPersonEventIds += knowledge.events?.length || 0;
for (const map of Object.values(game.travel.preparedMaps || {})) for (const table of Object.values(map.ecs))
  if (table && typeof table === "object") for (const id of Object.keys(table)) if (game.travel.people[id]) canonical.preparedPersonRecords++;
const memory = { maps: size(game.travel.maps), knowledge: size(game.travel.knowledge), worldHistory: size(game.worldHistory), events: size(game.travel.events), people: size(game.travel.people), preparedMaps: size(game.travel.preparedMaps), activeEcs: size(game.ecs), complete: size(game) };
const report = { label, demographics: { people: people.length, living: people.filter(([, p]) => !p.personable.dead && !p.personable.offMap).length,
  types, statuses, marriages, travellers: travellers.size, allMovers: allMovers.size, travellersBeyondAdjacent: beyond.size, allDisplacedBeyondAdjacent: displacedBeyond.size,
  bonds, crossHexBonds, knownAssociations, explicitKnowers: events.reduce((n, e) => n + (e.awareness?.knowers.length || 0), 0) }, memory, canonical };
fs.writeFileSync("shots/" + label + "-state.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (canonical.foreignPeople.length || canonical.duplicateResidents.length || canonical.aliasMismatches.length || canonical.perPersonEventIds || canonical.redrawQueues || canonical.preparedPersonRecords || !canonical.sharedKnowledge) process.exitCode = 1;
