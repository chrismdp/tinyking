import { generateFamilies, Hex, Grid, ALL_SIDES, TRIANGLES } from "game/map";
import { newEntities } from "game/entities";
import { addBidirectionalLink, removeBidirectionalLink } from "game/pathfinding";
import { reserveBuildingClearance } from "game/tree_clearance";

// Initial conditions only: flat land, real navigation, houses, families and
// stocked rooms. Village life must allocate all plots, fields, yards and trades.
export const flatVillage = (count, { seed = 1, days = 0.375, founding = true, woodland = false } = {}) => {
  const s = { ecs: { nextId: 1, good: {}, farmable: {} }, days, game_speed: "normal", ui: { show: {} }, redraws: [],
    villages: { fixture: { id: "fixture", houses: [] } } };
  const grid = Grid.hexagon({ center: Hex(0, 0), radius: 9 });
  const tiles = newEntities(s, grid.map(hex => ({
    spatial: { ...hex.toPoint(), immovable: true },
    mappable: { terrain: "grassland", elevation: 0 },
    walkable: { worn: {}, speed: 1, neighbours: {} }
  })));
  const tileAt = Object.fromEntries(tiles.map(id => [Hex().fromPoint(s.ecs.spatial[id]).toString(), id]));
  for (const id of tiles) {
    const hex = Hex().fromPoint(s.ecs.spatial[id]);
    Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).forEach((next, side) => {
      if (tileAt[next]) addBidirectionalLink(s.ecs, id, side, tileAt[next]);
    });
  }
  if (woodland) for (const tile of tiles) newEntities(s, [
    { spatial: { ...s.ecs.spatial[tile], immovable: true }, good: { type: "wood", amount: 1 }, tree: {} },
    { spatial: { ...s.ecs.spatial[tile], immovable: true }, forageable: { kind: "berries", amount: 1, growth: 0 } }
  ]);
  // One declared layout, truncated to each requested size. No seed search or
  // terrain/siting changes are needed to provide viable initial houses.
  const sites = [[-3, -2], [0, -2], [3, -2], [-3, 1], [0, 1], [3, 1], [-3, 4], [0, 4]];
  const village = s.villages.fixture;
  village.houses = newEntities(s, sites.slice(0, count).map(([x, y]) => ({
    spatial: { ...Hex(x, y).toPoint(), immovable: true },
    controllable: {}, building: { entrance: 1, rooms: [] }, village: { villageId: village.id }
  })));
  const start = Hex(-7, 0);
  generateFamilies({ state: s, seed, playerStartTile: start, founding });
  for (const house of village.houses) {
    const building = s.ecs.building[house];
    const tile = tileAt[Hex().fromPoint(s.ecs.spatial[house])];
    for (const side of ALL_SIDES) if (side != building.entrance) removeBidirectionalLink(s.ecs, tile, side);
    const inhabitants = Object.values(s.ecs.household).filter(h => h.houseId == house).length;
    building.rooms = newEntities(s, [{
      spatial: { ...s.ecs.spatial[house] }, controllable: { controllerId: house },
      interior: { buildingId: house }, sleepable: { capacity: Math.max(3, inhabitants), level: 1, occupiers: [] }
    }, {
      spatial: { ...s.ecs.spatial[house] }, controllable: { controllerId: house },
      interior: { buildingId: house }, container: { capacity: (inhabitants + 1) * TRIANGLES.length,
        amounts: { gruel: inhabitants, grain: inhabitants * TRIANGLES.length } }
    }]);
    reserveBuildingClearance(s, house);
  }
  s.ui.playerId = Object.keys(s.ecs.playable)[0];
  s.map = { playerStartTile: { x: start.x, y: start.y } };
  return { s, village, tileAt, start };
};

