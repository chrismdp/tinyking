import { Hex, Grid, ALL_SIDES } from "game/map";
import { newEntities } from "game/entities";
import { addBidirectionalLink } from "game/pathfinding";

// NOTE: A tiny simulation-only world: a row of walkable grassland tiles and
// one villager standing on the first. No renderer is attached.
export function rowOfTiles(count) {
  const state = { ecs: { nextId: 1, playable: {} }, space: {}, redraws: [], ui: {}, days: 0.375 };
  const hexes = Array.from({ length: count }, (_, i) => Hex(i, 0));
  const tiles = newEntities(state, hexes.map(hex => {
    const { x, y } = hex.toPoint();
    return {
      spatial: { x, y, immovable: true },
      mappable: { terrain: "grassland" },
      walkable: { worn: {}, speed: 1, neighbours: {} }
    };
  }));

  hexes.forEach((hex, i) => {
    Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).forEach((n, side) => {
      const j = hexes.findIndex(h => h.x == n.x && h.y == n.y);
      if (j > i) {
        addBidirectionalLink(state.ecs, tiles[i], side, tiles[j]);
      }
    });
  });

  const [ villager ] = newEntities(state, [{
    spatial: { ...hexes[0].toPoint() },
    holder: { held: [], capacity: 2 },
    controllable: {},
  }]);
  state.ecs.controllable[villager].controllerId = villager;

  return { state, tiles, villager };
}
