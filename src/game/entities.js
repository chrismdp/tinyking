export function newEntities(ecs, entities) {
  return entities.map(entity => {
    const id = ecs.nextId++;
    for (const name in entity) {
      if (!ecs[name]) {
        ecs[name] = {};
      }
      if (entity[name]) {
        ecs[name][id] = { ...entity[name], id };
      }
    }
    return id;
  });
}

export const fullEntity = (ecs, id) => (
  Object.keys(ecs).reduce((result, name) => (
    { ...result, [name]: ecs[name][id] }), {id: id}));
