import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";
import { addBidirectionalLink } from "game/pathfinding";
import { markThroughRoutes, recordJourney } from "game/settlement_routes";
import { reserveRoad } from "game/land_use";
import { rowOfTiles } from "./support/world";

it("connects surveyed crossings and village approaches while keeping house and field spurs local", () => {
  const { state: s, tiles, villager } = rowOfTiles(7);
  s.map = { entrances: { 0: { tileIds: tiles.slice(0, 3) }, 3: { tileIds: [tiles[5], tiles[4], tiles[3]] } } };
  s.settlement = { journeys: [], appliedJourneys: {} };
  expect(reserveRoad(s, tiles)).toBe(true);
  const junction = Hex().fromPoint(s.ecs.spatial[tiles[3]]);
  const side = ALL_SIDES.find(side => !s.ecs.walkable[tiles[3]].neighbours[side]);
  const fieldHex = Grid.hexagon({ center: junction, radius: 1 }).neighborsOf(junction, ALL_SIDES)[side];
  const [field] = newEntities(s, [{ spatial: fieldHex.toPoint(), mappable: { terrain: "grassland" }, walkable: { speed: 1, neighbours: {}, worn: {} } }]);
  addBidirectionalLink(s.ecs, tiles[3], side, field);
  const door = +Object.keys(s.ecs.walkable[tiles[6]].neighbours)[0];
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[6]], immovable: true }, building: { entrance: door } }]);
  markThroughRoutes(s, [tiles[4]]);
  const through = tiles.filter(id => s.ecs.mappable[id].throughRoute.length);
  expect(through).toEqual(tiles.slice(0, 6));
  expect(s.ecs.mappable[tiles[6]].throughRoute).toEqual([]);
  expect(s.ecs.mappable[field].throughRoute).toEqual([]);
  for (const id of through) for (const side of s.ecs.mappable[id].throughRoute) {
    const next = s.ecs.walkable[id].neighbours[side];
    if (next) expect(s.ecs.mappable[next].throughRoute).toContain((side + 3) % 6);
  }
  expect(Object.values(s.ecs.walkable[tiles[6]].neighbours).some(id => through.includes(id))).toBe(true);
  recordJourney(s, { key: "home", people: [villager], from: tiles[6], to: tiles[0], borderKey: "a/b", count: 20 });
  recordJourney(s, { key: "field", people: [villager], from: tiles[6], to: field, count: 20 });
  expect(Object.values(s.ecs.walkable[tiles[6]].worn).some(n => n >= 10)).toBe(true);
  expect(Object.values(s.ecs.walkable[field].worn).some(n => n >= 10)).toBe(true);
});

it("keeps a border traveller's house spur local and preserves its speed, wear and navigation",()=>{
  const {state:s,tiles,villager}=rowOfTiles(5);
  s.map={entrances:{0:{tileIds:tiles.slice(0,3)}}};
  s.settlement={journeys:[],appliedJourneys:{}};
  expect(reserveRoad(s,tiles)).toBe(true);
  const navigation=tiles.map(id=>({...s.ecs.walkable[id].neighbours}));
  const speeds=tiles.map(id=>s.ecs.walkable[id].speed);
  markThroughRoutes(s,[tiles[3]]);
  expect(s.ecs.mappable[tiles[4]].throughRoute).toEqual([]);
  recordJourney(s,{key:"border-from-home",people:[villager],from:tiles[4],to:tiles[0],borderKey:"a|b",reason:"visiting household"});
  expect(Object.values(s.ecs.mappable[tiles[2]].roadRoles).some(r=>r.role=="main")).toBe(true);
  expect(s.ecs.mappable[tiles[3]].roadRoles).toEqual({});
  expect(Object.values(s.ecs.walkable[tiles[4]].worn)).toEqual([1]);
  expect(tiles.map(id=>s.ecs.walkable[id].neighbours)).toEqual(navigation);
  expect(tiles.map(id=>s.ecs.walkable[id].speed)).toEqual(speeds);
});
