// Remote identity/ancestor records are available to kinship and person UI, but
// only this map's physical residents take part in its simulation.
export const isResident = (state, id) => !state.residents || !!state.residents[id];
export const entityId = (ecs, prefix = "") => (ecs.namespace || "") + prefix + ecs.nextId++;

// Read remote identities without importing another community into the local ECS.
export const personComponent = (state, key, id) => state.ecs[key]?.[id] ||
  state.peopleDirectory?.[id]?.[key] || state.travel?.people?.[id]?.[key];

// Household assets stay in their physical map; the identity directory contains
// people only. Read the saved home without activating or mutating that map.
export function homeState(state, personId) {
  const house = personComponent(state, "household", personId)?.houseId;
  if (!house || state.ecs.controllable?.[house]) return state;
  return Object.values(state.travel?.maps || {}).find(map => map.ecs?.controllable?.[house]) || state;
}
