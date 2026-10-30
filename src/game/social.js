import { Hex } from "game/hex";
// No map, renderer, DOM or pathfinding imports: also runs on an unvisited world hex.
import MersenneTwister from "mersenne-twister";
import { addGoodwill, disposition, generatePersonality, meet, TRAIT_PAIRS, copyRelationshipList, drift } from "game/people";
import { hashUnit } from "game/math";
import { recordEvent } from "game/events";
import { die, repairHouseholds } from "game/possessions";

export const SOCIAL_RATES = { birthPerSeason: 0.055, oldDeathPerSeason: 0.035, courtshipSeasons: 2, childYears: 2, adultYearsPerGameYear: 1 };
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
function related(s, a, b) {
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
  return aa.has(b) || bb.has(a) || [...aa].some(p => bb.has(p));
}

const affinityCache = new WeakMap();
function mutualAttraction(s, a, b) {
  if (!affinityCache.has(s)) affinityCache.set(s, new Map());
  const cache = affinityCache.get(s), key = [a, b].sort().join(":");
  if (!cache.has(key)) cache.set(key, disposition(s, a, b) == "love" && disposition(s, b, a) == "love" && !related(s, a, b));
  return cache.get(key);
}

function romanticInterest(s, a, b) {
  return a != b && s.ecs.personable[a].age >= 18 && s.ecs.personable[b].age >= 18 &&
    (!s.ecs.kinship[a].spouse || !alive(s, s.ecs.kinship[a].spouse)) &&
    (!s.ecs.kinship[b].spouse || !alive(s, s.ecs.kinship[b].spouse)) &&
    mutualAttraction(s, a, b);
}
const socialPreference = (s, a, b) => (romanticInterest(s, a, b) ? 200 : 0) + (s.ecs.relationships[a].known[b]?.goodwill || 0);

export function canCourt(s, a, b) {
  if (a == b || !alive(s, a) || !alive(s, b) || s.ecs.playable?.[a] || s.ecs.playable?.[b]) return false;
  return s.ecs.personable[a].age >= 18 && s.ecs.personable[b].age >= 18 &&
    (!s.ecs.kinship[a].spouse || !alive(s, s.ecs.kinship[a].spouse)) &&
    (!s.ecs.kinship[b].spouse || !alive(s, s.ecs.kinship[b].spouse)) &&
    s.ecs.village[a]?.villageId == s.ecs.village[b]?.villageId &&
    s.ecs.relationships[a]?.known[b]?.ring == "intimate" && s.ecs.relationships[b]?.known[a]?.ring == "intimate" && !related(s, a, b);
}

export function moveHouse(s, id, houseId) {
  const fromHouse = s.ecs.household[id]?.houseId;
  s.ecs.household[id] = { id, houseId };
  s.ecs.village[id] = { id, villageId: s.ecs.village[houseId]?.villageId || s.ecs.village[id]?.villageId };
  const w = s.ecs.planner?.[id]?.world;
  if (w) { w.places = {}; w.no_place_for = {}; delete w.social; }
  if (fromHouse != houseId) recordEvent(s, "move", [id], [], { fromHouse, toHouse: houseId });
}

function coupleHouse(s, a, b) {
  const ecs = s.ecs, village = s.villages?.[ecs.village[a]?.villageId];
  const members = house => living(s).filter(id => ecs.household[id]?.houseId == house && id != a && id != b).length;
  const family = [...new Set([ecs.household[a]?.houseId, ecs.household[b]?.houseId])].filter(Boolean);
  const room = family.find(id => members(id) <= 4);
  if (room) return room;
  const empty = village?.houses?.find(id => members(id) == 0);
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

export function marry(s, a, b) {
  if (!canCourt(s, a, b)) return false;
  const house = coupleHouse(s, a, b);
  if (!house) return false;
  // Retain previous spouses in event history; current spouse links are reciprocal.
  for (const id of [a, b]) {
    const old = s.ecs.kinship[id].spouse;
    if (old) s.ecs.kinship[old].spouse = null;
  }
  s.ecs.kinship[a].spouse = b; s.ecs.kinship[b].spouse = a;
  moveHouse(s, a, house); moveHouse(s, b, house);
  recordEvent(s, "marriage", [a, b]);
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
  const key = [a, b].sort().join(":"), until = s.social.avoidance[key];
  if (until > s.days) return false;
  if (until && until <= s.days) {
    delete s.social.avoidance[key];
    recordEvent(s, "reconciliation", [a, b]);
  }
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

// The shared seasonal demographic transition. Live play calls this on exactly
// the same boundaries; summary history substitutes abstract meetings for walking.
export function advanceSeason(s, season, summary = false) {
  s.social ||= {}; s.social.courtships ||= {}; s.social.avoidance ||= {};
  const ecs = s.ecs, ids = living(s);
  for (const key of Object.keys(s.social.courtships)) {
    const [a, b] = key.split(":");
    if (!canCourt(s, a, b)) delete s.social.courtships[key];
  }
  for (const id of ids) {
    const p = ecs.personable[id];
    p.lifeYears = (p.lifeYears ?? (p.age < 18 ? p.age / 9 : p.age - 16)) + 0.25;
    p.age = Math.floor(p.lifeYears < 2 ? p.lifeYears * 9 : 18 + p.lifeYears - 2);
    p.size = p.age < 18 ? 12 : 20;
    s.redraws?.push(id);
    if (p.age >= 60 && roll(s, "death:" + id + ":" + season) < SOCIAL_RATES.oldDeathPerSeason * (1 + (p.age - 60) / 12) || p.age >= 88) die(s, id);
  }
  for (const villageId of Object.keys(s.villages || {})) {
    const locals = ids.filter(id => alive(s, id) && ecs.village[id]?.villageId == villageId);
    if (summary) {
      // Rank candidates once per season. Re-sorting every unmatched roster for
      // every conversation made history cubic in village population.
      const preferences = new Map(locals.map(a => [a, locals.filter(b => b != a)
        .map(b => ({ id: b, score: socialPreference(s, a, b) }))
        .sort((b, c) => c.score - b.score || b.id.localeCompare(c.id)).map(b => b.id)]));
      // Six half-day conversations with a seasonal companion, summarized as
      // one contact with the equivalent goodwill and quarrel probability.
      const paired = new Set();
      const order = locals.map(id => ({ id, order: roll(s, season + ":order:" + id) })).sort((a, b) => a.order - b.order).map(p => p.id);
      for (const a of order) {
        if (paired.has(a)) continue;
        const b = preferences.get(a).find(b => !paired.has(b));
        if (!b) continue;
        paired.add(a); paired.add(b); chatTogether(s, a, b, true, 6);
      }
    }
    const used = new Set();
    for (const a of locals) for (const b of locals) if (a < b && !used.has(a) && !used.has(b) && canCourt(s, a, b)) {
      const key = a + ":" + b;
      const started = s.social.courtships[key] ?? season;
      s.social.courtships[key] = started;
      if (season - started >= SOCIAL_RATES.courtshipSeasons && marry(s, a, b)) { used.add(a); used.add(b); }
    }
    const target = (s.villages[villageId].houses?.length || 3) * 3;
    const fertility = Math.min(2, Math.max(0.2, target / Math.max(1, locals.length)));
    for (const a of locals) {
      const b = ecs.kinship[a].spouse, p = ecs.personable[a];
      if (!b || a > b || !alive(s, b) || ecs.playable?.[b] || p.age < 18 || p.age > 55 || ecs.personable[b].age > 55) continue;
      const house = ecs.household[a]?.houseId;
      if (locals.filter(id => ecs.household[id]?.houseId == house && ecs.personable[id].age < 18).length >= 2) continue;
      if (season - (p.lastBirth ?? -10000) < 12) continue;
      if (roll(s, "birth:" + a + ":" + season) < SOCIAL_RATES.birthPerSeason * fertility) birth(s, a, b, season);
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
  records("farmable"); records("building", b => ({ ...b, rooms: [...(b.rooms || [])] }));
  for (const [id, k] of Object.entries(worldHexState.knowledge || {})) copy.knowledge[id] = { ...k, events: [...(k.events || [])] };
  for (const [id, v] of Object.entries(worldHexState.villages || {})) copy.villages[id] = { ...v, houses: [...(v.houses || [])] };
  copy.days = season * 3;
  drift(copy, 72);
  advanceSeason(copy, season, true);
  return copy;
}

// Pick real nearby idle villagers for a visible, timed planner task. Needs and
// ordered jobs retain priority. Social intent is never a stale world.label.
export function socialHour(s) {
  const season = Math.floor(s.days / 3);
  s.social ||= { lastSeason: season, courtships: {}, avoidance: {} };
  if (s.social.lastSeason == null) s.social.lastSeason = season;
  while (s.social.lastSeason < season) advanceSeason(s, s.social.lastSeason + 1);
  for (const p of Object.values(s.ecs.planner || {})) if (p.task?.[0] != "socialise" && !(p.task?.[0] == "walk_to" && p.task[1] == p.world.social?.partnerId)) delete p.world.social;
  const hour = (s.days % 1) * 24;
  if (hour < 18 || hour >= 21) return;
  const ids = living(s).filter(id => {
    const p = s.ecs.planner[id], w = p?.world;
    return w && !w.ordered && !w.capturedBy && !w.feeling.hungry && !w.feeling.tired && !w.currentJob && !w.social &&
      ["wait_for", "socialise"].includes(p.task?.[0]);
  });
  const used = new Set();
  for (const a of ids) {
    if (used.has(a)) continue;
    const b = ids.filter(b => b != a && !used.has(b) && (distance(s, a, b) <= 85 ** 2 || distance(s, a, b) <= 600 ** 2 && romanticInterest(s, a, b)) &&
      !(s.social.avoidance?.[[a, b].sort().join(":")] > s.days)).sort((b, c) => socialPreference(s, a, c) - socialPreference(s, a, b) || distance(s, a, b) - distance(s, a, c))[0];
    if (!b) continue;
    used.add(a); used.add(b);
    const courting = canCourt(s, a, b);
    for (const [id, partnerId] of [[a, b], [b, a]]) {
      const p = s.ecs.planner[id]; p.world.social = { partnerId, courting };
      if (distance(s, id, partnerId) > 85 ** 2) {
        p.task = null; p.plan = [["walk_to", partnerId], ["socialise", partnerId]];
      } else { p.task = ["socialise", partnerId]; p.plan = []; }
      p.world.wait_until = s.days + 0.5 / 24;
    }
  }
}
