// Cross-component contracts whose named seed layouts require the full pipeline.
import { generateMap, Hex, Grid, MIN_START_TREES } from "game/map";
import { TIMBER, amountOf } from "game/goods";
import { generateVillageLife } from "game/villages";
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

const worlds = new Map();
async function world(seed = 1, days = 0.375, fresh = false, options = {}) {
  const key = seed + ":" + days + ":" + JSON.stringify(options);
  if (!fresh && worlds.has(key)) return worlds.get(key);
  const state = seed == 98765 && !fresh ? structuredClone(await world(1234)) : { ecs: { nextId: 1 }, ui: { show: {} }, redraws: [], days, game_speed: "normal" };
  state.ecs = { nextId: 1 };
  state.days = days;
  const result = await generateMap(state, seed, async () => {}, options);
  expect(result.map).toBe(state.map);
  state.map = result.map;
  state.ui.playerId = result.playerId;
  if (!fresh) worlds.set(key, state);
  return state;
}

// Read-only contracts share the single generation. Only mutation scenarios
// take a copy, so terrain queries do not clone whole histories repeatedly.
const mutableWorld = async seed => structuredClone(await world(seed));

it("provides a well and green in every village and preserves real paid venues or their spatial wait", async () => {
  const s = await mutableWorld(20);
  // INITIAL funding fixture: keep each missing venue funded after the corrected
  // food/trade history. Replace grain with equal timber before taking the stock
  // snapshot; generation must still find a real clear footprint before spending.
  for(const v of Object.values(s.villages))if(v.houses.length>=5 && ["chapel","alehouse"].some(kind=>!v.sharedPlaces.some(id=>s.ecs.meetingPlace[id].kind==kind))) {
    const store=s.ecs.container[s.ecs.household[v.houses[0]].storeId];
    const needed=Math.max(0,8-amountOf(store.amounts,TIMBER));
    expect(store.amounts.grain).toBeGreaterThanOrEqual(needed);
    store.amounts.grain-=needed;store.amounts.wood=(store.amounts.wood || 0)+needed;
  }
  const missing=[];
  for (const v of Object.values(s.villages)) {
    const kinds = v.sharedPlaces.map(id => s.ecs.meetingPlace[id].kind);
    expect(kinds).toContain("well");
    expect(kinds).toContain("green");
    for(const kind of ["chapel","alehouse"]) {
      const venue=v.sharedPlaces.find(id=>s.ecs.meetingPlace[id].kind==kind);
      if(v.houses.length<5)expect(venue).toBeUndefined();
      if(venue) {
        const built=s.ecs.meetingPlace[venue];
        expect(v.houses.length).toBeGreaterThanOrEqual(5);
        expect(v.houses).toContain(built.houseId);
        expect(s.ecs.controllable[venue].controllerId).toBe(built.houseId);
        expect(built.builtDay).toBeLessThanOrEqual(s.days);
      } else if(v.houses.length>=5)missing.push({village:v.id,kind,timber:v.houses.map(id=>amountOf(s.ecs.container[s.ecs.household[id].storeId].amounts,TIMBER))});
    }
    for (const id of v.sharedPlaces) expect(s.ecs.village[id].villageId).toBe(v.id);
  }
  // Seed 20 has a compact seven-home village with timber but no free public
  // venue footprint. A native layout retry must preserve its stock and wait.
  expect(missing.length).toBeGreaterThan(0);
  generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);
  for(const entry of missing) {
    const v=s.villages[entry.village];
    expect(Math.max(...entry.timber)).toBeGreaterThanOrEqual(8);
    expect(v.sharedPlaces.some(id=>s.ecs.meetingPlace[id].kind==entry.kind)).toBe(false);
    expect(v.houses.map(id=>amountOf(s.ecs.container[s.ecs.household[id].storeId].amounts,TIMBER))).toEqual(entry.timber);
  }
});


it.each([1, 8, 13, 20, 1234, 98765])("gives evening visitors room for their bodies outside houses and animal pens (seed %s)", async seed => {
  const s = await mutableWorld(seed);
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
  if (seed == 8) worlds.delete("8:0.375:{}");
});

it("starts without a camp and walks two adjacent hexes inward from the boundary, across seeds", async () => {
  for (const seed of [1, 2, 13, 20, 53, 84, 1234, 98765]) {
    const state = await world(seed);
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
  }
}, 15000);


const MAP_SEEDS = [20, 1234, 98765];
const tileHexes = state => Object.keys(state.ecs.mappable)
  .map(id => ({ id, hex: Hex().fromPoint(state.ecs.spatial[id]) }));
async function regenerateWorld(state, seed) {
  state.ecs = { nextId: 1 };
  state.days = 0.375;
  const { map } = await generateMap(state, seed, async () => {});
  state.map = map;
}

describe("generateMap", () => {
  it("leaves nothing from a previous map in the space index when the map is regenerated", async () => {
    const state = await world(98765);

    for (const hex in state.space) {
      for (const id of state.space[hex]) {
        expect(state.ecs.spatial[id]).toBeDefined();
        expect(Hex().fromPoint(state.ecs.spatial[id]).toString()).toEqual(hex);
      }
      expect(state.space[hex].filter(id => state.ecs.mappable[id]).length).toBeLessThanOrEqual(1);
    }
  });

  it("makes the map one big hexagon of small hexes, radius 22 round its centre", async () => {
    const state = await world(1234);
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
    const states = await Promise.all(MAP_SEEDS.map(world));
    const houses = states.reduce((n, s) => n + Object.keys(s.ecs.building).length, 0);
    const people = states.reduce((n, s) => n + Object.keys(s.ecs.personable).length, 0);
    // NOTE: the radius-11 fixtures had 27 houses and 50 villagers in total.
    // Allow different coasts and clearings, while requiring roughly four times the population.
    expect(houses).toBeGreaterThanOrEqual(27 * 3);
    expect(people).toBeGreaterThanOrEqual(50 * 3);
  });

  it("has sea on some edges and land running off others, following the shared field", async () => {
    let sea = 0;
    let land = 0;
    for (const seed of MAP_SEEDS) {
      const state = await world(seed);
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
    }
    expect(sea).toBeGreaterThan(0);
    expect(land).toBeGreaterThan(0);
  });

  it("is mostly land before settlements clear any terrain, for every tested seed", async () => {
    for (const seed of MAP_SEEDS) {
      const state = await world(seed);
      expect(homeOf(state.world).landFraction).toBeGreaterThanOrEqual(0.65);
      const land = Object.values(state.ecs.mappable).filter(t => !t.terrain.includes("water"));
      expect(land.length / 1519).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("replays the same complete map from the same seed", async () => {
    const replay = await world(1234, 0.375, true);
    expect(replay).toEqual(await world(1234));
  });

  it("keeps everything at or above zero, so the map's points stay positive", async () => {
    const state = await world(1234);
    tileHexes(state).forEach(({ hex }) => {
      const { x, y } = hex.toPoint();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    });
  });

  it("starts the player on grassland with grassland all round it, on every seed", async () => {
    for (const seed of MAP_SEEDS) {
      const state = await world(seed);
      const start = Hex(state.map.playerStartTile.x, state.map.playerStartTile.y);
      Grid.spiral({ center: start, radius: 1 }).forEach(hex => {
        const id = state.space[hex.toString()].find(e => state.ecs.mappable[e]);
        expect(state.ecs.mappable[id].terrain).toEqual("grassland");
      });
    }
  });

  it("keeps the world of world hexes in state, playing in the chosen land hex", async () => {
    for (const seed of MAP_SEEDS) {
      const state = await world(seed);
      expect(state.world).toEqual(generateWorld(seed));
      expect(homeOf(state.world)).toBeDefined();
    }
  });

  it("samples actual physical tile positions continuously and keeps alpine ground colder", async () => {
    let high=0,colder=0;
    for(const seed of [13,20]) {
      const state=await world(seed),ground=groundForState(state),values=[];
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
      // Reuse these ordinary maps for the unchanged native geometry/resource
      // limits, rather than generating another pair only for this correction.
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
    }
    expect(high).toBeGreaterThan(20);expect(colder).toBeGreaterThan(0);
  });

  it("leaves walking speed to the terrain alone, whatever the world hex", async () => {
    const speeds = { "grassland": 1, "stone": 0.5, "mountain": 0, "shallow water": 0, "deep water": 0 };
    for (const seed of MAP_SEEDS) {
      const state = await world(seed);
      for (const id in state.ecs.mappable) {
        expect(state.ecs.walkable[id].speed).toEqual(speeds[state.ecs.mappable[id].terrain]);
      }
    }
  });
});

it("leaves trees within reach of the start on real maps, desert and tundra too", async () => {
  for (const seed of MAP_SEEDS) {
    const state = await world(seed);
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
    expect([seed, homeOf(state.world).biome, trees.length >= MIN_START_TREES])
      .toEqual([seed, homeOf(state.world).biome, true]);
  }
});

it("initializes all visual weather and snow afresh when a map is regenerated", async () => {
  const state = { snow: { stale: 1 }, snowRevision: 99, weather: { stale: { type: "snow" } } };
  await regenerateWorld(state, 13);
  expect(Object.keys(state.weather)).toHaveLength(91);
  expect(state.weather.stale).toBeUndefined();
  expect(Object.keys(state.snow)).toHaveLength(1519);
  expect(state.snow.stale).toBeUndefined();
  const clean = await world(13);
  expect(state.weather).toEqual(clean.weather);
  expect(state.snow).toEqual(clean.snow);
  expect(state.snowRevision).toBe(clean.snowRevision);
  expect(Object.values(state.snow).some(depth => depth > 0)).toBe(true);
});

describe("villages", () => {
  it("groups houses into named hamlets of 3–8, with space around the camp start", async () => {
    for (const seed of MAP_SEEDS) {
      const state = await world(seed);
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
    }
  });
});


it.each([20, 1234, 98765])("keeps seed %s's population roughly stable over five seasonal years", async seed => {
  const generated = structuredClone(await world(seed));
  const components = ["personable", "personality", "kinship", "relationships", "household", "village", "building", "controllable", "possession", "nameable", "spatial", "profession"];
  let s = { peopleSeed: generated.peopleSeed, opinionThresholds: generated.opinionThresholds, villages: generated.villages, knowledge: generated.knowledge, events: generated.events, ecs: { nextId: generated.ecs.nextId } };
  for (const key of components) s.ecs[key] = generated.ecs[key] || {};
  const count = s => Object.values(s.ecs.personable).filter(p => !p.dead).length;
  const before = count(s);
  for (let season = 0; season < 20; season++) s = historyStep(s, season);
  expect(count(s) / before).toBeGreaterThanOrEqual(0.75);
  expect(count(s) / before).toBeLessThanOrEqual(1.3);
});


it.each([1, 2, 13, 20, 53, 84, 1234, 98765])("makes camp two hexes in with a bedroll, reachable village, wood and food (seed %s)", async seed => {
  const state = await mutableWorld(seed);
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
  if ([2, 53, 84, 1234, 98765].includes(seed)) worlds.delete(seed + ":0.375:{}");
}, 15000);

it("keeps jittered trees on existing walkable grassland near the entry edge", async () => {
  const state = await world(13);
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

it.each([13,1,20])("normal seed %s occupied hexes keep level house pads and gentle road triangles at local altitude", async seed => {
  const s = await world(seed);
  const ground = groundForState(s), field = createLandField(s.world.landSeed);
  const natural=createHeightField({seed:0,
    terrainAt:k=>field.terrainAt(worldPoint(s.world.home,Hex(...k.split(",").map(Number)).toPoint())),
    elevationAt:(x,y)=>field.elevationAt(worldPoint(s.world.home,{x,y}))});
  if(seed==13) expect(ground.hex(Hex(6,8).toPoint()).corners).toEqual(natural.hex(Hex(6,8).toPoint()).corners);
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
  if ([1, 20].includes(seed)) worlds.delete(seed + ":0.375:{}");
}, 15000);


it("generates deterministic facing-edge routes with food, wood and a reachable village, without a replacement player", async () => {
  const make = async () => {
    const s = await mutableWorld(13);
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
it("fresh destinations are deterministic per coordinates, account for elapsed seasons, and allocate only actual entity IDs", async () => {
  const {
    community
  } = require("./support/travel");
  const {
    ensureMap
  } = require("../src/game/travel");
  const {
    neighbours,
    worldKey
  } = require("../src/game/travel_geometry");
  const a = community(),
    b = community();
  // Use the real seed-13 overworld, and retain only the diagnostic source map.
  const {
    generateWorld
  } = require("../src/game/overworld");
  a.s.world = generateWorld(13);
  b.s.world = generateWorld(13);
  const d = neighbours(a.s.world.home).find(h => a.s.world.hexes.some(n => worldKey(n) === worldKey(h) && !n.ocean));
  const key = worldKey(d);
  a.s.travel.season = 3;
  b.s.travel.season = 3;
  const x = await ensureMap(a.s, key),
    y = await ensureMap(b.s, key);
  expect(x).toEqual(y);
  expect(x.social.lastSeason).toBe(3);
  expect(Object.keys(x.ecs.playable)).toHaveLength(0);
  const sourceIds = new Set(Object.values(a.s.ecs).filter(v => v && typeof v === "object").flatMap(c => Object.keys(c)));
  const destIds = Object.values(x.ecs).filter(v => v && typeof v === "object").flatMap(c => Object.keys(c));
  expect(destIds.some(id => sourceIds.has(id))).toBe(false);
  // A lazily generated destination must have real final-graph village access,
  // just as the initial map does. Reuse this existing ordinary neighbour.
  for (const entry of Object.values(x.map.entrances)) {
    expect(entry.villageReachable).toBe(true);
    expect(Object.keys(x.ecs.building).some(id => path(x, entry.tileIds[2],
      x.space[Hex().fromPoint(x.ecs.spatial[id])].find(tile => x.ecs.mappable[tile])))).toBe(true);
  }
  expect(x.map.centre).toEqual({
    x: 22,
    y: 22
  });
  expect(x.ecs.nextId).toEqual(expect.any(Number));
  expect(a.s.travel.historyCalls.filter(c => c.key === key).map(c => c.season)).toEqual([1, 2, 3]);
  expect(await ensureMap(a.s, key)).toBe(x);
  expect(Object.keys(a.s.travel.maps)).toHaveLength(2);
}, 20000);
it("generated roads connect real doors and travel entrances, remain lazy, and retain only recorded historical wear", async () => {
  const s = await world(13);
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

it("the labelled initial ridge fixture still has a two-hex arrival and a real cross-pass graph", async () => {
  const {startIntro}=require("game/intro");
  const s = await world(13, 0.375, false, { geographyFixture: "mountain-pass" });
  startIntro(s,{skip:true});
  expect(s.intro.tileIds).toHaveLength(3);
  const ground=groundForState(s), c=MAP_CENTRE.toPoint();
  expect(Math.max(...Object.keys(s.ecs.mappable).map(id=>ground.hex(s.ecs.spatial[id]).centre))).toBeGreaterThan(600);
  const crossed=s.map.geography.routes.find(route=>Math.min(...route.map(h=>Hex(h).toPoint().x))<c.x-650 && Math.max(...route.map(h=>Hex(h).toPoint().x))>c.x+650);
  expect(crossed).toBeDefined();
  const tile=h=>s.space[Hex(h)].find(id=>s.ecs.mappable[id]);
  expect(path(s,tile(crossed[0]),tile(crossed.at(-1)))).toBeDefined();
},15000);
