import { Hex } from "game/map";

export function newEntities(state, entities) {
  return entities.map(entity => {
    const id = "" + (state.ecs.nextId++);
    for (const name in entity) {
      if (!state.ecs[name]) {
        state.ecs[name] = {};
      }
      if (entity[name]) {
        state.ecs[name][id] = { ...entity[name], id };
      }
    }
    if (entity.spatial && (entity.mappable || entity.building || entity.stockpile)) {
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
  if (state.pixi[id]) {
    state.pixi[id].parent.removeChild(state.pixi[id]);
    delete state.pixi[id];
  }
  Object.keys(state.ecs).forEach(c => {
    delete state.ecs[c][id];
  });
}

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
