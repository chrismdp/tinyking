import { Hex } from "game/hex";
import { reserveFoundingFields, prepareSettlementSeason } from "game/settlement";
import { DAYS_IN_SEASON } from "game/time";
import { flatVillage } from "./village";

// Survey inputs only. The native settlement step must create people, houses,
// inventories, founding events and heirlooms from these three dated sites.
export function foundingVillage(seed = 13, { twoVillages = false, firstSeason = -3, namespace = "" } = {}) {
  const { s } = flatVillage(0, { seed, namespace });
  s.peopleSeed = seed;
  const layouts = twoVillages ? { west: [[-3, -3], [0, -3], [3, -3]], east: [[-3, 3], [0, 3], [3, 3]] } :
    { fixture: [[-3, -2], [0, -2], [3, -2]] };
  const namedLayouts = Object.fromEntries(Object.entries(layouts).map(([id, points]) => [namespace + id, points]));
  s.villages = Object.fromEntries(Object.entries(namedLayouts).map(([id, points]) =>
    [id, { id, centre: { x: points[1][0], y: points[1][1] }, houses: [], sharedPlaces: [] }]));
  s.ecs.building ||= {};
  s.ecs.container ||= {};
  s.ecs.household ||= {};
  s.map.entrances = {};
  s.settlement = { version: 1, preparedSeason: -181, lastSeason: -181,
    sites: Object.fromEntries(Object.entries(namedLayouts).map(([id, points]) => [id, points.map(([x, y], i) => ({
      point: Hex(x, y).toPoint(), entrance: 1, establishSeason: firstSeason + i
    }))])), journeys: [], appliedJourneys: {} };
  reserveFoundingFields(s);
  return s;
}

export function foundHouseholds(s) {
  for (let season = -3; season < 0; season++) {
    s.days = season * DAYS_IN_SEASON;
    prepareSettlementSeason(s, season);
  }
  return s;
}
