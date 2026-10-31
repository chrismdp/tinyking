// Ambient names follow the same introductions and learned-person records as the
// family panel. A raw name resolver may format a permitted identity, never decide
// whether the player knows it. This module also serves the renderer without UI imports.
export function displayName(state, id, resolve = state.personName) {
  const ecs = state.ecs, viewer = state.ui?.playerId;
  const known = !ecs.personable?.[id] || id == viewer || ecs.relationships?.[viewer]?.known[id] || state.knowledge?.[viewer]?.people?.[id];
  return known && ecs.nameable?.[id] ? resolve?.(id) || ecs.nameable[id].nickname || "an unknown person" : "an unknown person";
}

// NPC conversations already have dated, canonical contact records. On taking
// control, remember only this person's own conversations, never another actor's.
// Persist them with the person so travel does not lose that spoken history.
export function rememberOwnConversations(state, actorId) {
  for (const [key, day] of Object.entries(state.social?.contacts || {})) {
    const pair=key.split(":");
    if (!pair.includes(actorId)) continue;
    const other=pair.find(id=>id!=actorId);
    if (!other) continue;
    state.knowledge ||= {};
    const knowledge=state.knowledge[actorId] ||= {people:{},feelings:{}};
    const learned=(knowledge.people ||= {})[other] ||= {traits:[]};
    learned.conversation ||= {day};
  }
}
