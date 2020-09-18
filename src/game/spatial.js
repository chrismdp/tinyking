import { Hex } from "game/map";
export const entitiesAtLocations = (ecs, tiles) => {
  var result = [];
  for (const id in ecs.spatial) {
    const hex = Hex().fromPoint(ecs.spatial[id]);
    for (const tile of tiles) {
      if (hex.x == tile.x && hex.y == tile.y) {
        result.push(id);
        break;
      }
    }
  }
  return result;
};
