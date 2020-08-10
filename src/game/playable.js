export function discoverTiles(ecs, action) {
  const { id, tiles } = action;
  ecs.playable[id].known.push(...tiles);
}
