export function discoverTiles(ecs, action) {
  const { id, tiles } = action;
  ecs.playable[id].known.push(...tiles);
}

export function directlyControlledBy(ecs, id) {
  return Object.values(ecs.controllable).filter(p => p.controller == id && p.id != p.controllerId);
}

export function anyControlledAlive(ecs, playableId) {
  return [ecs.personable[playableId], ...directlyControlledBy(ecs, playableId)]
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
