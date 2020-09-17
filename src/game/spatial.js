export const entitiesAtLocations = (ecs, tiles) => {
  var result = [];
  for (const id in ecs.spatial) {
    for (const tile of tiles) {
      if (ecs.spatial[id].x == tile.x && ecs.spatial[id].y == tile.y) {
        result.push(id);
        break;
      }
    }
  }
  return result;
};
