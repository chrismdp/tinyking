import { generateSettlements } from "game/map";
import { Hex, Grid } from "game/hex";
import { createHeightField } from "game/height";
import { buildGeography } from "game/geography";
import { installStoredHistory } from "game/world_history";
import { SUMMARY_COMPONENTS } from "game/community_summary";
import { newEntities } from "game/entities";
import { MAP_CENTRE } from "game/world_terrain";

it.each(["grassland", "stone"])("surveys the recorded house count on %s and gives every stored household its own village pad", async terrain => {
  const grid = Grid.hexagon({ center: MAP_CENTRE, radius: 8 }), start = MAP_CENTRE;
  const landscape = Object.fromEntries(grid.map(h => [h, {
    ...h.toPoint(), terrain, elevation: 20, economic_value: 10
  }]));
  const natural = createHeightField({ seed: 0, terrainAt: () => "grassland", elevationAt: () => 20 });
  const contents = { kind: "villages", discoveries: ["ruins"], settlements: [
    { id: "west", name: "West", houseCount: 4 }, { id: "east", name: "East", houseCount: 3 }
  ] };
  const mainLand = new Set(grid.filter(h => h.distance(MAP_CENTRE) <= 6).map(String));
  const { settlements } = await generateSettlements(13, grid, landscape, start, async () => {}, mainLand, natural, contents);
  for (const village of contents.settlements) {
    expect(Object.values(settlements).filter(p => p.villageId === village.id)).toHaveLength(village.houseCount);
  }
  buildGeography(grid, landscape, settlements, {}, [start], { elevationAt: () => 20 });

  const summary = { ecs: Object.fromEntries(SUMMARY_COMPONENTS.map(key => [key, {}])),
    residents: {}, events: [], knowledge: {}, social: { lastSeason: 0 }, villages: {} };
  summary.ecs.nextId = 1;
  for (const village of contents.settlements) {
    summary.villages[village.id] = { ...village, houses: [] };
    for (let i = 0; i < village.houseCount; i++) {
      const [store] = newEntities(summary, [{ container: { capacity: 100, amounts: {} } }]);
      const [house] = newEntities(summary, [{ building: { rooms: [] }, household: { storeId: store },
        controllable: {}, village: { villageId: village.id } }]);
      summary.villages[village.id].houses.push(house);
    }
  }
  const s = { ecs: { nextId: 100 }, space: {}, days: .375, map: { seed: 13, playerStartTile: start, entrances: {} } };
  newEntities(s, grid.map(h => ({ spatial: { ...h.toPoint(), immovable: true }, mappable: { terrain: "grassland" } })));
  installStoredHistory(s, summary, settlements, contents, true);
  const placed = [];
  for (const village of contents.settlements) for (const id of s.villages[village.id].houses) {
    const hex = Hex().fromPoint(s.ecs.spatial[id]);
    expect(settlements[hex].villageId).toBe(village.id);
    expect(s.space[hex]).toContain(id);
    placed.push(String(hex));
  }
  expect(Object.keys(s.ecs.building)).toHaveLength(7);
  expect(new Set(placed).size).toBe(7);
});
