import { generateSettlements } from "game/map";
import { Hex, Grid } from "game/hex";
import { createHeightField } from "game/height";
import { buildGeography, safeTile, groundForState } from "game/geography";
import { installStoredHistory } from "game/world_history";
import { SUMMARY_COMPONENTS } from "game/community_summary";
import { newEntities } from "game/entities";
import { MAP_CENTRE, MAP_RADIUS, createLandField, worldPoint } from "game/world_terrain";

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

it("retains four recorded homes when a rejected pad needs the inland survey beyond three hexes", async () => {
  // Four natural pads fit this small northern clearing from seed 1638658394,
  // but their finished foundations conflict. Replacements need the inland
  // survey. No world, prehistory or people generation is needed here.
  const centre = Hex(23, 5), home = { x: 5, y: 5 }, field = createLandField("1638658394:0");
  const grid = Grid.hexagon({ center: centre, radius: 6 }).filter(h => MAP_CENTRE.distance(h) <= MAP_RADIUS);
  const elevationAt = (x, y) => field.elevationAt(worldPoint(home, { x, y }));
  const terrainAt = p => field.terrainAt(worldPoint(home, p));
  const natural = createHeightField({ seed: 0, terrainAt: key => terrainAt(Hex(...key.split(",").map(Number)).toPoint()), elevationAt });
  const initialPads = new Set([[23, 5], [21, 5], [26, 7], [24, 7]].map(([x, y]) => String(Hex(x, y))));
  const landscape = Object.fromEntries(grid.map(h => {
    const terrain = terrainAt(h.toPoint());
    return [h, { ...h.toPoint(), terrain: initialPads.has(String(h)) ? "grassland" : terrain.includes("water") ? terrain : "stone",
      elevation: elevationAt(h.toPoint().x, h.toPoint().y), economic_value: h.equals(centre) ? 100000 : 10 }];
  }));
  const mainland = new Set(grid.filter(h => !landscape[h].terrain.includes("water")).map(String));
  const { settlements, settlementSites } = await generateSettlements(13, grid, landscape, Hex(22, 2), async () => {}, mainland, natural,
    { kind: "villages", settlements: [{ id: "v", name: "Village", houseCount: 4 }] });
  expect(new Set(Object.keys(settlements))).toEqual(initialPads);
  const geography = buildGeography(grid, landscape, settlements, {}, [Hex(22, 2)], {
    terrainAt, elevationAt, settlementSites, houseCounts: { v: 4 }
  });
  expect(Object.values(settlements)).toHaveLength(4);
  expect(Object.values(settlements).every(h => h.villageId === "v")).toBe(true);
  const ground = groundForState({ map: { geography }, ecs: { mappable: landscape }, space: Object.fromEntries(grid.map(h => [h, [String(h)]])) });
  for (const house of Object.values(settlements)) {
    expect(centre.distance(Hex(house))).toBeLessThanOrEqual(5);
    expect(safeTile(ground, Hex(house).toPoint())).toBe(true);
  }
});
