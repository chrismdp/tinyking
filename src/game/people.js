import { knownEvents, learnEvent } from "game/events";
import { topController } from "game/playable";

// Personality is separate from traits, which holds temporary physical states.
export const TRAIT_PAIRS = [
  ["hard-working", "lazy"], ["generous", "greedy"], ["proud", "humble"],
  ["pious", "worldly"], ["cheerful", "gloomy"], ["brave", "timid"]
];
export const ADULT_AGE = 18;

function draw(generator, values) {
  return values.splice(generator.random_int() % values.length, 1)[0];
}

export function generatePersonality(generator) {
  const pairs = [...TRAIT_PAIRS];
  const count = 2 + generator.random_int() % 2;
  const traits = Array.from({ length: count }, () => draw(generator, pairs)[generator.random_int() % 2]);
  const tastes = TRAIT_PAIRS.flat();
  const likes = Array.from({ length: 2 }, () => draw(generator, tastes));
  const dislikes = Array.from({ length: 2 }, () => draw(generator, tastes));
  return { traits, likes, dislikes };
}

export const RINGS = ["public", "social", "personal", "intimate"];
export const RING_CAPS = { intimate: 2, personal: 6, social: 10 };
export const GOODWILL_STEPS = [0, 10, 30, 60];
// A neglected bond loses 0.6 goodwill per day (1.8 per season).
// Sparse real visits must be able to accumulate the same contact as history.
export const DRIFT_PER_HOUR = 0.025;
const STARTING_BUFFER = 6;
const DISPOSITION_CAP = { hate: 0, like: 2, love: 3 };

function pairVariation(seed, a, b) {
  const text = seed + ":" + a + ":" + b;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85EBCA6B);
  hash = Math.imul(hash ^ (hash >>> 13), 0xC2B2AE35);
  return (((hash ^ (hash >>> 16)) >>> 0) / 4294967296 - 0.5) * 0.4;
}

export function opinion(state, a, b) {
  const tastes = state.ecs.personality[a];
  const traits = state.ecs.personality[b].traits;
  return traits.reduce((score, trait) => score + (tastes.likes.includes(trait) ? 1 : 0) -
    (tastes.dislikes.includes(trait) ? 1 : 0), 0) + pairVariation(state.peopleSeed, a, b);
}

export function disposition(state, a, b) {
  const score = opinion(state, a, b);
  if (score < state.opinionThresholds.hate) return "hate";
  if (score >= state.opinionThresholds.love) return "love";
  return "like";
}

function calibrateOpinions(state) {
  const ids = Object.keys(state.ecs.personality).filter(id => !state.ecs.personable[id]?.dead);
  const scores = [];
  for (const a of ids) for (const b of ids) if (a != b) scores.push(opinion(state, a, b));
  scores.sort((a, b) => a - b);
  const cut = fraction => {
    const index = Math.floor(scores.length * fraction);
    return scores.length ? (scores[Math.max(0, index - 1)] + scores[index]) / 2 : 0;
  };
  state.opinionThresholds = { hate: cut(0.2), love: cut(0.8) };
}

// Seasonal snapshots share untouched bond records. Only a written bond needs
// copying; live lists do not pay for this copy-on-write bookkeeping.
const sharedLists = new WeakSet();
export function copyRelationshipList(list) {
  const copy = {};
  for (const id in list) copy[id] = list[id];
  sharedLists.add(copy);
  return copy;
}
function writableBond(list, id) {
  if (sharedLists.has(list)) list[id] = { ...list[id] };
}

// Index only synchronous, owned transitions. Discard every index before callers
// regain access to their mutable records; generation can own all 180 seasons.
const relationshipScopes = new WeakMap(), relationshipIndexes = new WeakMap();
function indexList(state, list) {
  const scope = relationshipScopes.get(state);
  if (scope && !scope.has(list)) { scope.add(list); relationshipIndexes.set(list, {}); }
}
export function withRelationshipIndex(state, transition) {
  if (relationshipScopes.has(state)) return transition();
  const lists = new Set(); relationshipScopes.set(state, lists);
  for (const [id, r] of Object.entries(state.ecs.relationships || {})) if (!state.ecs.personable?.[id]?.dead) indexList(state, r.known);
  try { return transition(); }
  finally {
    for (const list of lists) relationshipIndexes.delete(list);
    relationshipScopes.delete(state);
  }
}
function relationshipIndex(list) {
  const index = relationshipIndexes.get(list);
  if (!index || index.members) return index;
  const keys = Object.keys(list);
  index.order = new Map(keys.map((id, n) => [id, n]));
  index.members = { social: new Set(), personal: new Set(), intimate: new Set() };
  index.contacts = []; index.active = new Set();
  for (const id of keys) {
    const bond = list[id];
    if (bond.ring != "public") { index.members[bond.ring].add(id); index.contacts.push(id); }
    if ((bond.goodwill || 0) != (bond.base || 0)) index.active.add(id);
  }
  return index;
}
const inKeyOrder = (index, ids) => [...ids].sort((a, b) => index.order.get(a) - index.order.get(b));
export function peopleInRings(state, id, rings) {
  const list = state.ecs.relationships[id]?.known || {}, index = relationshipIndex(list);
  if (!index) return Object.keys(list).filter(id => rings.includes(list[id].ring));
  if (rings.length == 1) return inKeyOrder(index, index.members[rings[0]]);
  return index.contacts.filter(id => rings.includes(list[id].ring));
}

// Only the incoming member is protected. Displacement can cascade outwards,
// but never changes goodwill or the other person's view of this relationship.
function moveTo(list, id, rank) {
  const ring = RINGS[rank], previous = list[id].ring, cached = relationshipIndexes.get(list);
  writableBond(list, id);
  list[id].ring = ring;
  if (cached?.members && previous != ring) {
    cached.members[previous]?.delete(id); cached.members[ring]?.add(id);
    if (previous == "public") {
      const at = cached.contacts.findIndex(other => cached.order.get(other) > cached.order.get(id));
      cached.contacts.splice(at < 0 ? cached.contacts.length : at, 0, id);
    } else if (ring == "public") cached.contacts.splice(cached.contacts.indexOf(id), 1);
  }
  const cap = RING_CAPS[ring];
  if (!cap) return;
  const index = relationshipIndex(list);
  if (index && index.members[ring].size <= cap) return;
  const members = index ? inKeyOrder(index, index.members[ring]) : Object.keys(list).filter(other => list[other].ring == ring);
  if (members.length <= cap) return;
  const lowest = members.filter(other => other != id).reduce((a, b) =>
    list[a].goodwill <= list[b].goodwill ? a : b);
  moveTo(list, lowest, rank - 1);
}

function goodwillRank(goodwill) {
  for (let rank = GOODWILL_STEPS.length - 1; rank > 0; rank--) {
    if (goodwill >= GOODWILL_STEPS[rank]) return rank;
  }
  return 0;
}

export function meet(state, a, b) {
  if (a == b) return;
  const list = state.ecs.relationships[a].known;
  indexList(state, list);
  if (list[b]) return;
  const rank = disposition(state, a, b) == "love" ? 1 : 0;
  const goodwill = rank ? GOODWILL_STEPS[rank] + STARTING_BUFFER : 0;
  list[b] = { ring: "public", goodwill, base: goodwill };
  const cached = relationshipIndexes.get(list);
  if (cached) cached.members = null;
  moveTo(list, b, rank);
}

export function addGoodwill(state, from, to, amount) {
  if (from == to) return;
  meet(state, to, from);
  const list = state.ecs.relationships[to].known;
  writableBond(list, from);
  const bond = list[from];
  bond.goodwill += amount;
  const cached = relationshipIndexes.get(list);
  if (cached?.members) {
    if ((bond.goodwill || 0) != (bond.base || 0)) cached.active.add(from);
    else cached.active.delete(from);
  }
  const eligible = Math.min(goodwillRank(bond.goodwill), DISPOSITION_CAP[disposition(state, to, from)]);
  const rank = amount > 0 ? eligible : Math.min(RINGS.indexOf(bond.ring), eligible);
  moveTo(list, from, rank);
}

export function drift(state, hours) {
  if (hours <= 0) return;
  const people = state.ecs.personable;
  for (const [personId, { known: list }] of Object.entries(state.ecs.relationships || {})) {
    if (people?.[personId]?.dead) continue;
    const index = relationshipIndex(list);
    for (const id of index ? inKeyOrder(index, index.active) : Object.keys(list)) {
      let bond = list[id];
      if ((bond.goodwill || 0) == (bond.base || 0)) continue;
      writableBond(list, id); bond = list[id];
      // NOTE: a bond settles back to where it started, so family stays close
      // and only goodwill earned or lost since then fades
      const base = bond.base || 0;
      const remaining = Math.max(0, Math.abs(bond.goodwill - base) - hours * DRIFT_PER_HOUR);
      bond.goodwill = base + (remaining ? Math.sign(bond.goodwill - base) * remaining : 0);
      if (index && bond.goodwill == base) index.active.delete(id);
      // Decay never promotes someone displaced from a full ring.
      const rank = Math.min(RINGS.indexOf(bond.ring), goodwillRank(bond.goodwill));
      if (rank < RINGS.indexOf(bond.ring)) moveTo(list, id, rank);
    }
  }
}

export function siblingsOf(state, id) {
  return [...new Set(state.ecs.kinship[id].parents.flatMap(parent => state.ecs.kinship[parent].children))]
    .filter(other => other != id);
}

export function initializeRelationships(state, seed) {
  state.peopleSeed = seed;
  calibrateOpinions(state);
  state.ecs.relationships = {};
  const villagers = {};
  for (const id in state.ecs.personality) {
    state.ecs.relationships[id] = { id, known: {} };
    const village = state.ecs.village[id].villageId;
    if (village) (villagers[village] ||= []).push(id);
  }
  for (const ids of Object.values(villagers)) {
    for (const id of ids) {
      const kin = state.ecs.kinship[id];
      const personal = new Set([...kin.parents, ...siblingsOf(state, id), ...kin.children]);
      const intimate = new Set([kin.spouse, ...kin.children.filter(child => state.ecs.personable[child].age < ADULT_AGE)]);
      const list = state.ecs.relationships[id].known;
      // Neighbours first, then kin: a family bond takes a slot from a neighbour.
      const neighbours = ids.filter(other => other != id).sort((a, b) =>
        (intimate.has(a) ? 2 : personal.has(a) ? 1 : 0) - (intimate.has(b) ? 2 : personal.has(b) ? 1 : 0));
      for (const other of neighbours) {
        const feeling = disposition(state, id, other);
        const preferred = intimate.has(other) ? 3 : personal.has(other) ? 2 : feeling == "love" ? 1 : 0;
        const rank = Math.min(preferred, DISPOSITION_CAP[feeling]);
        const goodwill = rank ? GOODWILL_STEPS[rank] + STARTING_BUFFER : 0;
        list[other] = { ring: "public", goodwill, base: goodwill };
        moveTo(list, other, rank);
      }
    }
  }
}

// Keep the earned history when setting the arriving population's quantiles.
export function recalibrateRelationships(state) {
  calibrateOpinions(state);
  for (const [id, r] of Object.entries(state.ecs.relationships)) {
    if (state.ecs.personable[id]?.dead) continue;
    for (const other of Object.keys(r.known)) {
      const allowed = DISPOSITION_CAP[disposition(state, id, other)];
      if (RINGS.indexOf(r.known[other].ring) > allowed) moveTo(r.known, other, allowed);
    }
  }
}

export function feelingHint(state, a, aboutId) {
  const bond = state.ecs.relationships[a].known[aboutId];
  const feeling = disposition(state, a, aboutId);
  if (bond && bond.ring != "public") return { ring: bond.ring, disposition: feeling };
  const goodwill = bond ? bond.goodwill : 0;
  const hint = goodwill < 0 || feeling == "hate" ? "cool" : goodwill > 0 || feeling == "love" ? "warm" : "polite";
  return { hint };
}

// A flat graph keeps shared ancestors and marriages from duplicating people.
// Unknown nodes keep their links through opaque local ids, without identifying data.
export function knownFamilyTree(state, viewerId, personId) {
  const kinship = state.ecs.kinship;
  const selected = new Set([personId]);
  const follow = (id, field, depth) => {
    if (!depth) return;
    for (const other of kinship[id][field]) {
      selected.add(other);
      follow(other, field, depth - 1);
    }
  };
  follow(personId, "parents", 2);
  follow(personId, "children", 2);
  for (const id of siblingsOf(state, personId)) selected.add(id);
  for (const id of [...selected]) if (kinship[id].spouse) selected.add(kinship[id].spouse);
  const trust = state.ecs.relationships[personId].known[viewerId];
  const trusted = viewerId == personId || (trust && RINGS.indexOf(trust.ring) >= 1);
  const known = state.ecs.relationships[viewerId].known;
  const learned = state.knowledge?.[viewerId]?.people || {};
  const visible = id => trusted || id == personId || id == viewerId || !!known[id] || !!learned[id];
  let nextUnknown = 0;
  const aliases = Object.fromEntries([...selected].map(id => [id, visible(id) ? id : "unknown-" + (++nextUnknown)]));
  const nodes = {};
  const links = ids => ids.filter(id => selected.has(id)).map(id => aliases[id]);
  for (const id of selected) {
    const alias = aliases[id];
    nodes[alias] = {
      ...(visible(id) ? { id, age: state.ecs.personable[id].age } : { id: alias, name: "unknown", unknown: true }),
      parents: links(kinship[id].parents),
      spouse: aliases[kinship[id].spouse] || null,
      children: links(kinship[id].children),
      siblings: links(siblingsOf(state, id))
    };
  }
  return { rootId: personId, nodes };
}

export const CHAT_GOODWILL = 2;
export const DAILY_PATIENCE = { public: 2, social: 4, personal: 6, intimate: 8 };
export const TALK_TIRED = "They've had enough of talking for today";
export const SOCIAL_REQUIRED = "They need to trust you before sharing gossip";
export const FOOD_TYPES = ["forage", "grain", "gruel"];
const GIFT_VALUES = { forage: 2, grain: 3, gruel: 5, wood: 3 };
const GIFT_TRAITS = { forage: "generous", grain: "hard-working", gruel: "cheerful", wood: "hard-working" };

export function trusts(state, personId, viewerId) {
  return RINGS.indexOf(state.ecs.relationships[personId].known[viewerId]?.ring) >= 1;
}

function knowledgeFor(state, viewerId) {
  state.knowledge ||= {};
  return state.knowledge[viewerId] ||= { people: {}, feelings: {} };
}

function learnPerson(state, viewerId, id) {
  const knowledge = knowledgeFor(state, viewerId);
  return knowledge.people[id] ||= { traits: [] };
}

// Looking at a person is not meeting them. Only a real interaction introduces you.
export function beginInteraction(state, actorId, personId) {
  meet(state, actorId, personId);
  meet(state, personId, actorId);
  const learned = learnPerson(state, actorId, personId);
  const trait = state.ecs.personality[personId].traits.find(t => !learned.traits.includes(t));
  if (trait) learned.traits.push(trait);
  if (trusts(state, personId, actorId)) {
    for (const node of Object.values(knownFamilyTree(state, actorId, personId).nodes)) {
      if (!node.unknown) learnPerson(state, actorId, node.id);
    }
  }
}

export function patienceLeft(state, actorId, personId) {
  const record = state.talking?.[personId]?.[actorId];
  const used = record?.day == Math.floor(state.days) ? record.used : 0;
  const ring = state.ecs.relationships[personId].known[actorId]?.ring || "public";
  return Math.max(0, DAILY_PATIENCE[ring] - used);
}

function spendPatience(state, actorId, personId) {
  if (!patienceLeft(state, actorId, personId)) return false;
  state.talking ||= {};
  state.talking[personId] ||= {};
  const records = state.talking[personId];
  const day = Math.floor(state.days);
  if (records[actorId]?.day != day) records[actorId] = { day, used: 0 };
  records[actorId].used++;
  return true;
}

export function chat(state, actorId, personId) {
  beginInteraction(state, actorId, personId);
  if (!spendPatience(state, actorId, personId)) return { ok: false, message: TALK_TIRED };
  addGoodwill(state, actorId, personId, CHAT_GOODWILL);
  return { ok: true };
}

export function askAbout(state, actorId, personId, aboutId) {
  if (!trusts(state, personId, actorId)) return { ok: false, message: SOCIAL_REQUIRED };
  const bond = state.ecs.relationships[personId].known[aboutId];
  if (!bond) return { ok: false, message: "They don't know that person" };
  beginInteraction(state, actorId, personId);
  if (!spendPatience(state, actorId, personId)) return { ok: false, message: TALK_TIRED };
  const knowledge = knowledgeFor(state, actorId);
  (knowledge.feelings[personId] ||= {})[aboutId] = bond.ring;
  for (const node of Object.values(knownFamilyTree(state, personId, aboutId).nodes)) {
    if (!node.unknown) learnPerson(state, actorId, node.id);
  }
  for (const event of knownEvents(state, personId, aboutId)) learnEvent(state, actorId, event);
  return { ok: true, ring: bond.ring };
}

export function giftGoodwill(state, actorId, personId, item) {
  const tastes = state.ecs.personality[personId];
  const tags = [item.type, GIFT_TRAITS[item.type]];
  const taste = tags.some(t => tastes.likes.includes(t)) ? 1.5 : tags.some(t => tastes.dislikes.includes(t)) ? 0.5 : 1;
  const need = FOOD_TYPES.includes(item.type) && state.ecs.personable[personId].hunger > 0.9 ? 2 : 1;
  const feeling = { hate: 0.05, like: 1, love: 1.25 }[disposition(state, personId, actorId)];
  return (item.value ?? GIFT_VALUES[item.type] ?? 4) * taste * need * feeling;
}

// One option is one portion/item. Sources remain real until collected by the task.
export function giftOptions(state, actorId) {
  const ecs = state.ecs;
  const owned = id => ecs.possession?.[id] ? ecs.possession[id].ownerId == actorId :
    ecs.controllable[id] && topController(ecs, id) == topController(ecs, actorId);
  const options = [];
  for (const sourceId of Object.keys(ecs.haulable || {})) {
    const item = ecs.good[sourceId], holder = ecs.haulable[sourceId].heldBy;
    if (!item || item.amount <= 0 || !owned(sourceId) || (holder && holder != actorId && !ecs.stockpile?.[holder])) continue;
    options.push({ sourceId, ...item, ...(ecs.possession?.[sourceId] ? { possession: ecs.possession[sourceId] } : {}) });
  }
  for (const sourceId of Object.keys(ecs.container || {})) {
    if (!owned(sourceId)) continue;
    for (const [type, amount] of Object.entries(ecs.container[sourceId].amounts)) {
      if (amount > 0) options.push({ sourceId, type, amount });
    }
  }
  return options;
}
