export function discoverTiles(ecs, action) {
  const { id, tiles } = action;
  ecs.playable[id].known.push(...tiles);
}

export function anyControlledAlive(ecs, playableId) {
  return ecs.playable[playableId].controls.some(id => !ecs.personable[id].dead);
}
