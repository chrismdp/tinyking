import { Hex } from "game/map";

export function newEntities(state, entities, prefix = "") {
  return entities.map(entity => {
    const id = prefix + (state.ecs.nextId++);
    for (const name in entity) {
      if (!state.ecs[name]) {
        state.ecs[name] = {};
      }
      if (entity[name]) {
        state.ecs[name][id] = { ...entity[name], id };
      }
    }
    if (entity.spatial && entity.spatial.immovable) {
      const hex = Hex().fromPoint(entity.spatial);
      if (!state.space) {
        state.space = {};
      }
      if (!(hex in state.space)) {
        state.space[hex] = [];
      }
      state.space[hex].push(id);
    }
    return id;
  });
}

export function deleteEntity(state, id) {
  removeFromSpace(state, id);

  Object.keys(state.ecs).forEach(c => {
    delete state.ecs[c][id];
  });

  // NOTE: Tell whatever is drawing the world that this entity has gone
  state.redraws.push(id);
}

export const entityExists = (ecs, id) =>
  Object.values(ecs).some(component => component && component[id]);

export const fullEntity = (ecs, id) => (
  Object.keys(ecs).reduce((result, name) => (
    { ...result, [name]: ecs[name][id] }), {id: id}));

export function entitiesInSameLocation(state, point) {
  return state.space[Hex().fromPoint(point)];
}

export function removeFromSpace(state, targetId) {
  const s = state.space[Hex().fromPoint(state.ecs.spatial[targetId])];
  const idx = s.findIndex(id => id == targetId);
  if (idx != -1) {
    s.splice(idx, 1);
  }
}
