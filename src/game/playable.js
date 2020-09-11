export function discoverTiles(ecs, action) {
  const { id, tiles } = action;
  ecs.playable[id].known.push(...tiles);
}

export function controlled(ecs, playableId) {
  return Object.values(ecs.personable).filter(p => p.controller == playableId);
}

export function anyControlledAlive(ecs, playableId) {
  return controlled(ecs, playableId).some(p => !p.dead);
}
