import { goalEvidence } from "game/guidance";
import { isResident } from "game/residents";
import { addGoodwill } from "game/people";
import { hashUnit } from "game/math";

export function closeFamily(state, id) {
  const kin = state.ecs.kinship?.[id];
  if (!kin) return [];
  return [...new Set([kin.spouse, ...kin.parents, ...kin.children,
    ...kin.parents.flatMap(p => state.ecs.kinship[p]?.children || [])])].filter(p => p && p != id);
}

const eventSets = new WeakMap();

export function learnEvent(state, viewerId, event) {
  state.knowledge ||= {};
  const knowledge = state.knowledge[viewerId] ||= { people: {}, feelings: {} };
  knowledge.events ||= [];
  let known = eventSets.get(knowledge.events);
  if (!known || known.size != knowledge.events.length) { known = new Set(knowledge.events); eventSets.set(knowledge.events, known); }
  if (known.has(event.id)) return;
  knowledge.events.push(event.id); known.add(event.id);
  if (!["quarrel", "gift", "reconciliation"].includes(event.type)) return;
  const family = closeFamily(state, viewerId);
  if (event.type == "quarrel") {
    for (const actor of event.people) if (actor != viewerId && event.people.some(id => id != actor && family.includes(id))) {
      addGoodwill(state, actor, viewerId, -3);
    }
  }
  if (["gift", "reconciliation"].includes(event.type) && event.people[0] != viewerId && family.includes(event.people[1])) {
    addGoodwill(state, event.people[0], viewerId, 1);
  }
}

// Listener pools belong to a synchronous transition, never to caller state.
const eventIndexes = new WeakMap();
export function withEventIndex(state, transition) {
  if (eventIndexes.has(state)) return transition();
  eventIndexes.set(state, {});
  try { return transition(); }
  finally { eventIndexes.delete(state); }
}
export function invalidateEventIndex(state) {
  const index = eventIndexes.get(state);
  if (index) index.people = null;
}
const villageKey = id => id == null ? null : String(id);
function eventViewers(state, villageId, family, people) {
  const index = eventIndexes.get(state);
  if (!index) return Object.keys(state.ecs.personable || {});
  if (!index.people) {
    index.people = state.ecs.personable || {};
    const keys = Object.keys(index.people);
    index.order = new Map(keys.map((id, n) => [id, n]));
    index.villages = new Map(); index.players = [];
    for (const id of keys) if (!index.people[id].dead) {
      const village = villageKey(state.ecs.village?.[id]?.villageId);
      if (!index.villages.has(village)) index.villages.set(village, []);
      index.villages.get(village).push(id);
      if (state.ecs.playable?.[id]) index.players.push(id);
    }
  }
  const locals = index.villages.get(villageKey(villageId)) || [], extra = new Set(index.players);
  for (const person of family) {
    const id = String(person);
    if (index.people[id] && (!index.people[id].dead || people.includes(id))) extra.add(id);
  }
  const others = [...extra].sort((a, b) => index.order.get(a) - index.order.get(b));
  const viewers = []; let local = 0, other = 0;
  while (local < locals.length || other < others.length) {
    const a = locals[local], b = others[other];
    if (a !== undefined && (b === undefined || index.order.get(a) < index.order.get(b))) { viewers.push(a); local++; }
    else { viewers.push(b); other++; if (a == b) local++; }
  }
  return viewers;
}

export function recordEvent(state, type, people, items = [], details = {}) {
  state.events ||= [];
  const villageId = (type == "visit" ? details.toVillage : null) || state.ecs.village?.[people[0]]?.villageId || null;
  state.eventIds ||= { next: state.events.length };
  const event = { id: (state.ecs.namespace || "") + "event-" + (++state.eventIds.next), type, people: [...people],
    day: state.days, season: Math.floor(state.days / 3), villageId,
    place: state.ecs.household?.[type == "visit" ? people[1] : people[0]]?.houseId || villageId,
    items: [...items],
    ...(type == "gift" ? { gifts: items.map(id => ({ id, type: state.ecs.good[id]?.type, ownerId: state.ecs.controllable[id]?.controllerId })), positions: Object.fromEntries(people.filter(id => state.ecs.spatial?.[id]).map(id =>
      [id, { x: state.ecs.spatial[id].x, y: state.ecs.spatial[id].y }])) } : {}), ...details };
  state.events.push(event);
  const family = new Set(people.flatMap(id => [id, ...closeFamily(state, id)]));
  const rings = ["public", "social", "personal", "intimate"];
  const { personable, playable, spatial, village, relationships } = state.ecs;
  for (const id of eventViewers(state, villageId, family, people)) {
    if (personable[id].dead && !people.includes(id)) continue;
    if (details.audienceIds) { if (details.audienceIds.includes(id)) learnEvent(state, id, event); continue; }
    // Players hear witnessed live news, or learn it through Ask about. No history omniscience.
    if (playable?.[id] && !people.includes(id)) {
      if (state.generatingHistory) continue;
      const p = spatial?.[id], q = spatial?.[people[0]];
      if (!p || !q || (p.x - q.x) ** 2 + (p.y - q.y) ** 2 > 300 ** 2) continue;
    } else if (!family.has(id)) {
      if (village?.[id]?.villageId != villageId) continue;
      let rank = -Infinity;
      for (const p of people) rank = Math.max(rank, rings.indexOf(relationships?.[id]?.known[p]?.ring));
      if (hashUnit(state.peopleSeed + ":hear:" + event.id + ":" + id) >= [0.12, 0.4, 0.75, 1][Math.max(0, rank)]) continue;
    }
    learnEvent(state, id, event);
    if(type=="marriage" && !state.generatingHistory && !state.summarisingHistory && !people.includes(id) && isResident(state,id)) {
      const p=spatial?.[id],q=spatial?.[people[0]];
      if(p && q && (p.x-q.x)**2+(p.y-q.y)**2<=300**2)goalEvidence(state,id).earned.wedding ||= {eventId:event.id,day:state.days};
    }
  }
  return event;
}

export function knownEvents(state, viewerId, aboutId) {
  const ids = new Set(state.knowledge?.[viewerId]?.events || []);
  return (state.events || []).filter(e => ids.has(e.id) && (!aboutId || e.people.includes(aboutId)));
}

export function eventSentence(state, event, displayName) {
  const n = id => displayName(id), [a, b] = event.people;
  const when = ["spring", "summer", "autumn", "winter"][((event.season % 4) + 4) % 4] + " of year " + (Math.floor(event.season / 4) + 1);
  const village = state.villages?.[event.villageId]?.name;
  const item = event.items.map(id => state.ecs.possession?.[id]?.name || event.gifts?.find(g => g.id == id)?.type || state.ecs.good?.[id]?.type || state.ecs.nameable?.[id]?.nickname || "an item").join(", ");
  const text = {
    departure: () => n(a) + " left for " + event.toWorld + (event.reason ? " · " + event.reason : " · one season on the road"),
    arrival: () => n(a) + " arrived in " + event.worldHex,
    world_visit: () => n(a) + " arrived from " + event.fromWorld + " to meet people",
    return: () => n(a) + " returned home from " + event.fromWorld,
    world_move: () => n(a) + " settled in " + event.toWorld + " after marrying",
    commons_cut: () => n(a) + " cut common woodland without permission",
    commons_warning: () => n(a) + " warned " + n(b) + " about cutting village commons (−" + event.loss + " goodwill)",
    commons_report: () => n(a) + " reported the cutting to elder " + n(b) + " (−" + event.loss + " goodwill)",
    village_oath: () => n(a) + " swore the local oath with elder " + n(b),
    village_leave: () => n(a) + " left the village before elder " + n(b),
    favour: () => n(a) + " helped " + n(b) + " with " + ({ harvest: "the harvest", wood: "fuel for the household", food: "household food" }[event.kind] || "a favour") + " (+" + event.goodwill + " goodwill)",
    birth: () => n(a) + " was born to " + event.people.slice(1).map(n).join(" and "),
    marriage: () => n(a) + " and " + n(b) + " married" + (village ? " in " + village : ""),
    death: () => n(a) + " died" + (event.cause ? " of " + event.cause : ""),
    move: () => n(a) + " moved to " + n(event.toHouse) + (state.villages?.[event.toVillage]?.name ? " in " + state.villages[event.toVillage].name : ""),
    visit: () => n(a) + " visited " + n(b) + (state.villages?.[event.toVillage]?.name ? " in " + state.villages[event.toVillage].name : ""),
    quarrel: () => n(a) + " quarrelled with " + n(b),
    reconciliation: () => n(a) + " made peace with " + n(b),
    gift: () => n(a) + " gave " + (item || "a gift") + " to " + n(b),
    settlement: () => n(a)+" founded a household in "+(village||"a new village"),
    household_join: () => n(a)+" joined the household of "+n(b),
    succession: () => event.newStranger ? n(b)+" arrived after the death of "+n(a) : n(b)+" succeeded "+n(a),
    celebration: () => n(a)+" and "+n(b)+" celebrated their wedding",
    inheritance: () => n(b) + " inherited " + (item || "the household") + " from " + n(a)
  }[event.type];
  return (text ? text() : event.type) + " in the " + when + ".";
}
