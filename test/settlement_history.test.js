import { path } from "game/pathfinding";
import { generateMap, Hex } from "game/map";
import { recordJourney, reconcileRouteHistory } from "game/settlement_routes";
import { recordRoadUse, updateRoadWear, WEAR_LIFETIME } from "game/road_wear";
import { rowOfTiles } from "./support/world";

it("constructs the village from one actual household, with later dated homes and a persistent centre", async () => {
  const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
  const { map } = await generateMap(s, 13, async () => {});
  s.map = map;
  expect(s.settlement.version).toBe(1);
  for (const v of Object.values(s.villages)) {
    const founding = s.events.find(e => e.type == "founding" && e.villageId == v.id);
    expect(founding.people).toHaveLength(2);
    expect(v.origin.day).toBe(founding.day);
    expect(v.origin.reason).toMatch(/route|junction|crossing/);
    const green = v.sharedPlaces.find(id => s.ecs.meetingPlace[id].kind == "green");
    let centre=v.origin.centreHex;
    for(const move of v.greenMoves || []) {
      expect(move.fromHex).toBe(centre);
      expect(move.day).toBeGreaterThanOrEqual(v.origin.day);
      expect(s.events.some(e=>e.type=="green_moved" && e.items.includes(green) && e.day==move.day && e.fromHex==move.fromHex && e.toHex==move.toHex)).toBe(true);
      centre=move.toHex;
    }
    expect(Hex().fromPoint(s.ecs.spatial[green]).toString()).toBe(centre);
    expect(s.space[centre]).toContain(green);
    const built = v.houses.map(id => s.ecs.growth[id].builtDay);
    expect(Math.min(...built)).toBe(founding.day);
    expect(new Set(built).size).toBeGreaterThan(1);
    for (const house of v.houses) {
      const event = s.events.find(e => e.type == "house_built" && e.items.includes(house));
      expect(event.day).toBe(s.ecs.growth[house].builtDay);
      expect(event.people.every(id => s.ecs.personable[id])).toBe(true);
      expect(s.ecs.treeClearance[house]).toBeDefined();
    }
  }
  const lastUse={};
  for(const trip of s.settlement.journeys)for(const step of trip.steps) {
    const key=[step.entrance ?? "C",step.exit ?? "C"].sort().join(",");
    lastUse[step.id] ||= {};
    lastUse[step.id][key]=Math.max(lastUse[step.id][key] ?? -Infinity,trip.returnDay ?? trip.day);
  }
  let faded=0;
  for(const [tile,tracks] of Object.entries(lastUse))for(const [key,last] of Object.entries(tracks))if(last<s.days-WEAR_LIFETIME) {
    expect(s.ecs.walkable[tile].worn[key] || 0).toBe(0);faded++;
  }
  expect(faded).toBeGreaterThan(0);
  for(const h of Object.values(s.ecs.household).filter(h=>h.estateAccount)) {
    const account=h.estateAccount, store=s.ecs.container[h.storeId];
    expect(Object.values(store.amounts).reduce((n,a)=>n+a,0)).toBeLessThanOrEqual(store.capacity);
    expect(h.fields.length).toBeGreaterThanOrEqual(1);
    for(const type of new Set([...Object.keys(account.initial),...Object.keys(account.produced),...Object.keys(account.consumed)]))expect(store.amounts[type] || 0).toBeCloseTo((account.initial[type] || 0)+(account.produced[type] || 0)-(account.consumed[type] || 0),8);
    for(const field of h.fields) {
      const access=s.ecs.farmable[field].accessTileId;
      expect(access).toBeDefined();
      expect(s.ecs.mappable[access].cropPlot).not.toBe(true);
      const origin=s.space[Hex().fromPoint(s.ecs.spatial[h.id])].find(id=>s.ecs.mappable[id]);
      expect(path(s,origin,access)).not.toBeNull();
      if(s.ecs.farmable[field].accessKind=="foot")expect(s.ecs.mappable[access].fieldLane).toBe(true);
      else expect(s.ecs.mappable[access].route.length).toBeGreaterThan(0);
    }
  }
  expect(s.settlement.journeys.some(j => j.reason == "visiting household" && j.people.length)).toBe(true);
  expect(s.settlement.journeys.some(j => j.borderKey && j.returnDay > j.day)).toBe(true);
  for (const j of s.settlement.journeys) expect(j.people.every(id => s.ecs.personable[id])).toBe(true);
});

it("adds truthful journey counts through real wear and decays once without activation refresh", () => {
  const { state: s, tiles, villager } = rowOfTiles(4);
  s.settlement = { version: 1, journeys: [], appliedJourneys: {} };
  s.days = -3;
  const trip = recordJourney(s, { key: "visit-1", people: [villager], from: tiles[0], to: tiles[3], reason: "visiting household", count: 2 });
  expect(trip.tiles).toEqual(tiles);
  expect(trip.day).toBe(-3);
  expect(Object.values(s.ecs.walkable[tiles[1]].worn)).toEqual([2]);
  recordJourney(s, { ...trip, from: tiles[0], to: tiles[3] });
  expect(s.settlement.journeys).toHaveLength(1);
  s.days += WEAR_LIFETIME;
  updateRoadWear(s);
  expect(Object.values(s.ecs.walkable[tiles[1]].worn).every(n => n == 0)).toBe(true);
  updateRoadWear(s);
  expect(Object.values(s.ecs.walkable[tiles[1]].worn).every(n => n == 0)).toBe(true);
  recordRoadUse(s, tiles[1], 1, 4, 1);
  expect(s.ecs.walkable[tiles[1]].worn["1,4"]).toBe(1);
});

it("reconciles a lazy neighbour's recorded crossing legs once, without residents or a second ageing step", () => {
  const { state: s, tiles } = rowOfTiles(4);
  s.map = { worldKey: "b", entrances: { 3: { key: "a|b", tileIds: [tiles[0], tiles[1], tiles[2]] } } };
  s.settlement = { version: 1, journeys: [], appliedJourneys: {} };
  const age = JSON.stringify(s.ecs.personable);
  const ledger = [{ key: "crossing-1", borderKey: "a|b", origin: "a", day: 0, returnDay: .25, count: 1, people: ["persistent-person"], reason: "seeking company at crossing" }];
  reconcileRouteHistory(s, ledger);
  const wear = JSON.stringify(s.ecs.walkable);
  reconcileRouteHistory(s, ledger);
  expect(JSON.stringify(s.ecs.walkable)).toBe(wear);
  expect(JSON.stringify(s.ecs.personable)).toBe(age);
  expect(s.settlement.appliedJourneys["crossing-1"]).toBeDefined();
  expect(Object.values(s.ecs.walkable[tiles[1]].worn).some(n => n > 0)).toBe(true);
});
