export const getKnown = (state, playerId) => playerId ? state.entities.components.playable[playerId].known : [];
export const filterByKnown = (list, known) => list.filter(e => known.some(k => k.x == e.spatial.x && k.y == e.spatial.y));

export const filterTilesByKnown = (tiles, known) => {
  if (Object.keys(tiles).length == 0 || known.length == 0) {
    return {};
  }
  const strings =  known.map(point => point.x + "," + point.y);
  return Object.assign(...Object.keys(tiles)
    .filter(key => strings.includes(key))
    .map(key => ({ [key]: tiles[key] })));
};
