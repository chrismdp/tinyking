import { Hex } from "game/hex";
// No map, renderer, DOM or pathfinding imports: also runs on an unvisited world hex.
import MersenneTwister from "mersenne-twister";
import { addGoodwill, disposition, generatePersonality, meet, TRAIT_PAIRS, copyRelationshipList, drift, peopleInRings, withRelationshipIndex } from "game/people";
import { hashUnit } from "game/math";
import { recordEvent, closeFamily, withEventIndex, invalidateEventIndex } from "game/events";
import { die, repairHouseholds } from "game/possessions";

export const SOCIAL_RATES = { birthPerSeason: 0.55, oldDeathPerSeason: 0.02, courtshipSeasons: 2, childYears: 2, adultYearsPerGameYear: 2 };
const alive = (s, id) => s.ecs.personable[id] && !s.ecs.personable[id].dead;
const roll = (s, key) => hashUnit(s.peopleSeed + ":social:" + key);
const living = s => Object.keys(s.ecs.personable).filter(id => alive(s, id) && !s.ecs.playable?.[id]);
const distance = (s, a, b) => {
  const p = s.ecs.spatial?.[a], q = s.ecs.spatial?.[b];
  return p && q ? (p.x - q.x) ** 2 + (p.y - q.y) ** 2 : Infinity;
};
const add = (s, components) => {
  const id = "social-" + s.ecs.nextId++;
  for (const [key, value] of Object.entries(components)) (s.ecs[key] ||= {})[id] = { ...value, id };
  if (components.spatial?.immovable && s.space) {
    const key = Hex().fromPoint(components.spatial).toString();
    s.space[key] = [...(s.space[key] || []), id];
  }
  s.redraws?.push(id);
  return id;
};

const ancestryCache = new WeakMap();
export function related(s, a, b) {
  if (!ancestryCache.has(s)) ancestryCache.set(s, new Map());
  const cache = ancestryCache.get(s);
  const ancestors = id => {
    if (cache.has(id)) return cache.get(id);
    const root = id;
    const result = new Set(), queue = [[id, 0]];
    for (const [id, depth] of queue) if (depth < 2) for (const p of s.ecs.kinship[id]?.parents || []) {
      result.add(p); queue.push([p, depth + 1]);
    }
    cache.set(root, result);
    return result;
  };
  const aa = ancestors(a), bb = ancestors(b);
  if (aa.has(b) || bb.has(a)) return true;
  for (const p of aa) if (bb.has(p)) return true;
  return false;
}

const affinityCache = new WeakMap();
function mutualAttraction(s, a, b) {
  if (!affinityCache.has(s.opinionThresholds)) affinityCache.set(s.opinionThresholds, new Map());
  const cache = affinityCache.get(s.opinionThresholds);
  if (!cache.has(a)) cache.set(a, new Map());
  const list = cache.get(a);
  if (!list.has(b)) list.set(b, disposition(s, a, b) == "love" && disposition(s, b, a) == "love" && !related(s, a, b));
  return list.get(b);
}

// Eligibility is local-map wide. This does not imply attraction or consent.
export function eligiblePartner(s, a, b) {
  return a != b && alive(s, a) && alive(s, b) && !s.ecs.playable?.[a] && !s.ecs.playable?.[b] &&
    s.ecs.personable[a].age >= 18 && s.ecs.personable[b].age >= 18 &&
    (!s.ecs.kinship[a]?.spouse || !alive(s, s.ecs.kinship[a].spouse)) &&
    (!s.ecs.kinship[b]?.spouse || !alive(s, s.ecs.kinship[b].spouse)) && !related(s, a, b);
}
export const eligiblePartners = (s, a) => living(s).filter(b => eligiblePartner(s, a, b));
export const romanticInterest = (s, a, b) => eligiblePartner(s, a, b) && mutualAttraction(s, a, b);
export function compareSocial(s, a, b, c) {
  return Number(romanticInterest(s, a, c)) - Number(romanticInterest(s, a, b)) ||
    (s.ecs.relationships[a].known[c]?.goodwill || 0) - (s.ecs.relationships[a].known[b]?.goodwill || 0);
}

export function canCourt(s, a, b) {
  return s.ecs.relationships?.[a]?.known[b]?.ring == "intimate" && s.ecs.relationships?.[b]?.known[a]?.ring == "intimate" && eligiblePartner(s, a, b);
}

// Empty does not mean ownerless: an inherited estate may have an absentee owner.
export function availableHouse(s, houseId, people = []) {
  const owner = s.ecs.controllable?.[houseId]?.controllerId;
  return !owner || owner == houseId || !alive(s, owner) || people.includes(owner);
}

function familyHomeAvailable(s, houseId, people) {
  const owner = s.ecs.controllable?.[houseId]?.controllerId;
  return availableHouse(s, houseId, people) || people.some(id => closeFamily(s, owner).includes(id));
}

export function moveHouse(s, id, houseId, summary = false) {
  const fromHouse = s.ecs.household[id]?.houseId, fromVillage = s.ecs.village[id]?.villageId;
  if (fromHouse == houseId) return;
  if (availableHouse(s, houseId, [id])) s.ecs.controllable[houseId].controllerId = id;
  s.ecs.household[id] = { id, houseId };
  s.ecs.village[id] = { ...s.ecs.village[id], id, villageId: s.ecs.village[houseId]?.villageId || s.ecs.village[id]?.villageId };
  invalidateEventIndex(s);
  const w = s.ecs.planner?.[id]?.world;
  if (w) {
    w.places = {}; w.no_place_for = {}; delete w.social;
    s.ecs.planner[id].task = null; s.ecs.planner[id].plan = null;
    for (const farm of Object.values(s.ecs.farmable || {})) {
      if (farm.claimerId == id) farm.claimerId = null;
      for (const slot of farm.slots) if (slot.workerId == id) delete slot.workerId;
    }
    delete w.helpingFriend; delete w.friendOffer;
    w.claimedFarmable = null; w.currentJob = null; w.subtasks = null; w.moveHome = houseId;
    for (const bed of Object.values(s.ecs.sleepable || {})) bed.occupiers = bed.occupiers.filter(p => p != id);
    for (const manager of Object.values(s.ecs.manager || {})) for (const job of manager.jobs) if (job.assignedId == id) job.assignedId = null;
  }
  if (summary && s.ecs.spatial[houseId]) s.ecs.spatial[id] = { ...s.ecs.spatial[id], x: s.ecs.spatial[houseId].x, y: s.ecs.spatial[houseId].y };
  recordEvent(s, "move", [id], [], { fromHouse, toHouse: houseId, fromVillage, toVillage: s.ecs.village[id].villageId });
}

function coupleHouse(s, a, b, dependents = []) {
  const ecs = s.ecs, village = s.villages?.[ecs.village[a]?.villageId];
  const counts = {}, excluded = new Set([a, b, ...dependents]);
  for (const id of living(s)) if (!excluded.has(id)) { const house = ecs.household[id]?.houseId; counts[house] = (counts[house] || 0) + 1; }
  const members = house => counts[house] || 0;
  const family = [...new Set([ecs.household[a]?.houseId, ecs.household[b]?.houseId])].filter(Boolean);
  const room = family.find(id => members(id) <= 4 - dependents.length && (members(id) > 0 || availableHouse(s, id, [a, b])));
  if (room) return room;
  const villageHomes = [...new Set([...(village?.houses || []), ...(s.villages?.[ecs.village[b]?.villageId]?.houses || []),
    ...Object.keys(ecs.building || {}).filter(id => [a, b].includes(ecs.controllable[id]?.controllerId))])];
  const empty = villageHomes.find(id => members(id) == 0 && familyHomeAvailable(s, id, [a, b]));
  if (empty) return empty;
  if (!village || village.houses.length >= 8) return null;
  // A summary world can provide build sites as plain coordinates. Rendered worlds
  // derive them from reachable village grassland, outside existing plots.
  const sites = s.houseSites?.[village.id] || Object.keys(ecs.walkable || {}).filter(id =>
    ecs.mappable[id]?.terrain == "grassland" && !ecs.mappable[id].villagePlot &&
    distance(s, id, a) < 600 ** 2 && !Object.keys(ecs.building).some(h => distance(s, id, h) < 150 ** 2))
    .map(id => ecs.spatial[id]);
  const point = sites.find(p => !Object.keys(ecs.building).some(id =>
    (ecs.spatial[id].x - p.x) ** 2 + (ecs.spatial[id].y - p.y) ** 2 < 150 ** 2));
  if (!point) return null;
  const tile = Object.keys(ecs.mappable || {}).find(id => Math.abs(ecs.spatial[id].x - point.x) < 0.1 && Math.abs(ecs.spatial[id].y - point.y) < 0.1);
  if (tile) ecs.mappable[tile] = { ...ecs.mappable[tile], villagePlot: true };
  const house = add(s, { spatial: { ...point, immovable: true }, nameable: { nickname: "Family cottage" },
    building: { entrance: 0, rooms: [] }, household: { farming: false, fields: [], backyards: [] },
    controllable: { controllerId: a }, village: { villageId: village.id } });
  const bed = add(s, { spatial: { ...point }, sleepable: { capacity: 6, level: 1, occupiers: [] }, interior: { buildingId: house }, controllable: { controllerId: house } });
  const store = add(s, { spatial: { ...point }, container: { capacity: 114, amounts: {} }, interior: { buildingId: house }, controllable: { controllerId: house } });
  ecs.building[house].rooms = [bed, store]; ecs.household[house].storeId = store;
  village.houses.push(house);
  return house;
}

export function marry(s, a, b, summary = false) {
  if (!canCourt(s, a, b)) return false;
  const dependents = [...new Set([a, b].flatMap(id => s.ecs.kinship[id].children))].filter(id => alive(s, id) &&
    s.ecs.personable[id].age < 18 && [s.ecs.household[a]?.houseId, s.ecs.household[b]?.houseId].includes(s.ecs.household[id]?.houseId));
  if (dependents.length > 4) return false;
  const house = coupleHouse(s, a, b, dependents);
  if (!house) return false;
  // Retain previous spouses in event history; current spouse links are reciprocal.
  for (const id of [a, b]) {
    const old = s.ecs.kinship[id].spouse;
    if (old) s.ecs.kinship[old].spouse = null;
  }
  s.ecs.kinship[a].spouse = b; s.ecs.kinship[b].spouse = a;
  const fromVillages = [s.ecs.village[a]?.villageId, s.ecs.village[b]?.villageId];
  for (const id of [a, b, ...dependents]) moveHouse(s, id, house, summary);
  recordEvent(s, "marriage", [a, b], [], { fromVillages, houseId: house });
  repairHouseholds(s);
  return true;
}

export function birth(s, a, b, season) {
  const ecs = s.ecs, generator = new MersenneTwister(Math.floor(roll(s, "child:" + a + ":" + season) * 4294967296));
  const personality = generatePersonality(generator);
  // Keep opposed traits out and distinct tastes; inherit one pair and one taste set.
  const trait = ecs.personality[a].traits[generator.random_int() % ecs.personality[a].traits.length];
  const pair = TRAIT_PAIRS.find(p => p.includes(trait));
  personality.traits = [trait, ...personality.traits.filter(t => !pair.includes(t))].slice(0, 3);
  personality.likes = [...ecs.personality[b].likes]; personality.dislikes = [...ecs.personality[b].dislikes];
  const male = generator.random_int() % 2 == 0;
  const child = add(s, {
    spatial: { ...ecs.spatial[a], immovable: false },
    nameable: { type: "person", male, familySeed: ecs.nameable[a]?.familySeed, seed: generator.random_int() },
    personable: { age: 0, lifeYears: 0, born: season * 3, size: 12, male, body: male ? 0x4E3F30 : 0x3B6071, hair: ecs.personable[a].hair || 0, hunger: 0, tiredness: 0 },
    kinship: { parents: [a, b], children: [], spouse: null }, personality,
    household: { houseId: ecs.household[a]?.houseId }, village: { villageId: ecs.village[a]?.villageId },
    controllable: { controllerId: ecs.controllable[a]?.controllerId || a }, traits: { values: {} }, attributes: {},
    holder: { held: [], capacity: 2 }, relationships: { known: {} }, manager: { jobs: [] },
    planner: { world: { no_place_for: {}, jobs: [], places: {}, feeling: {}, holding: {}, days: s.days } }
  });
  invalidateEventIndex(s);
  for (const p of [a, b]) { ecs.kinship[p].children.push(child); ecs.personable[p].lastBirth = season; }
  for (const other of living(s)) if (other != child && ecs.village[other]?.villageId == ecs.village[child].villageId) {
    meet(s, child, other); meet(s, other, child);
    if ([a, b].includes(other)) { addGoodwill(s, child, other, 36); addGoodwill(s, other, child, 36); }
  }
  recordEvent(s, "birth", [child, a, b]);
  return child;
}

export function chatTogether(s, a, b, summary = false, conversations = 1) {
  if (!alive(s, a) || !alive(s, b) || !summary && distance(s, a, b) > 85 ** 2) return false;
  s.social ||= { courtships: {}, avoidance: {} };
  s.social.avoidance ||= {};
  const key = (a < b ? a + ":" + b : b + ":" + a), until = s.social.avoidance[key];
  if (until > s.days) return false;
  if (until && until <= s.days) {
    delete s.social.avoidance[key];
    recordEvent(s, "reconciliation", [a, b]);
  }
  s.social.contacts ||= {}; s.social.contacts[key] = s.days;
  const hostile = disposition(s, a, b) == "hate" || disposition(s, b, a) == "hate";
  if (summary && hostile) conversations = 1;
  if (hostile && roll(s, "quarrel:" + key + ":" + Math.floor(s.days)) < 1 - 0.88 ** conversations) {
    addGoodwill(s, a, b, -6); addGoodwill(s, b, a, -6);
    s.social.avoidance[key] = s.days + 3;
    recordEvent(s, "quarrel", [a, b]);
    return true;
  }
  for (const [from, to] of [[a, b], [b, a]]) addGoodwill(s, from, to, { hate: -0.25, like: 1, love: 4 }[disposition(s, to, from)] * conversations);
  return true;
}

// Grown children leave crowded homes when a local house is empty. This gives
// families access to the village's existing fields instead of crowding one plot.
function settleAdults(s, summary) {
  const ecs = s.ecs, roster = living(s), residents = {};
  for (const id of roster) (residents[ecs.household?.[id]?.houseId] ||= []).push(id);
  const members = house => residents[house] || [];
  for (const village of Object.values(s.villages || {})) {
    for (const house of village.houses || []) {
      if (members(house).length) continue;
      const candidates = roster.filter(id => familyHomeAvailable(s, house, [id, ecs.kinship[id]?.spouse]) && ecs.personable[id].age >= 18 &&
        ecs.kinship[id]?.parents.length && ecs.controllable[ecs.household[id]?.houseId]?.controllerId != id &&
        members(ecs.household[id]?.houseId).length > 2).sort((a, b) => ecs.personable[a].age - ecs.personable[b].age || a.localeCompare(b));
      for (const id of candidates) {
        const from = ecs.household[id].houseId, spouse = ecs.kinship[id].spouse;
        const family = [id];
        if (alive(s, spouse) && ecs.household[spouse]?.houseId == from) family.push(spouse);
        family.push(...ecs.kinship[id].children.filter(child => alive(s, child) && ecs.personable[child].age < 18 && ecs.household[child]?.houseId == from));
        if (members(from).length - family.length < 2) continue;
        for (const person of family) moveHouse(s, person, house, summary);
        residents[from] = members(from).filter(id => !family.includes(id)); residents[house] = family;
        break;
      }
    }
  }
}

// Live play and summary history share every demographic transition. Only
// summary encounters stand in for navigation and timed conversations.
export function advanceSeason(s, season, summary = false) {
  return withEventIndex(s, () => withRelationshipIndex(s, () => advanceSeasonRules(s, season, summary)));
}

function advanceSeasonRules(s, season, summary) {
  s.social ||= {}; s.social.courtships ||= {}; s.social.avoidance ||= {};
  const ecs = s.ecs, ids = living(s).filter(id => ecs.kinship?.[id] && ecs.relationships?.[id] && ecs.personality?.[id]);
  for (const key of Object.keys(s.social.courtships)) {
    const [a, b] = key.split(":");
    // Absence is already priced by drift. Keep time spent mutually Intimate;
    // a recent real conversation is still required before a live wedding.
    if (!canCourt(s, a, b)) delete s.social.courtships[key];
  }
  for (const id of ids) {
    const p = ecs.personable[id];
    p.lifeYears = (p.lifeYears ?? (p.age < 18 ? p.age / 9 : 2 + (p.age - 18) / SOCIAL_RATES.adultYearsPerGameYear)) + 0.25;
    p.age = Math.floor(p.lifeYears < 2 ? p.lifeYears * 9 : 18 + (p.lifeYears - 2) * SOCIAL_RATES.adultYearsPerGameYear);
    p.size = p.age < 18 ? 12 : 20;
    s.redraws?.push(id);
    if (p.age >= 60 && roll(s, "death:" + id + ":" + season) < SOCIAL_RATES.oldDeathPerSeason * (1 + (p.age - 60) / 12) || p.age >= 88) die(s, id);
  }
  settleAdults(s, summary);
  const roster = ids.filter(id => alive(s, id));
  if (summary) {
    const singles = new Set(roster.filter(id => ecs.personable[id].age >= 18 && (!ecs.kinship[id].spouse || !alive(s, ecs.kinship[id].spouse))));
    const byVillage = new Map(), live = new Set(roster);
    for (const id of roster) {
      const village = ecs.village[id]?.villageId;
      if (!byVillage.has(village)) byVillage.set(village, []);
      byVillage.get(village).push(id);
    }
    const avoiding = new Map();
    for (const key of Object.keys(s.social.avoidance)) if (s.social.avoidance[key] > s.days) {
      const [a, b] = key.split(":");
      if (!avoiding.has(a)) avoiding.set(a, new Set());
      if (!avoiding.has(b)) avoiding.set(b, new Set());
      avoiding.get(a).add(b); avoiding.get(b).add(a);
    }
    // Only paired people change avoidance during this pass, and both have
    // already left the candidate pool before their conversation starts.
    const paired = new Set();
    const order = roster.map(id => ({ id, order: roll(s, season + ":order:" + id) })).sort((a, b) => Number(singles.has(b.id)) - Number(singles.has(a.id)) || a.order - b.order).map(p => p.id);
    for (const a of order) {
      if (paired.has(a)) continue;
      const locals = byVillage.get(ecs.village[a]?.villageId) || [];
      const known = ecs.relationships[a].known, seekingPartner = singles.has(a);
      const localOrFriend = new Set(locals);
      for (const id of peopleInRings(s, a, ["social", "personal", "intimate"])) if (live.has(id)) localOrFriend.add(id);
      const avoided = avoiding.get(a);
      let b, best = -Infinity, bestInterest = false;
      for (const pool of seekingPartner ? [localOrFriend, singles] : [localOrFriend]) for (const id of pool) {
        const local = localOrFriend.has(id);
        if (pool == singles && local) continue;
        if (id == a || paired.has(id)) continue;
        if (avoided?.has(id)) continue;
        const seeking = seekingPartner && singles.has(id) && !related(s, a, id);
        if (!local && !seeking) continue;
        const interest = seeking && mutualAttraction(s, a, id), score = known[id]?.goodwill || 0;
        if (interest && !bestInterest || interest == bestInterest && (score > best || score == best && id.localeCompare(b) < 0)) { b = id; best = score; bestInterest = interest; }
      }
      if (!b) continue;
      paired.add(a); paired.add(b);
      if (ecs.village[a]?.villageId != ecs.village[b]?.villageId) recordEvent(s, "visit", [a, b], [], { fromVillage: ecs.village[a]?.villageId, toVillage: ecs.village[b]?.villageId, summary: true });
      chatTogether(s, a, b, true, 6);
    }
  }
  const used = new Set();
  for (const a of roster) {
    for (const b of peopleInRings(s, a, ["intimate"])) if (a < b && !used.has(a) && !used.has(b) && canCourt(s, a, b) && (summary || (s.social.contacts?.[a + ":" + b] ?? -Infinity) >= s.days - 3)) {
      const key = a + ":" + b;
      const started = s.social.courtships[key] ?? season;
      s.social.courtships[key] = started;
      if (season - started >= SOCIAL_RATES.courtshipSeasons && marry(s, a, b, summary)) { used.add(a); used.add(b); }
    }
  }
  for (const villageId of Object.keys(s.villages || {})) {
    const locals = roster.filter(id => ecs.village[id]?.villageId == villageId);
    const target = (s.villages[villageId].houses?.length || 3) * 3;
    const fertility = Math.min(2, Math.max(0.2, target / Math.max(1, locals.length)));
    const occupants = new Map();
    for (const id of locals) { const house = ecs.household[id]?.houseId; occupants.set(house, (occupants.get(house) || 0) + 1); }
    for (const a of locals) {
      const b = ecs.kinship[a].spouse, p = ecs.personable[a];
      if (!b || a > b || !alive(s, b) || ecs.playable?.[b] || p.age < 18 || p.age > 55 || ecs.personable[b].age > 55) continue;
      const house = ecs.household[a]?.houseId;
      if ((occupants.get(house) || 0) >= 6) continue;
      if (season - (p.lastBirth ?? -10000) < 4) continue;
      if (roll(s, "birth:" + a + ":" + season) < SOCIAL_RATES.birthPerSeason * fertility) {
        birth(s, a, b, season); occupants.set(house, (occupants.get(house) || 0) + 1);
      }
    }
  }
  repairHouseholds(s);
  s.social.lastSeason = season;
}

export function historyStep(worldHexState, season) {
  // Events, names and geography are immutable. Copy only the records this step
  // can change; a forty-five-year history must not recopy the map or old events.
  const copy = { ...worldHexState, ecs: Object.fromEntries(Object.entries(worldHexState.ecs).map(([key, value]) => [key, typeof value == "object" ? { ...value } : value])),
    events: [...(worldHexState.events || [])], knowledge: {}, villages: {}, space: { ...(worldHexState.space || {}) }, redraws: [...(worldHexState.redraws || [])],
    social: JSON.parse(JSON.stringify(worldHexState.social || {})) };
  const records = (key, clone = value => ({ ...value })) => {
    copy.ecs[key] = Object.fromEntries(Object.entries(worldHexState.ecs[key] || {}).map(([id, value]) => [id, clone(value, id)]));
  };
  records("personable"); records("controllable"); records("household"); records("profession");
  records("kinship", k => ({ ...k, parents: [...k.parents], children: [...k.children] }));
  records("relationships", (r, id) => worldHexState.ecs.personable[id]?.dead ? r :
    ({ ...r, known: copyRelationshipList(r.known) }));
  records("possession", p => ({ ...p, owners: [...p.owners] }));
  records("planner", p => ({ ...p, world: { ...p.world } }));
  records("manager", m => ({ ...m, jobs: m.jobs.map(j => ({ ...j })) }));
  records("sleepable", b => ({ ...b, occupiers: [...b.occupiers] }));
  records("farmable", f => ({ ...f, slots: f.slots.map(slot => ({ ...slot })) })); records("building", b => ({ ...b, rooms: [...(b.rooms || [])] }));
  for (const [id, k] of Object.entries(worldHexState.knowledge || {})) copy.knowledge[id] = { ...k, events: [...(k.events || [])] };
  for (const [id, v] of Object.entries(worldHexState.villages || {})) copy.villages[id] = { ...v, houses: [...(v.houses || [])] };
  copy.days = season * 3;
  drift(copy, 72);
  advanceSeason(copy, season, true);
  return copy;
}
