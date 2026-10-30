// Ambient names follow the same introductions and learned-person records as the
// family panel. A raw name resolver may format a permitted identity, never decide
// whether the player knows it. This module also serves the renderer without UI imports.
export function displayName(state, id, resolve = state.personName) {
  const ecs = state.ecs, viewer = state.ui?.playerId;
  const known = !ecs.personable?.[id] || id == viewer || ecs.relationships?.[viewer]?.known[id] || state.knowledge?.[viewer]?.people?.[id];
  return known && ecs.nameable?.[id] ? resolve?.(id) || ecs.nameable[id].nickname || "an unknown person" : "an unknown person";
}
