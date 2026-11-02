import { rowOfTiles } from "./support/world";
import { recordJourney } from "game/settlement_routes";
import { serialiseGame, restoreGame } from "game/save_game";

it("shares read-only route snapshots for repeated journeys while keeping every trip and its wear", () => {
  const { state: s, tiles, villager } = rowOfTiles(4);
  s.settlement = { journeys: [], appliedJourneys: {} };
  const details = { people: [villager], from: tiles[0], to: tiles[3], reason: "visiting household" };
  const first = recordJourney(s, { ...details, key: "first", day: 1, count: 2 });
  const before = JSON.stringify(first);
  const second = recordJourney(s, { ...details, key: "second", day: 1, count: 3 });
  expect(second.steps).toBe(first.steps);
  expect(second.tiles).toBe(first.tiles);
  expect(Object.isFrozen(first.steps)).toBe(true);
  expect(first.steps.every(Object.isFrozen)).toBe(true);
  expect(Object.isFrozen(first.tiles)).toBe(true);
  expect(s.settlement.journeys).toHaveLength(2);
  expect(JSON.stringify(first)).toBe(before);
  expect(Object.values(s.ecs.walkable[tiles[1]].worn)).toEqual([5]);
  const loaded = restoreGame(serialiseGame(s));
  expect(loaded.settlement.journeys[0].steps).toBe(loaded.settlement.journeys[1].steps);
  expect(loaded.settlement.journeys[0].tiles).toBe(loaded.settlement.journeys[1].tiles);
});

it("copies explicitly supplied mutable routes without retaining caller edits in earlier trips", () => {
  const { state: s, tiles, villager } = rowOfTiles(4);
  s.settlement = { journeys: [], appliedJourneys: {} };
  const trip = recordJourney(s, { key: "path", people: [villager], from: tiles[0], to: tiles[3] });
  const steps = trip.steps.map(step => ({ ...step }));
  const first = recordJourney(s, { key: "manual-first", people: [villager], steps });
  steps[0].note = "changed";
  const second = recordJourney(s, { key: "manual-second", people: [villager], steps });
  expect(first.steps[0].note).toBeUndefined();
  expect(second.steps[0].note).toBe("changed");
  expect(first.steps).not.toBe(steps);
});
