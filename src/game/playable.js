export function discoverTiles(ecs, action) {
  const { id, tiles } = action;
  ecs.playable[id].known.push(...tiles);
}

export function directlyControlledBy(ecs, id) {
  return Object.values(ecs.controllable).filter(c => c.controllerId == id && c.id != c.controllerId);
}

export function anyControlledAlive(ecs, playableId) {
  return [playableId, ...directlyControlledBy(ecs, playableId).map(c => c.id)]
    .map(id => ecs.personable[id])
    .some(p => !p.dead);
}

export function topController(ecs, id) {
  if (!ecs.controllable[id]) {
    throw "Called topController on " + id + " which isn't a controllable entity";
  }

  const controllerId = ecs.controllable[id].controllerId;
  if (controllerId == id) {
    return id;
  } else {
    return topController(ecs, controllerId);
  }
}
