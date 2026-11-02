import { buildHistoryMap, restoreDetails } from "game/world_history";
import { neighbours, worldKey } from "game/travel_geometry";

// Keep historical construction inputs, never terrain, in unopened hexes.
// Social rings retain the audience for construction news. Current full bonds
// and learned events are applied when the player opens the hex.
export function captureDetailOrigins(s) {
  const origins = {};
  for (const [key, map] of Object.entries(s.travel.maps)) origins[key] = structuredClone({
    ...map,
    ecs: { ...map.ecs, relationships: Object.fromEntries(Object.entries(map.ecs.relationships).map(([id, r]) => [id, { id,
      known: Object.fromEntries(Object.entries(r.known).filter(([, bond]) => bond.ring !== "public").map(([other, bond]) => [other, { ring: bond.ring }])) }])) },
    events: [], knowledge: {}, social: { lastSeason: 0, courtships: {}, avoidance: {} }, days: .375
  });
  s.worldHistory.detailOrigins = origins;
}

const preparations = new WeakMap();
function jobsFor(j) {
  let jobs = preparations.get(j);
  if (!jobs) { jobs = new Map(); preparations.set(j, jobs); }
  return jobs;
}
export function detailNeighbours(s) {
  const hex = s.world.hexes.find(h => worldKey(h) === s.travel.active);
  return neighbours(hex).map(worldKey).filter(key => s.travel.maps[key]);
}

export function prepareDetail(s, key, progress = async () => {}, options = {}) {
  const j = s.travel;
  if (j.preparedMaps?.[key]) return Promise.resolve(j.preparedMaps[key]);
  const jobs = jobsFor(j);
  if (jobs.has(key)) return jobs.get(key);
  // Every asynchronous build owns its input graph, even while play advances a
  // season, saves, changes the active hex or replaces the entire game.
  const origin = structuredClone(s.worldHistory.detailOrigins[key]);
  const context = { world: s.world, worldHistory: s.worldHistory, travel: j, days: .375, ui: { playerId: s.ui.playerId } };
  const hex = s.world.hexes.find(h => worldKey(h) === key);
  const work = buildHistoryMap(context, hex, origin, progress, options).then(map => {
    map.unopenedDetail = true;
    (j.unopenedHexes ||= {})[key] = true;
    (j.preparedMaps ||= {})[key] = map;
    return map;
  }).finally(() => jobs.delete(key));
  jobs.set(key, work);
  return work;
}

export async function prepareNeighbourDetails(s, progress = async () => {}, options = {}) {
  const j = s.travel;
  if (!s.worldHistory?.detailOrigins) return;
  const keys = detailNeighbours(s);
  j.detailQueue = keys.filter(key => j.maps[key]?.compact && !j.hexRecords?.[key] && !j.preparedMaps?.[key]);
  const pending = [...j.detailQueue];
  for (const [index, key] of pending.entries()) {
    if (s.travel !== j) return;
    await prepareDetail(s, key, async (label, value) => {
      // A new arrival takes priority over older background preparations.
      while (options.background && s.travel === j && s.transition && s.transition.destination !== key) await new Promise(resolve => setTimeout(resolve, 16));
      if (s.travel !== j) return;
      await progress(label, (index + value) / pending.length);
    }, options);
    j.detailQueue = j.detailQueue.filter(other => other !== key);
  }
}

const afterPaint = fn => requestAnimationFrame(() => setTimeout(fn, 0));
export function scheduleNeighbourDetails(s, schedule = afterPaint) {
  const j = s.travel;
  if (!s.worldHistory?.detailOrigins) return;
  // Persist intent before yielding. Reload derives any remaining work from the
  // active hex and the committed detail pointers, including interrupted builds.
  j.detailQueue = detailNeighbours(s).filter(key => j.maps[key]?.compact && !j.hexRecords?.[key] && !j.preparedMaps?.[key]);
  schedule(() => {
    if (s.travel !== j) return;
    prepareNeighbourDetails(s, () => new Promise(resolve => setTimeout(resolve, 0)), { background: true })
      .then(() => { if (s.travel === j) s.persistence?.request(); })
      .catch(error => { if (s.travel === j) s.detailError = error.message; });
  });
}

// Construction uses the fixed end-of-history recipe. Identity, ownership,
// residents, food and news then come from the current compact community.
export function applyPreparedDetail(s, key, detail, summary) {
  const origin = s.worldHistory.detailOrigins[key], ecs = { ...summary.ecs };
  ecs.household = Object.fromEntries(Object.entries(summary.ecs.household).map(([id, h]) => [id, {
    ...h, trade: h.trade ?? detail.ecs.household[id]?.trade,
    workplaceId: h.workplaceId ?? detail.ecs.household[id]?.workplaceId
  }]));
  ecs.container = Object.fromEntries(Object.entries(summary.ecs.container).map(([id, store]) => {
    const before = origin.ecs.container[id]?.amounts, after = detail.ecs.container[id]?.amounts;
    const amounts = { ...store.amounts };
    if (before && after) for (const type of Object.keys(before)) amounts[type] = Math.max(0, (amounts[type] || 0) - (before[type] - (after[type] || 0)));
    return [id, { ...store, amounts }];
  }));
  const events = [...summary.events, ...detail.events];
  const knowledge = { ...summary.knowledge };
  for (const [id, learned] of Object.entries(detail.knowledge)) {
    const current = knowledge[id] || {}, known = new Set(current.events || []);
    knowledge[id] = { ...current, events: [...known, ...(learned.events || []).filter(event => !known.has(event))] };
  }
  return restoreDetails(detail, { ...summary, ecs, events, knowledge,
    eventIds: { next: Math.max(summary.eventIds?.next || 0, detail.eventIds?.next || 0) } });
}
