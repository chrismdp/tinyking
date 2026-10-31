import { community } from "./support/travel";
import { generateWorld, homeOf } from "game/overworld";
import { Grid, Hex } from "game/hex";
import { MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { mainLandKeys, naturalGroundFor, suitableHouse, landFieldFor } from "game/geography";
import { exitPoint, neighbours, worldKey } from "game/travel_geometry";
import { worldPoint } from "game/world_terrain";
import { departNpc, advanceWorldClock, returnSuccessorFromRoad } from "game/travel";
import { advanceSeason } from "game/social";
import * as maps from "game/map";
import { createPossession } from "game/possessions";

it("seed 64 surveys an inland village site on the camp's walkable land component", () => {
  const world = generateWorld(64), start = Hex(homeOf(world).start), ground = naturalGroundFor(world), main = mainLandKeys(world), field = landFieldFor(world);
  const candidates = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS }).filter(h => MAP_CENTRE.distance(h) < MAP_RADIUS - 4 && start.distance(h) >= 3 && main.has(String(h)) && field.terrainAt(worldPoint(world.home, h.toPoint())) == "grassland" && suitableHouse(ground, h.toPoint()));
  expect(main.has(String(start))).toBe(true);
  expect(candidates.length).toBeGreaterThanOrEqual(3);
});

it("resolves ungenerated NPC visits without generating terrain, and later returns the actual bundle", async () => {
  const generate = jest.spyOn(maps, "generateMap").mockImplementation(() => { throw new Error("NPC forced full map generation"); });
  try {
    const { s, ids: [, npc, spouse] } = community();
    s.ecs.kinship[s.ui.playerId].spouse = spouse; s.ecs.kinship[spouse].spouse = s.ui.playerId;
    departNpc(s, npc, { to: "6,5", side: 0 });
    const needs = { hunger: s.travel.people[npc].personable.hunger, tiredness: s.travel.people[npc].personable.tiredness };
    for (let season = 1; season <= 5; season++) {
      s.days += 3; advanceSeason(s, season); await advanceWorldClock(s);
      if (season == 1) expect(s.travel.transit.find(t => t.bundle.id == npc).due).toBeGreaterThan(s.days);
    }
    expect(generate).not.toHaveBeenCalled();
    expect(Object.keys(s.travel.maps)).toEqual(["5,5"]);
    expect(s.residents[npc]).toBe(true);
    expect(s.ecs.personable[npc].visitedWorlds).toContain("6,5");
    expect(s.ecs.personable[npc].lifeYears).toBe(6.75);
    expect(s.ecs.personable[npc]).toMatchObject(needs); // roads and reference visit freeze needs
    expect(s.events.some(e => e.type == "return" && e.people.includes(npc))).toBe(true);
  } finally { generate.mockRestore(); }
});

it("materialises a waiting reference visitor once the player opens that reach, with cargo and one ageing step per season", async () => {
  const { s, ids: [, npc, spouse] } = community();
  s.ecs.kinship[s.ui.playerId].spouse = spouse; s.ecs.kinship[spouse].spouse = s.ui.playerId;
  const item = createPossession(s, npc, "Visitor ring");
  departNpc(s, npc, { to: "6,5", side: 0 });
  s.days += 3; advanceSeason(s, 1); await advanceWorldClock(s);
  expect(s.travel.maps["6,5"]).toBeUndefined();
  expect(s.travel.transit.find(t => t.bundle.id == npc).referenceVisit).toBe(true);
  // A generated destination fixture stands for the player's first detailed map.
  const destination = community({ namespace: "new-", key: "6,5", player: false });
  const { attach } = require("./support/travel");
  attach(s, destination.s);
  await advanceWorldClock(s);
  const there = s.travel.maps["6,5"];
  expect(there.residents[npc]).toBe(true);
  expect(there.ecs.possession[item].ownerId).toBe(npc);
  expect(Object.values(s.travel.maps).filter(map => map.ecs.good[item])).toHaveLength(1);
  expect(there.ecs.personable[npc].lifeYears).toBe(5.75);
  await advanceWorldClock(s);
  expect(there.ecs.personable[npc].lifeYears).toBe(5.75);
  expect(s.travel.transit.some(t => t.bundle.id == npc)).toBe(false);
});


it("preserves the real home pass when a returning reference visitor becomes the heir", async () => {
  const { s, ids: [player, npc, spouse] } = community(), side = 5, entry = s.map.entrances[side];
  s.map.entrances = { [side]: entry };
  s.ecs.kinship[player].spouse = spouse; s.ecs.kinship[spouse].spouse = player;
  Object.assign(s.ecs.spatial[npc], exitPoint(s, entry.tileIds[0]));
  departNpc(s, npc, { to: worldKey(neighbours(s.world.home)[side]), side });
  for (let season = 1; season <= 4; season++) { s.days += 3; await advanceWorldClock(s); }
  expect(s.travel.transit.find(t => t.bundle.id == npc).returning).toBe(true);
  expect(await returnSuccessorFromRoad(s, npc)).toBe("5,5");
  expect(s.travel.maps["5,5"].residents[npc]).toBe(true);
  expect(s.travel.maps["5,5"].ecs.spatial[npc]).toMatchObject({ x: s.ecs.spatial[entry.tileIds[0]].x, y: s.ecs.spatial[entry.tileIds[0]].y });
  expect(s.travel.transit.some(t => t.bundle.id == npc)).toBe(false);
});
