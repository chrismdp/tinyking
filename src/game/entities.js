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
    if (entity.spatial) {
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

export const fullEntity = (ecs, id) => (
  Object.keys(ecs).reduce((result, name) => (
    { ...result, [name]: ecs[name][id] }), {id: id}));
