import { Hex, Grid, ALL_SIDES } from "game/hex";
import { createLandField, worldPoint, MAP_CENTRE } from "game/world_terrain";
import { routeCrossing, buildGeography, groundForState, MAX_WALK_SLOPE } from "game/geography";
import { neighbours, worldKey } from "game/travel_geometry";
import { addBidirectionalLink, path } from "game/pathfinding";
import { walk_to } from "game/tasks";
import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { recordJourney, flushJourneys } from "game/settlement_routes";
import { WEAR_LIFETIME, updateRoadWear } from "game/road_wear";
import { transitBlocked } from "game/land_use";
import { reserveBuildingClearance, treeAllowed } from "game/tree_clearance";

const crossingWorld = () => {
  const home = { x: 0, y: 0 };
  return { home, hexes: [home, ...neighbours(home)].map(h => ({ ...h, ocean: false })) };
};
const flatField = { terrainAt: () => "grassland", elevationAt: () => 20 };

it("chooses the same physical shared crossing from either side, independent of request order", () => {
  const w = crossingWorld(), before = JSON.stringify(w);
  const ends = neighbours(w.home).map((h, side) => ({ h, side })).filter(({h}) => w.hexes.some(n => worldKey(h) == worldKey(n) && !n.ocean));
  let connected = 0;
  for (const { h, side } of ends.reverse()) {
    const b = routeCrossing({ ...w, home: h }, (side + 3) % 6, flatField);
    const a = routeCrossing(w, side, flatField);
    expect(!!a).toBe(!!b);
    if (!a) continue;
    connected++;
    expect(a.key).toBe(b.key);
    expect(a.crossing).toEqual(b.crossing);
    const pa = worldPoint(w.home, Hex(a.hexes[0]).toPoint());
    const pb = worldPoint(h, Hex(b.hexes[0]).toPoint());
    expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeCloseTo(Hex().height(), 6);
    expect(a.crossing.x).toBeCloseTo((pa.x + pb.x) / 2, 6);
    expect(a.crossing.y).toBeCloseTo((pa.y + pb.y) / 2, 6);
    expect(routeCrossing(w, side, flatField)).toEqual(a);
  }
  expect(connected).toBe(6);
  expect(JSON.stringify(w)).toBe(before);
});

it("does not bridge ocean or genuinely separated land across a shared edge", () => {
  const w = crossingWorld(), next = neighbours(w.home)[0];
  const ocean = { ...w, hexes: w.hexes.map(h => worldKey(h) == worldKey(next) ? { ...h, ocean: true } : h) };
  expect(routeCrossing(ocean, 0, flatField)).toBeNull();
  const field = { terrainAt: p => Math.abs(p.x - worldPoint(w.home, MAP_CENTRE.toPoint()).x) < 300 ? "grassland" : "deep water", elevationAt: () => 20 };
  expect(routeCrossing(w, 0, field)).toBeNull();
});

it("builds a broad house-scale mountain with a navigable graded road through its pass", () => {
  const grid = Grid.hexagon({ center: MAP_CENTRE, radius: 12 });
  const c = MAP_CENTRE.toPoint();
  // Use the real labelled fixture field, without settlements or history.
  const field = createLandField("13:0", { kind: "mountain-pass", ...c });
  const landscape = Object.fromEntries(grid.map(h => {
    const p = h.toPoint();
    const elevation = field.elevationAt(p);
    return [h, { ...p, terrain: elevation > 180 ? "mountain" : "grassland", elevation }];
  }));
  const west = grid.filter(h => h.x <= MAP_CENTRE.x - 10).sort((a,b) => Math.abs(a.toPoint().y-c.y)-Math.abs(b.toPoint().y-c.y))[0];
  const east = grid.filter(h => h.x >= MAP_CENTRE.x + 10).sort((a,b) => Math.abs(a.toPoint().y-c.y)-Math.abs(b.toPoint().y-c.y))[0];
  const geo = buildGeography(grid, landscape, {}, {}, [west, east]);
  const s = { map: { seed: 13, geography: geo }, ecs: { mappable: {}, spatial: {}, walkable: {} }, space: {} };
  grid.forEach((h, i) => { const id=String(i); s.ecs.mappable[id]=landscape[h]; s.ecs.spatial[id]=h.toPoint(); s.ecs.walkable[id]={speed:landscape[h].terrain=="grassland"?1:0,worn:{},neighbours:{}}; s.space[h]=[id]; });
  // The untravelled foundation reserves geometry without inventing use.
  for (const walk of Object.values(s.ecs.walkable)) expect(walk.worn).toEqual({});
  const ground = groundForState(s);
  const road = geo.routes[0];
  expect(road.length).toBeGreaterThan(20);
  expect(road.some(h => Hex(h).toPoint().y < c.y - 250)).toBe(true);
  for(const h of grid) for(const [side,n] of Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).entries()) {
    const a=s.space[h]?.[0], b=s.space[n]?.[0];
    if(a && b && s.ecs.walkable[a].speed && s.ecs.walkable[b].speed) addBidirectionalLink(s.ecs,a,side,b);
  }
  expect(path(s, s.space[west][0], s.space[east][0])).toBeDefined();
  expect(Math.min(...road.map(h => Hex(h).toPoint().x))).toBeLessThan(c.x - 650);
  expect(Math.max(...road.map(h => Hex(h).toPoint().x))).toBeGreaterThan(c.x + 650);
  s.ecs.spatial.walker={...west.toPoint()}; s.ecs.holder={walker:{held:[]}}; s.ecs.personable={walker:{hunger:0}};
  s.ecs.controllable={walker:{controllerId:"walker"}}; s.ecs.playable={}; s.redraws=[];
  const world={places:{}}, goal=s.space[east][0]; let result;
  for(let i=0;i<10000;i++) {result=walk_to(s,"walker",world,1/14400,i==0,goal);if(result!=2)break;}
  expect(Math.hypot(s.ecs.spatial.walker.x-east.toPoint().x,s.ecs.spatial.walker.y-east.toPoint().y)).toBeLessThan(10);
  const high = grid.filter(h => ground.hex(h.toPoint()).centre > 400);
  expect(high.length).toBeGreaterThan(70);
  expect(Math.max(...high.map(h => ground.hex(h.toPoint()).centre))).toBeGreaterThan(600);
  for (const h of road) {
    const p = Hex(h).toPoint();
    for (let k=0;k<6;k++) { const o=Hex().corners()[k]; const next=Hex().corners()[(k+1)%6]; const slope=ground.slopeAt(p.x+(o.x+next.x)*0.25,p.y+(o.y+next.y)*0.25); expect(Math.hypot(slope.dx,slope.dy)).toBeLessThanOrEqual(MAX_WALK_SLOPE+1e-6); }
    expect(landscape[Hex(h)].terrain).toBe("grassland");
  }
});

it("records historical wear only on real journey legs and lets old wear expire", () => {
  const { state: s, tiles, villager } = rowOfTiles(5);
  s.ecs.personable = { [villager]: { age: 25 } };
  s.settlement = { journeys: [], appliedJourneys: {} };
  s.generatingHistory = true;
  s.days = 10;
  const trip = recordJourney(s, { key: "visit", people: [villager], from: tiles[0], to: tiles[3], day: 9, returnDay: 10, count: 20 });
  expect(trip).toBeDefined();
  expect(trip.day).toBeLessThanOrEqual(s.days);
  expect(trip.count).toBeGreaterThan(0);
  expect(trip.people).toHaveLength(1);
  trip.people.forEach(id => expect(s.ecs.personable[id]).toBeDefined());
  expect(Object.values(s.ecs.walkable).every(w => Object.keys(w.worn).length == 0)).toBe(true);
  flushJourneys(s);
  for (const step of trip.steps) {
    const key = [step.entrance ?? "C", step.exit ?? "C"].sort().join(",");
    expect(s.ecs.walkable[step.id].worn[key]).toBeGreaterThan(0);
    expect([trip.day, trip.returnDay].some(day => day > s.days - WEAR_LIFETIME && day <= s.days)).toBe(true);
    expect(transitBlocked(s, step.id)).toBe(false);
  }
  expect(s.ecs.walkable[tiles[4]].worn).toEqual({});
  const before = structuredClone(s.settlement.journeys);
  expect(recordJourney(s, { ...trip })).toBe(trip);
  expect(s.settlement.journeys).toEqual(before);
  s.days += WEAR_LIFETIME;
  updateRoadWear(s);
  expect(Object.values(s.ecs.walkable).every(w => Object.values(w.worn).every(value => value == 0))).toBe(true);
});

it("clears tree canopies from actual building footprints and retains woodland beyond them", () => {
  const { state: s, tiles } = rowOfTiles(4), p = s.ecs.spatial[tiles[1]];
  const [house, near, far] = newEntities(s, [
    { spatial: { ...p, immovable: true }, building: { entrance: 1 } },
    { spatial: { x: p.x + 55, y: p.y, immovable: true }, tree: {}, good: { type: "wood", amount: 3 } },
    { spatial: { x: p.x + 160, y: p.y, immovable: true }, tree: {}, good: { type: "wood", amount: 3 } }
  ]);
  expect(reserveBuildingClearance(s, house)).toContain(near);
  expect(s.ecs.spatial[near]).toBeUndefined();
  expect(Object.values(s.space).flat()).not.toContain(near);
  expect(treeAllowed(s, { x: p.x + 55, y: p.y })).toBe(false);
  expect(treeAllowed(s, s.ecs.spatial[far])).toBe(true);
  expect(Object.keys(s.ecs.tree)).toEqual([far]);
});
