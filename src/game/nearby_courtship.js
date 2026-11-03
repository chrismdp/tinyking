import { canSeekPartner } from "game/life_stages";
import { neighbours, worldKey } from "game/travel_geometry";
import { hashUnit } from "game/math";
import { SUMMARY_COMPONENTS } from "game/community_summary";
import { attachPeople } from "game/person_storage";
import { bindNewsContext } from "game/event_knowledge";
import { withPopulationIndex, refreshPersonIndex } from "game/population_index";
import { withRelationshipIndex } from "game/people";
import { withEventIndex } from "game/events";
import { canCourt, chatTogether, courtTogether, courtshipPreference, withSocialIndex } from "game/social";
import { relatedPeople } from "game/social_kin";
import { moveMarriageResidents, publishCommunity } from "game/travel";

const single = (map, id) => {
  const e = map.ecs, p = e.personable[id], kin = e.kinship?.[id];
  return map.residents[id] && p && !p.dead && canSeekPartner(p.age) && !e.playable?.[id] && kin &&
    (!kin.spouse || e.personable[kin.spouse]?.dead) && e.personality?.[id] && e.relationships?.[id];
};
const villageBucket = (key, village) => village ?? "unsettled:" + key;
const identityQuery = (map, ids) => ({ ecs: map.ecs, peopleDirectory: map.peopleDirectory,
  residents: Object.fromEntries(ids.map(id => [id, true])) });

// Rebuilt once per seasonal boundary from each community's owned residents.
// Queries touch only village buckets in this hex and its six neighbours.
export function createCourtshipIndex(maps) {
  const index = { byVillage: new Map(), villagesByHex: new Map(), people: new Map(), courtships: [], pools: new Map() };
  for (const [key, map] of Object.entries(maps)) {
    const villages = new Set(); index.villagesByHex.set(key, villages);
    for (const pair of Object.keys(map.social?.courtships || {})) index.courtships.push({ map, pair });
    for (const id of Object.keys(map.residents)) if (single(map, id)) {
      const villageId = map.ecs.village[id]?.villageId ?? null;
      const entry = { id, key, villageId, map };
      const bucket = villageBucket(key, villageId);
      if (!index.byVillage.has(bucket)) index.byVillage.set(bucket, []);
      index.byVillage.get(bucket).push(entry);
      villages.add(villageId); index.people.set(id, entry);
    }
  }
  return index;
}
export function courtshipCandidates(index, key, id) {
  const village = index.people.get(id)?.villageId, bucket = villageBucket(key, village);
  if (!index.pools.has(bucket)) {
    const hex = Object.fromEntries(key.split(",").map((n, i) => [i ? "y" : "x", Number(n)]));
    const result = [];
    for (const nearby of [key, ...neighbours(hex).map(worldKey)]) for (const v of index.villagesByHex.get(nearby) || [])
      for (const candidate of index.byVillage.get(villageBucket(nearby, v)) || []) if (candidate.key === nearby)
        result.push({ ...candidate, weight: nearby !== key ? .08 : v !== village ? .35 : 1 });
    index.pools.set(bucket, result);
  }
  return index.pools.get(bucket).filter(candidate => candidate.id !== id);
}

export function availableCourtshipCandidates(index, key, id, paired) {
  const left = index.people.get(id).map;
  if(!single(left,id))return [];
  const query = identityQuery(left, [id]);
  // Remote personal components already resolve through the directory. A
  // read-only eligibility check needs no terrain, property or meeting view.
  return courtshipCandidates(index, key, id).filter(candidate => {
    if (paired.has(candidate.id) || !single(candidate.map, candidate.id)) return false;
    // Both endpoints came from the seasonal eligible-resident buckets. Only
    // current single status and kinship remain variable during this pass.
    return !relatedPeople(query, id, candidate.id, false, index.ancestry);
  });
}

// A seeded weighted race favours nearby people. Existing closeness strengthens
// the preference; the caller changes the seed each season to explore strangers.
export function chooseCourtshipCandidate(candidates, id, seed) {
  let choice, best = Infinity;
  for (const candidate of candidates) {
    const score = -Math.log(Math.max(Number.EPSILON, hashUnit(seed + ":nearby-partner:" + id + ":" + candidate.id))) /
      courtshipPreference(candidate.map, id, candidate.id, candidate.weight);
    if (score < best) { choice = candidate; best = score; }
  }
  return choice;
}

// A short-lived meeting view contains two communities, never the world. People
// and assets still refer to their canonical objects; no view enters storage.
export function courtshipState(left, right, directory) {
  const ecs = { nextId: left.ecs.nextId, namespace: left.ecs.namespace };
  for (const key of SUMMARY_COMPONENTS) ecs[key] = { ...left.ecs[key], ...right.ecs[key] };
  const view = { ...left, ecs, compact: !!left.compact, summarisingHistory: true, residents: { ...left.residents, ...right.residents },
    villages: { ...left.villages, ...right.villages }, events: [], space: {}, redraws: [],
    eventIds: left.eventIds ||= { next: left.events.length } };
  delete view.settlement;
  Object.defineProperty(view, "communityHexes", { value: Object.fromEntries([
    ...[...Object.keys(left.residents), ...Object.keys(left.ecs.building || {}), ...Object.keys(left.ecs.shelter || {})].map(id => [id, left.map.worldKey]),
    ...[...Object.keys(right.residents), ...Object.keys(right.ecs.building || {}), ...Object.keys(right.ecs.shelter || {})].map(id => [id, right.map.worldKey])
  ]) });
  attachPeople(view, directory); bindNewsContext(view, directory);
  return view;
}

export function runNearbyCourtships(s, season) {
  const j = s.travel;
  if (!j?.localPeople || !j.wholeWorld) return;
  const index = createCourtshipIndex(j.maps), paired = new Set(), views = new Map();
  index.ancestry = new Map(); // Owned for this boundary; caller edits never reuse it.
  const viewFor = (left, right) => {
    if (left === right) return left;
    const key = left.map.worldKey + ":" + right.map.worldKey;
    if (!views.has(key)) views.set(key, courtshipState(left, right, j));
    return views.get(key);
  };
  // Test closeness before today's contact can restore a lost ring. Drop stale
  // entries after deaths, marriages, moves out of range or loss of consent.
  for (const { map, pair } of index.courtships) {
    const [a, b] = pair.split(":"), left = index.people.get(a), right = index.people.get(b);
    if (left?.key === right?.key && left) continue;
    const nearby = left && right && courtshipCandidates(index, left.key, a).some(c => c.id === b);
    if (!nearby || !canCourt(identityQuery(left.map, [a, b]), a, b)) delete map.social.courtships[pair];
  }
  const order = [...index.people.values()].map(person => ({ ...person, order: hashUnit(j.seed + ":nearby-order:" + season + ":" + person.id) })).sort((a, b) => a.order - b.order);
  for (const seeker of order) {
    const { id: a, key, map: left } = seeker;
    if (paired.has(a) || !single(left, a)) continue;
    const candidates = availableCourtshipCandidates(index, key, a, paired);
    const candidate = chooseCourtshipCandidate(candidates, a, j.seed + ":" + season);
    // Ordinary same-hex meetings already ran in summarySeason / live play.
    if (!candidate || candidate.key === key) continue;
    const b = candidate.id, right = candidate.map, view = viewFor(left, right);
    paired.add(a); paired.add(b);
    view.days = s.days;
    const pair = [a, b].sort().join(":");
    const started = right.social.courtships[pair];
    if (started != null) left.social.courtships[pair] = Math.min(left.social.courtships[pair] ?? started, started);
    const avoidance = [left.social.avoidance?.[pair], right.social.avoidance?.[pair]].filter(until => until != null);
    if (avoidance.length) left.social.avoidance[pair] = Math.max(...avoidance);
    const married = withPopulationIndex(view, () => withRelationshipIndex(view, () => withSocialIndex(view, () => withEventIndex(view, () => {
      return chatTogether(view, a, b, true, 6) && courtTogether(view, a, b, season, true);
    }))));
    if (view.social.courtships[pair] != null) right.social.courtships[pair] = view.social.courtships[pair];
    else delete right.social.courtships[pair];
    if (left.social.avoidance[pair] != null) right.social.avoidance[pair] = left.social.avoidance[pair];
    else delete right.social.avoidance[pair];
    if (left.social.contacts?.[pair] != null) (right.social.contacts ||= {})[pair] = left.social.contacts[pair];
    left.events.push(...view.events); view.events.length = 0;
    left.ecs.nextId = view.ecs.nextId;
    if (married) {
      // Commit a new cottage and its rooms before transferring its residents.
      for (const component of SUMMARY_COMPONENTS) for (const [id, value] of Object.entries(view.ecs[component])) {
        if (left.ecs[component]?.[id] || right.ecs[component]?.[id] || j.people[id]) continue;
        const village = view.ecs.village[id]?.villageId || view.ecs.village[view.ecs.controllable[id]?.controllerId]?.villageId;
        const owner = right.villages[village] ? right : left;
        (owner.ecs[component] ||= {})[id] = value;
        if (view.ecs.building[id]) view.communityHexes[id] = owner.map.worldKey;
      }
      const moves = [];
      for (const map of [left, right]) for (const id of Object.keys(map.residents)) {
        for (const component of SUMMARY_COMPONENTS) {
          if (view.ecs[component]?.[id]) (map.ecs[component] ||= {})[id] = view.ecs[component][id];
          else if (map.ecs[component]) delete map.ecs[component][id];
        }
        const house = map.ecs.household[id]?.houseId;
        if (house && !map.ecs.building?.[house] && !map.ecs.shelter?.[house]) moves.push({ id, from: map, to: map === left ? right : left });
        refreshPersonIndex(map, id);
      }
      moveMarriageResidents(s, moves);
      views.clear();
    }
    publishCommunity(left, j); publishCommunity(right, j);
  }
}
