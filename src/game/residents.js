// Remote identity/ancestor records are available to kinship and person UI, but
// only this map's physical residents take part in its simulation.
export const isResident = (state, id) => !state.residents || !!state.residents[id];
export const entityId = (ecs, prefix = "") => (ecs.namespace || "") + prefix + ecs.nextId++;
