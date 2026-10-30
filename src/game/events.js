import { addGoodwill } from "game/people";
import { hashUnit } from "game/math";

export function closeFamily(state, id) {
  const kin = state.ecs.kinship?.[id];
  if (!kin) return [];
  return [...new Set([kin.spouse, ...kin.parents, ...kin.children,
    ...kin.parents.flatMap(p => state.ecs.kinship[p]?.children || [])])].filter(p => p && p != id);
}

export function learnEvent(state, viewerId, event) {
  state.knowledge ||= {};
  const knowledge = state.knowledge[viewerId] ||= { people: {}, feelings: {} };
  knowledge.events ||= [];
  if (knowledge.events.includes(event.id)) return;
  knowledge.events.push(event.id);
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

export function recordEvent(state, type, people, items = [], details = {}) {
  state.events ||= [];
  const villageId = state.ecs.village?.[people[0]]?.villageId || null;
  const event = { id: "event-" + (state.events.length + 1), type, people: [...people],
    day: state.days, season: Math.floor(state.days / 3), villageId,
    place: state.ecs.household?.[people[0]]?.houseId || villageId,
    items: [...items],
    ...(type == "gift" ? { positions: Object.fromEntries(people.filter(id => state.ecs.spatial?.[id]).map(id =>
      [id, { x: state.ecs.spatial[id].x, y: state.ecs.spatial[id].y }])) } : {}), ...details };
  state.events.push(event);
  const family = new Set(people.flatMap(id => [id, ...closeFamily(state, id)]));
  for (const id of Object.keys(state.ecs.personable || {})) {
    if (state.ecs.personable[id].dead && !people.includes(id)) continue;
    // Players hear witnessed live news, or learn it through Ask about. No history omniscience.
    if (state.ecs.playable?.[id] && !people.includes(id)) {
      if (state.generatingHistory) continue;
      const p = state.ecs.spatial?.[id], q = state.ecs.spatial?.[people[0]];
      if (!p || !q || (p.x - q.x) ** 2 + (p.y - q.y) ** 2 > 300 ** 2) continue;
    } else if (!family.has(id)) {
      if (state.ecs.village?.[id]?.villageId != villageId) continue;
      const rank = Math.max(...people.map(p => ["public", "social", "personal", "intimate"].indexOf(state.ecs.relationships?.[id]?.known[p]?.ring)));
      if (hashUnit(state.peopleSeed + ":hear:" + event.id + ":" + id) >= [0.12, 0.4, 0.75, 1][Math.max(0, rank)]) continue;
    }
    learnEvent(state, id, event);
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
  const item = event.items.map(id => state.ecs.possession?.[id]?.name || state.ecs.good?.[id]?.type || "an item").join(", ");
  const text = {
    birth: () => n(a) + " was born to " + event.people.slice(1).map(n).join(" and "),
    marriage: () => n(a) + " and " + n(b) + " married" + (village ? " in " + village : ""),
    death: () => n(a) + " died" + (event.cause ? " of " + event.cause : ""),
    move: () => n(a) + " moved to " + n(event.toHouse),
    quarrel: () => n(a) + " quarrelled with " + n(b),
    reconciliation: () => n(a) + " made peace with " + n(b),
    gift: () => n(a) + " gave " + (item || "a gift") + " to " + n(b),
    inheritance: () => n(b) + " inherited " + (item || "the household") + " from " + n(a)
  }[event.type];
  return (text ? text() : event.type) + " in the " + when + ".";
}
