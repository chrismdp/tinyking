// One complete generation of the seed shipped by the game.
import { generateMap, Hex, Grid, MIN_START_TREES } from "game/map";
import { find_place } from "game/tasks";
import { arrivalRoute, startIntro } from "game/intro";
import { groundForState, safeTile } from "game/geography";
import { createHeightField } from "game/height";
import { createLandField, worldPoint, MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { ALL_SIDES } from "game/hex";
import { habitatAt } from "game/biome_field";
import { generateWorld, homeOf } from "game/overworld";
import { historyStep } from "game/social";
import { topController } from "game/playable";
import { path } from "game/pathfinding";
import { treeAllowed } from "game/tree_clearance";
import { exitPoint } from "game/travel_geometry";
import { WEAR_LIFETIME } from "game/road_wear";
import { transitBlocked } from "game/land_use";
import { edgeSide, initialiseTravel, localSnapshot } from "game/travel";

let generated;
beforeAll(async () => {
  generated = { ecs: { nextId: 1 }, ui: { show: {} }, redraws: [], days: 0.375, game_speed: "normal" };
  const result = await generateMap(generated, 13, async () => {});
  expect(result.map).toBe(generated.map);
  generated.ui.playerId = result.playerId;
}, 1200000);

// Read-only checks share one shipped world; mutations use an isolated copy.
const world = () => generated;
const mutableWorld = () => structuredClone(generated);

it("gives evening visitors room for their bodies outside houses and animal pens", () => {
  const s = mutableWorld();
  s.days = 0.8;
  for (const village of Object.values(s.villages)) {
    const visitors = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && s.ecs.village[id].villageId == village.id);
    const places = visitors.map(id => {
      const w = s.ecs.planner[id].world;
      find_place(s, id, w, 0, true, "meet", "space");
      return w.places.meet;
    });
    for (const [i, p] of places.entries()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(s.ecs.village[p.id].villageId).toBe(village.id);
      const centre = s.ecs.spatial[p.id];
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeLessThan(300);
      for (const other of places.slice(i + 1)) expect(Math.hypot(p.x - other.x, p.y - other.y)).toBeGreaterThanOrEqual(32);
      for (const house of Object.keys(s.ecs.building)) {
        const h = s.ecs.spatial[house];
        expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeGreaterThanOrEqual(55);
      }
      for (const pen of Object.values(s.ecs.pasture)) {
        expect(Math.abs(p.x - pen.centre.x) >= pen.halfWidth + 12 || Math.abs(p.y - pen.centre.y) >= pen.halfDepth + 12).toBe(true);
      }
      for (const field of Object.keys(s.ecs.farmable)) {
        expect(Hex().fromPoint(p).toString()).not.toBe(Hex().fromPoint(s.ecs.spatial[field]).toString());
      }
      for (const [id, workplace] of Object.entries(s.ecs.workplace)) {
        const w = s.ecs.spatial[id];
        expect(Math.hypot(p.x - w.x, p.y - w.y)).toBeGreaterThanOrEqual(workplace.trade == "miller" ? 45 : 30);
      }
    }
  }
});

it("starts without a camp and walks two adjacent hexes inward from the boundary", async () => {
  const state = world();
  expect(Object.keys(state.ecs.camp || {})).toHaveLength(0);
  expect(state.ecs.household[state.ui.playerId]).toBeUndefined();
  const route = arrivalRoute(state);
  const at = point => (state.space[Hex().fromPoint(point)] || []).find(id => state.ecs.mappable[id]);
  expect(at(route.points[0])).toBeUndefined();
  expect(route.tileIds).toHaveLength(3);
  const centre = Hex(state.map.centre);
  const hexes = route.tileIds.map(id => Hex().fromPoint(state.ecs.spatial[id]));
  expect(hexes.map(hex => centre.distance(hex))).toEqual([state.map.radius, state.map.radius - 1, state.map.radius - 2]);
  expect(hexes[0].distance(hexes[2])).toBe(2);
  for (let i = 0; i < route.tileIds.length; i++) {
    expect(state.ecs.walkable[route.tileIds[i]].speed).toBeGreaterThan(0);
    if (i) expect(Object.values(state.ecs.walkable[route.tileIds[i - 1]].neighbours)).toContain(route.tileIds[i]);
  }
  expect(at(route.points.at(-1))).toBe(route.tileIds.at(-1));
  expect(Hex().fromPoint(route.campPoint).toString()).toBe(Hex(state.map.playerStartTile).toString());
  expect(arrivalRoute(state)).toEqual(route);

}, 15000);

const tileHexes = state => Object.keys(state.ecs.mappable)
  .map(id => ({ id, hex: Hex().fromPoint(state.ecs.spatial[id]) }));
describe("generateMap", () => {
  it("makes the map one big hexagon of small hexes, radius 22 round its centre", async () => {
    const state = world();
    const centre = Hex(state.map.centre.x, state.map.centre.y);
    const tiles = tileHexes(state);

    expect(state.map.radius).toEqual(22);
    // NOTE: 1 + 3 * 22 * 23 hexes make a full hexagon of radius 22
    expect(tiles.length).toEqual(1519);
    expect(new Set(tiles.map(t => t.hex.toString())).size).toEqual(1519);
    tiles.forEach(t => expect(centre.distance(t.hex)).toBeLessThanOrEqual(22));
    Grid.hexagon({ center: centre, radius: 22 }).forEach(hex =>
      expect(tiles.some(t => t.hex.x == hex.x && t.hex.y == hex.y)).toBe(true));
  });

  it("keeps village and family density as the map grows in area", async () => {
    const states = [world()];
    const houses = states.reduce((n, s) => n + Object.keys(s.ecs.building).length, 0);
    const people = states.reduce((n, s) => n + Object.keys(s.ecs.personable).length, 0);
    // The old three-map lower bound was 81 houses / 150 people.
    // Keep its per-map density floor on the shipped map.
    expect(houses).toBeGreaterThanOrEqual(27);
    expect(people).toBeGreaterThanOrEqual(50);
  });

  it("has sea on some edges and land running off others, following the shared field", async () => {
    let sea = 0;
    let land = 0;
    const state = world();
    const centre = Hex(state.map.centre);
    const field = createLandField(state.world.landSeed);
    const home = homeOf(state.world);
    const rim = tileHexes(state).filter(t => centre.distance(t.hex) == state.map.radius);
    expect(rim.length).toEqual(132);
    for (const {id, hex} of rim) {
      const isLand = field.landAt(worldPoint(home, hex.toPoint())) >= 0;
      const water = state.ecs.mappable[id].terrain.includes("water");
      if (!isLand) { expect(water).toBe(true); sea++; }
      if (!water) { land++; }
    }

    expect(sea).toBeGreaterThan(0);
    expect(land).toBeGreaterThan(0);
  });

  it("is mostly land before settlements clear any terrain, on the shipped map", async () => {
    const state = world();
    expect(homeOf(state.world).landFraction).toBeGreaterThanOrEqual(0.65);
    const land = Object.values(state.ecs.mappable).filter(t => !t.terrain.includes("water"));
    expect(land.length / 1519).toBeGreaterThanOrEqual(0.6);
  });

  it("keeps everything at or above zero, so the map's points stay positive", async () => {
    const state = world();
    tileHexes(state).forEach(({ hex }) => {
      const { x, y } = hex.toPoint();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    });
  });

  it("starts the player on grassland with grassland all round it, on the shipped map", async () => {
    const state = world();
    const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y);
    Grid.spiral({ center: start, radius: 1 }).forEach(hex => {
      const id = state.space[hex.toString()].find(e => state.ecs.mappable[e]);
      expect(state.ecs.mappable[id].terrain).toEqual("grassland");
    });
  });

  it("keeps the world of world hexes in state, playing in the chosen land hex", async () => {
    const state = world();
    expect(state.world).toEqual(generateWorld(13));
    expect(homeOf(state.world)).toBeDefined();
  });

  it("samples actual physical tile positions continuously and keeps alpine ground colder", async () => {
    let high=0,colder=0;
    const state=world(),ground=groundForState(state),values=[];
    for(const id in state.ecs.mappable) {
      const tile=state.ecs.mappable[id],point=state.ecs.spatial[id];
      const elevation=ground.hex(point).centre;
      const expected=habitatAt(state.world,worldPoint(state.world.home,point),elevation);
      expect(tile.elevation).toBeCloseTo(elevation,10);
      expect(tile.climateWarmth).toBeCloseTo(expected.climateWarmth,12);
      expect(tile.moistureValue).toBeCloseTo(expected.moistureValue,12);
      expect(tile.biomeMix).toEqual(expected.biomeMix);
      expect(tile.temperature).toBe(expected.temperature);
      values.push(tile.warmth);
      high+=elevation>=260?1:0;
      colder+=tile.warmth<tile.climateWarmth?1:0;
    }
    expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(.05);
    // Check physical geometry and resources on this same completed world.
    const field=createLandField(state.world.landSeed);
    for(const id of Object.keys(state.ecs.building)) {
      const p=state.ecs.spatial[id],pad=ground.hex(p).corners;
      expect(Math.max(...pad)-Math.min(...pad)).toBeLessThan(1e-6);
      expect(Math.abs(ground.hex(p).centre-field.elevationAt(worldPoint(state.world.home,p)))).toBeLessThan(35);
    }
    let roads=0;
    for(const id in state.ecs.mappable) {
      const tile=state.ecs.mappable[id],p=state.ecs.spatial[id];
      if(state.ecs.farmable[id])expect(tile.route?.length || 0).toBe(0);
      if(!tile.route?.length)continue;
      roads++;
      const corners=Hex().corners();
      for(let k=0;k<6;k++) {
        const a=corners[k],b=corners[(k+1)%6],slope=ground.slopeAt(p.x+(a.x+b.x)/4,p.y+(a.y+b.y)/4);
        expect(Math.hypot(slope.dx,slope.dy)).toBeLessThanOrEqual(.55+1e-6);
      }
      const hex=Hex().fromPoint(p),neighbours=Grid.hexagon({center:hex,radius:1}).neighborsOf(hex,ALL_SIDES);
      for(const side of tile.route) {
        const n=neighbours[side].toPoint(),dx=n.x-p.x,dy=n.y-p.y,slope=ground.slopeAt(p.x+dx/4,p.y+dy/4);
        expect(Math.abs((slope.dx*dx+slope.dy*dy)/Math.hypot(dx,dy))).toBeLessThanOrEqual(.24+1e-6);
      }
    }
    expect(roads).toBeGreaterThan(20);
    const tileAt=p=>(state.space[Hex().fromPoint(p)] || []).find(id=>state.ecs.mappable[id]);
    const start=tileAt(Hex(state.map.playerStartTile).toPoint()),reached=new Set([start]);let frontier=[start];
    for(let d=0;d<5;d++) {
      frontier=frontier.flatMap(id=>Object.values(state.ecs.walkable[id].neighbours)).filter(id=>!reached.has(id));
      frontier.forEach(id=>reached.add(id));
    }
    expect(Object.keys(state.ecs.tree).filter(id=>state.ecs.good[id].amount>0 && reached.has(tileAt(state.ecs.spatial[id]))).length).toBeGreaterThanOrEqual(MIN_START_TREES);
    expect(Object.keys(state.ecs.forageable).filter(id=>reached.has(tileAt(state.ecs.spatial[id]))).length).toBeGreaterThanOrEqual(3);

    expect(high).toBeGreaterThan(20);expect(colder).toBeGreaterThan(0);
  });

  it("leaves walking speed to the terrain alone, whatever the world hex", async () => {
    const speeds = { "grassland": 1, "stone": 0.5, "mountain": 0, "shallow water": 0, "deep water": 0 };
    const state = world();
    for (const id in state.ecs.mappable) {
      expect(state.ecs.walkable[id].speed).toEqual(speeds[state.ecs.mappable[id].terrain]);
    }
  });
});

it("leaves trees within reach of the start on the shipped map", async () => {
  const state = world();
  // NOTE: walk out from the start along the walkable links, five hexes at most
  const tileAt = hex => (state.space[hex.toString()] || []).find(e => state.ecs.mappable[e]);
  const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y);
  const reached = new Set([tileAt(start)]);
  let frontier = [tileAt(start)];
  for (let d = 0; d < 5; d++) {
    frontier = frontier.flatMap(id => Object.values(state.ecs.walkable[id].neighbours))
      .filter(id => !reached.has(id));
    frontier.forEach(id => reached.add(id));
  }
  const trees = Object.keys(state.ecs.good)
    .filter(id => state.ecs.good[id].type == "wood" && reached.has(tileAt(Hex().fromPoint(state.ecs.spatial[id]))));
  expect([13, homeOf(state.world).biome, trees.length >= MIN_START_TREES])
    .toEqual([13, homeOf(state.world).biome, true]);

});

describe("villages", () => {
  it("groups houses into named hamlets of 3–8, with space around the camp start", async () => {
    const state = world();
    expect(state.villages).toBeDefined();
    const villages = Object.values(state.villages);
    expect(villages.length).toBeGreaterThanOrEqual(3);
    expect(new Set(villages.map(v => v.name)).size).toBe(villages.length);
    const houses = villages.flatMap(v => v.houses);
    expect(new Set(houses).size).toBe(houses.length);
    expect(houses.length).toBe(Object.keys(state.ecs.building).length);
    expect(Object.keys(state.ecs.camp || {})).toHaveLength(0);
    const start = Hex(state.map.playerStartTile);
    for (const village of villages) {
      expect(village.name.length).toBeGreaterThan(2);
      expect(village.houses.length).toBeGreaterThanOrEqual(3);
      expect(village.houses.length).toBeLessThanOrEqual(8);
      for (const id of village.houses) {
        const hex = Hex().fromPoint(state.ecs.spatial[id]);
        expect(state.ecs.village[id].villageId).toBe(village.id);
        expect(start.distance(hex)).toBeGreaterThanOrEqual(3);
        expect(Hex(village.centre).distance(hex)).toBeLessThanOrEqual(3);
        expect(village.houses.some(other => other != id &&
          hex.distance(Hex().fromPoint(state.ecs.spatial[other])) <= 3)).toBe(true);
      }
    }
    const player = Object.keys(state.ecs.playable)[0];
    expect(state.ecs.village[player].villageId).toBeNull();
    expect(state.ecs.household[player]).toBeUndefined();
    for (const id in state.ecs.personable) {
      if (id == player) continue;
      const home = state.ecs.household[id].houseId;
      expect(state.ecs.village[id].villageId).toBe(state.ecs.village[home].villageId);
    }
  });
});

it("keeps the shipped population roughly stable over five seasonal years", () => {
  const generated = mutableWorld();
  const components = ["personable", "personality", "kinship", "relationships", "household", "village", "building", "controllable", "possession", "nameable", "spatial", "profession"];
  let s = { peopleSeed: generated.peopleSeed, opinionThresholds: generated.opinionThresholds, villages: generated.villages, knowledge: generated.knowledge, events: generated.events, ecs: { nextId: generated.ecs.nextId } };
  for (const key of components) s.ecs[key] = generated.ecs[key] || {};
  const count = s => Object.values(s.ecs.personable).filter(p => !p.dead).length;
  const before = count(s);
  for (let season = 0; season < 20; season++) s = historyStep(s, season);
  expect(count(s) / before).toBeGreaterThanOrEqual(0.75);
  expect(count(s) / before).toBeLessThanOrEqual(1.3);
});

it("makes camp two hexes in with a bedroll, reachable village, wood and food", () => {
  const state = mutableWorld();
  const { map } = state, playerId = state.ui.playerId;
  const start = Hex(map.playerStartTile);
  expect(MAP_CENTRE.distance(start)).toBe(MAP_RADIUS - 2);
  expect(Object.keys(state.ecs.camp || {})).toHaveLength(0);
  state.map = map;
  state.ui.playerId = playerId;
  startIntro(state, { skip: true });
  expect(Object.keys(state.ecs.personable).filter(id => topController(state.ecs, id) == playerId)).toEqual([playerId]);
  expect(Object.keys(state.ecs.building).every(id => topController(state.ecs, id) != playerId)).toBe(true);
  expect(state.ecs.kinship[playerId]).toMatchObject({ parents: [], children: [], spouse: null });
  expect(state.ecs.village[playerId].villageId).toBeNull();
  const camp = Object.keys(state.ecs.camp)[0];
  expect(state.ecs.sleepable[camp]).toMatchObject({ capacity: 1 });
  expect(state.ecs.container[camp]).toBeUndefined();
  const tileAt = point => state.space[Hex().fromPoint(point)].find(id => state.ecs.mappable[id]);
  const from = tileAt(state.ecs.spatial[playerId]);
  expect(state.ecs.walkable[from].speed).toBeGreaterThan(0);
  expect(state.ecs.mappable[from].terrain).toBe("grassland");
  const nearby = Object.keys(state.ecs.building).filter(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) <= 8);
  expect(nearby.some(id => path(state, from, tileAt(state.ecs.spatial[id]))?.length > 0)).toBe(true);
  for (const ids of [Object.keys(state.ecs.tree), Object.keys(state.ecs.forageable)]) {
    expect(ids.some(id => start.distance(Hex().fromPoint(state.ecs.spatial[id])) <= 4 &&
      path(state, from, tileAt(state.ecs.spatial[id]))?.length > 0)).toBe(true);
  }
}, 15000);

it("initializes weather and snow for every generated world hex and local tile", () => {
  const state = world();
  expect(Object.keys(state.weather)).toHaveLength(91);
  expect(Object.keys(state.snow)).toHaveLength(1519);
  expect(Object.values(state.snow).some(depth => depth > 0)).toBe(true);
});

it("keeps jittered trees on existing walkable grassland near the entry edge", async () => {
  const state = world();
  const invalid = Object.keys(state.ecs.tree).filter(id => {
    const hex = Hex().fromPoint(state.ecs.spatial[id]);
    const tile = (state.space[hex] || []).find(id => state.ecs.mappable[id]);
    return !tile || state.ecs.walkable[tile].speed <= 0 || state.ecs.mappable[tile].terrain != "grassland";
  });
  expect(invalid).toEqual([]);
});

const slopes = (ground, p) => Hex().corners().map((a, k, corners) => {
  const b = corners[(k + 1) % 6];
  const slope = ground.slopeAt(p.x + (a.x + b.x) / 4, p.y + (a.y + b.y) / 4);
  return Math.hypot(slope.dx, slope.dy);
});

it("occupied hexes keep level house pads and gentle road triangles at local altitude", () => {
  const s = world();
  const ground = groundForState(s), field = createLandField(s.world.landSeed);
  const natural=createHeightField({seed:0,
    terrainAt:k=>field.terrainAt(worldPoint(s.world.home,Hex(...k.split(",").map(Number)).toPoint())),
    elevationAt:(x,y)=>field.elevationAt(worldPoint(s.world.home,{x,y}))});
  expect(ground.hex(Hex(6,8).toPoint()).corners).toEqual(natural.hex(Hex(6,8).toPoint()).corners);
  for (const id of Object.keys(s.ecs.building)) {
    const p = s.ecs.spatial[id], hs = ground.hex(p).corners;
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(1e-6);
    expect(Math.abs(ground.hex(p).centre - field.elevationAt(worldPoint(s.world.home, p)))).toBeLessThan(35);
    for(const h of Grid.hexagon({center:Hex().fromPoint(p),radius:1})) {
      if(safeTile(natural,h.toPoint())) expect(safeTile(ground,h.toPoint())).toBe(true);
    }
  }
  let roads = 0;
  for (const id of Object.keys(s.ecs.mappable)) {
    if (!s.ecs.mappable[id].route?.length) continue;
    roads++;
    const p = s.ecs.spatial[id];
    expect(Math.max(...slopes(ground, p))).toBeLessThanOrEqual(.55 + 1e-6);
    for (const side of s.ecs.mappable[id].route) {
      const n = Grid.hexagon({ center: Hex().fromPoint(p), radius: 1 }).neighborsOf(Hex().fromPoint(p), ALL_SIDES)[side].toPoint();
      const dx = n.x - p.x, dy = n.y - p.y, distance = Math.hypot(dx, dy);
      const slope = ground.slopeAt(p.x + dx / 4, p.y + dy / 4);
      expect(Math.abs((slope.dx * dx + slope.dy * dy) / distance)).toBeLessThanOrEqual(.24 + 1e-6);
    }
  }
  expect(roads).toBeGreaterThan(20);
}, 15000);

it("prepares facing-edge routes with food, wood and a reachable village, without a replacement player", async () => {
  const make = async () => {
    const s = mutableWorld();
    const descendants = Object.keys(s.ecs.personable).filter(id => s.ecs.personable[id].born < 0);
    expect(descendants.length).toBeGreaterThan(0);
    for (const id of descendants) expect(s.ecs.personality[id].opinionThresholds).toBeUndefined();
    initialiseTravel(s, 13);
    for (const id of descendants) expect(s.ecs.personality[id].opinionThresholds).toEqual(s.opinionThresholds);
    return s;
  };
  const s = await make();
  const home = localSnapshot(s);
  const exits = Object.keys(s.map.entrances);
  expect(exits.length).toBeGreaterThan(0);
  for (const side of exits) {
    const entry = s.map.entrances[side];
    expect(edgeSide(s, entry.tileIds[0])).toBe(+side);
    expect(entry.tileIds.map(id => Hex(s.map.centre).distance(Hex().fromPoint(s.ecs.spatial[id])))).toEqual([22, 21, 20]);
    expect(entry.wood).toBeGreaterThanOrEqual(6);
    expect(entry.food).toBeGreaterThanOrEqual(3);
    expect(entry.villageReachable).toBe(true);
  }
  expect(home.map).toEqual(s.map);
}, 15000);
it("generated roads connect real doors and travel entrances, remain lazy, and retain only recorded historical wear", async () => {
  const s = world();
  const ground=groundForState(s);
  for(const t in s.ecs.tree) expect(treeAllowed(s,s.ecs.spatial[t])).toBe(true);
  expect(s.map.geography.routes.length).toBeGreaterThan(0);
  expect(s.travel).toBeUndefined();
  for (const entry of Object.values(s.map.entrances)) {
    expect(s.ecs.mappable[entry.tileIds[0]].route.length).toBeGreaterThan(0);
    const departure = exitPoint(s, entry.tileIds[0]);
    expect(Math.hypot(departure.x-entry.start.x,departure.y-entry.start.y)).toBeLessThan(1e-6);
    expect(Object.keys(s.ecs.building).some(h => path(s,entry.tileIds[2],s.space[Hex().fromPoint(s.ecs.spatial[h])].find(id=>s.ecs.mappable[id])))).toBe(true);
  }
  const provenance=new Map();
  for(const trip of s.settlement.journeys) {
    expect(trip.day).toBeLessThanOrEqual(s.days);
    expect(trip.count).toBeGreaterThan(0);
    expect(trip.people.length).toBeGreaterThan(0);
    for(const person of trip.people)expect(s.ecs.personable[person]).toBeDefined();
    for(const step of trip.steps)if(step.entrance!=null || step.exit!=null) {
      const key=[step.entrance ?? "C",step.exit ?? "C"].sort().join(",");
      const legs=provenance.get(step.id+":"+key) || [];
      legs.push(trip.day,...(trip.returnDay!=null?[trip.returnDay]:[]));
      provenance.set(step.id+":"+key,legs);
    }
  }
  let travelled=0,untravelled=0;
  for (const id in s.ecs.mappable) {
    const worn=s.ecs.walkable[id].worn;
    if(!Object.keys(worn).length)untravelled++;
    for(const [key,value]of Object.entries(worn)) {
      const legs=provenance.get(id+":"+key);
      expect(legs).toBeDefined();
      if(value>0) {
        travelled++;
        expect(legs.some(day=>day>s.days-WEAR_LIFETIME && day<=s.days)).toBe(true);
        expect(transitBlocked(s,id)).toBe(false);
      }
    }
    if (s.ecs.mappable[id].route?.length) expect(s.ecs.walkable[id].speed).toBeGreaterThan(0);
  }
  expect(travelled).toBeGreaterThan(0);
  expect(untravelled).toBeGreaterThan(0);
  for (const house in s.ecs.building) {
    const p=s.ecs.spatial[house], hs=ground.hex(p).corners;
    expect(Math.max(...hs)-Math.min(...hs)).toBeLessThan(25);
  }
},15000);
