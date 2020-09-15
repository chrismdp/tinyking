export function discoverTiles(ecs, action) {
  const { id, tiles } = action;
  ecs.playable[id].known.push(...tiles);
}

export function directlyControlledBy(ecs, playableId) {
  return Object.values(ecs.personable).filter(p => p.controller == playableId && p.id != p.controller);
}

export function anyControlledAlive(ecs, playableId) {
  return [ecs.personable[playableId], ...directlyControlledBy(ecs, playableId)]
    .some(p => !p.dead);
}

export function topController(ecs, id) {
  if (!ecs.personable[id]) {
    return null;
  }

  const controller = ecs.personable[id].controller;
  if (controller == id) {
    return id;
  } else {
    return topController(ecs, controller);
  }
}
