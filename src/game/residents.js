// Remote identity/ancestor records are available to kinship and person UI, but
// only this map's physical residents take part in its simulation.
export const isResident = (state, id) => !state.residents || !!state.residents[id];
export const entityId = (ecs, prefix = "") => (ecs.namespace || "") + prefix + ecs.nextId++;

// Read remote identities without importing another community into the local ECS.
export const personComponent = (state, key, id) => state.ecs[key]?.[id] ||
  state.peopleDirectory?.[id]?.[key] || state.travel?.people?.[id]?.[key];
