import { treeAllowed } from "game/tree_clearance";
import { landFieldFor, mainLandKeys, buildGeography, groundForState, safeTile, naturalGroundFor, suitableHouse } from "game/geography";
import { prepareEntrances, worldKey, tileAt } from "game/travel_geometry";
import { generateHistory, giveTradeTools } from "game/history";
import SimplexNoise from "simplex-noise";
import * as math from "game/math";
import { HEX_SIZE, Hex, Grid, ALL_SIDES } from "game/hex";

import MersenneTwister from "mersenne-twister";


import { newEntities } from "game/entities";
import { discoverTiles } from "game/playable";
import { addBidirectionalLink, removeBidirectionalLink } from "game/pathfinding";

import { HIGH_GROUND } from "game/height";
import { generateWorld, homeOf, tileTemperature, biomeOf } from "game/overworld";
import { initializeEcology, generateForage } from "game/ecology";
import { generateVillageLife } from "game/villages";
import { expansionFits, expandedFootprint } from "game/settlement_growth";
import { updateWeather } from "game/weather";
import { ADULT_AGE, generatePersonality, initializeRelationships } from "game/people";
import { MAP_RADIUS, MAP_CENTRE, worldPoint } from "game/world_terrain";

export { HEX_SIZE, Hex, InnerHex, Grid, ALL_SIDES } from "game/hex";

const MIN_START_SETTLEMENT_DISTANCE = 3;
const STARTING_KNOWN_DISTANCE = 5;

const UPDATE_PROGRESS_EVERY = 500;

export const HAIR = [
  0x8D3633, // red
  0x292021, // brown
  0x20232A, // black
  0x957E3C, // blonde
  // TODO: Should only be for old peopl
  // 0xd6cabf, // blonde grey
  0x997f76, // strawberry blonde
  0xe27bc8, // pink
  0x7a95e2, // blue
  // TODO: Should only be for old peopl
  // 0xbfcbd6, // grey
];

export const BODY_MALE = 0x4E3F30;
export const BODY_FEMALE = 0x3B6071;

export function generatePerson({ spatial, male, age, familySeed, generator, days }) {
  return {
    nameable: { type: "person", familySeed, male, seed: generator.random_int() },
    spatial,
    kinship: { parents: [], spouse: null, children: [] },
    personality: generatePersonality(generator),
    traits: { values: {} },
    attributes: {},
    controllable: {},
    holder: { held: [], capacity: 2 },
    personable: {
      type: "person",
      age,
      size: age < ADULT_AGE ? 12 : 20,
      male,
      hair: generator.random_int() % HAIR.length,
      body: male ? BODY_MALE : BODY_FEMALE,
      tiredness: 0.2 + generator.random_incl() * 0.4,
      hunger: 0.4 + generator.random_incl() * 0.4
    },
    manager: { jobs: [] },
    planner: { world: { no_place_for: {}, jobs: [], places: {}, feeling: {}, holding: {}, days } }
  };
}

export function generateFamilies({ state, seed, playerStartTile, founding = false }) {
  const generator = new MersenneTwister(seed);
  const homes = {};
  for (const buildingId in state.ecs.building) {
    const spatial = Hex().fromPoint(state.ecs.spatial[buildingId]);
    const villageId = spatial.x == playerStartTile.x && spatial.y == playerStartTile.y ?
      null : state.ecs.village[buildingId].villageId;
    const home = { buildingId, spatial, villageId, people: [] };
    (homes[villageId] ||= []).push(home);
  }

  const inhabit = (home, age, male, familySeed, parents = []) => {
    const entrance = state.ecs.building[home.buildingId].entrance;
    const sides = Array.from({ length: 6 }, (v, i) => (entrance + i) % 6);
    const starts = Grid.hexagon({ center: home.spatial, radius: 1 }).neighborsOf(home.spatial, sides);
    const [id] = newEntities(state, [{
      ...generatePerson({ spatial: starts[home.people.length].toPoint(), male, age,
        familySeed, generator, days: state.days }),
      village: { villageId: home.villageId },
      household: { houseId: home.buildingId }
    }], "person-");
    home.people.push(id);
    state.ecs.kinship[id].parents = [...parents];
    for (const parent of parents) state.ecs.kinship[parent].children.push(id);
    state.ecs.controllable[id].controllerId = home.people[0];
    state.ecs.controllable[home.buildingId].controllerId = home.people[0];
    return id;
  };
  const marry = (a, b) => {
    state.ecs.kinship[a].spouse = b;
    state.ecs.kinship[b].spouse = a;
  };

  for (const villageId in homes) {
    const houses = homes[villageId];
    if (villageId == "null") {
      for (const home of houses) {
        const id = inhabit(home, 20 + generator.random_int() % 16, generator.random_int() % 2 == 0, generator.random_int());
        state.ecs.playable ||= {};
        state.ecs.playable[id] = { id, known: [] };
      }
      continue;
    }
    // Three living generations: elders, their adult children in neighbouring
    // houses, and grandchildren. A few grown grandchildren live on their own.
    const familySeed = generator.random_int();
    const elders = [inhabit(houses[0], 66 + generator.random_int() % 7, true, familySeed)];
    if (generator.random_int() % 3 != 0) {
      elders.push(inhabit(houses[0], 64 + generator.random_int() % 7, false, familySeed));
      marry(...elders);
    }
    let firstParents;
    for (let h = 1; h < houses.length; h++) {
      const home = houses[h];
      const male = generator.random_int() % 2 == 0;
      if (!founding && h > 2 && generator.random_int() % 4 == 0) {
        inhabit(home, 18 + generator.random_int() % 5, male, familySeed, firstParents);
        continue;
      }
      const adultAge = founding ? 22 + generator.random_int() % 25 : 40 + generator.random_int() % 5;
      const head = inhabit(home, adultAge, male, familySeed, !founding || h == 1 ? elders : []);
      const spouse = inhabit(home, adultAge, !male, generator.random_int());
      marry(head, spouse);
      const parents = [head, spouse];
      if (h == 1) firstParents = parents;
      const children = founding ? 0 : 1 + generator.random_int() % 2;
      for (let c = 0; c < children; c++) {
        inhabit(home, 2 + generator.random_int() % 15, generator.random_int() % 2 == 0, familySeed, parents);
      }
    }
  }
  if (!state.ecs.playable || !Object.keys(state.ecs.playable).length) {
    const [id] = newEntities(state, [{
      ...generatePerson({ spatial: Hex(playerStartTile).toPoint(), male: generator.random_int() % 2 == 0,
        age: 20 + generator.random_int() % 16, familySeed: generator.random_int(), generator, days: state.days }),
      village: { villageId: null }
    }], "person-");
    state.ecs.playable = { [id]: { id, known: [] } };
    state.ecs.manager[id].ordered = true;
    state.ecs.planner[id].world.ordered = true;
    state.ecs.controllable[id].controllerId = id;
  }
  initializeRelationships(state, seed);
}

async function generateTerrain(grid, world, progressUpdate) {
  const field = landFieldFor(world);
  const home = homeOf(world);
  const result = {};
  for (let i = 0; i < grid.length; i++) {
    const hex = grid[i];
    const point = hex.toPoint();
    result[hex] = { ...point, terrain: field.terrainAt(worldPoint(home, point)), elevation: field.elevationAt(worldPoint(home, point)) };
    if (i % UPDATE_PROGRESS_EVERY == 0) { await progressUpdate("terrain"); }
  }
  return result;
}

const GRID_STEP = 30;

// NOTE: How thickly each biome grows trees. Trees stand on grassland
// wherever the woods noise is above the cutoff, and then only at the share
// of those spots given by keep, so a low cutoff with a small keep scatters
// lone trees widely while a high one keeps them to a few patches. Grassland
// keeps the cutoff it always had.
const TREE_DENSITY = {
  jungle: { cutoff: 0, keep: 1 },
  taiga: { cutoff: 0.3, keep: 1 },
  grassland: { cutoff: 0.6, keep: 1 },
  marsh: { cutoff: 0.2, keep: 0.12 },
  savanna: { cutoff: -0.2, keep: 0.035 },
  steppe: { cutoff: 0, keep: 0.04 },
  snowfield: { cutoff: 0.2, keep: 0.06 },
  tundra: { cutoff: 0.4, keep: 0.025 },
  desert: { cutoff: 0.4, keep: 0.02 },
};

// NOTE: Whatever the biome, a few trees always grow on land the start can
// walk to within this many hexes, so there is wood to be had.
export const MIN_START_TREES = 6;
const START_TREE_REACH = 4;

// NOTE: a number from 0 to 1 that is always the same for the same text
function hashUnit(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// NOTE: the land hexes the start can walk to, not through other houses
function reachableFrom(start, landscape, settlements, reach) {
  const reached = new Set([start.toString()]);
  let frontier = [start];
  for (let d = 0; d < reach; d++) {
    frontier = frontier.flatMap(hex => Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES)
      .filter((n, side) => hex.toString() != start.toString() || !settlements[start] ||
        side == settlements[start].frontDoorSide))
      .filter(hex => {
        const key = hex.toString();
        if (reached.has(key) || !landscape[key] || !walkable[landscape[key].terrain] || settlements[key]) {
          return false;
        }
        reached.add(key);
        return true;
      });
  }
  return reached;
}

// NOTE: biomeAt(hex) gives the biome a hex's trees grow as. Given a start,
// the most wooded spots it can reach are planted until it has a few trees.
export function generateTrees(seed, landscape, settlements, world_x, world_y, { biomeAt, start, allowed = () => true }) {
  let result = [];
  const simplex = new SimplexNoise(seed);
  let generator = new MersenneTwister(seed);
  const spots = [];

  for (let sx = 0; sx < world_x / GRID_STEP; sx++) {
    const x = sx * GRID_STEP;
    for (let sy = 0; sy < world_y / GRID_STEP; sy++) {
      const y = sy * GRID_STEP;

      const hex = Hex().fromPoint(x, y);
      if (hex && landscape[hex] && landscape[hex].terrain == "grassland" && !settlements[hex]) {
        const woods = Math.min(simplex.noise2D(x * 0.001, y * 0.001), 0.6) +
          (simplex.noise2D(x * 0.01, y * 0.01) * 0.3) +
          (simplex.noise2D(x * 0.02, y * 0.02) * 0.0);
        const { cutoff, keep } = TREE_DENSITY[biomeAt(hex)];
        const grows = woods > cutoff && (keep >= 1 || hashUnit(seed + ":" + sx + "," + sy) < keep);
        if (grows) {
          result.push({
            x: x + generator.random_int() % (GRID_STEP * 0.5) - GRID_STEP * 0.5,
            y: y + generator.random_int() % (GRID_STEP * 0.5) - GRID_STEP * 0.5
          });
        } else {
          spots.push({ x, y, hex, woods });
        }
      }
    }
  }

  result = result.filter(allowed);
  if (start) {
    result = result.filter(tree => start.distance(Hex().fromPoint(tree)) > 1);
    const reached = reachableFrom(start, landscape, settlements, START_TREE_REACH);
    const near = result.filter(t => reached.has(Hex().fromPoint(t).toString())).length;
    // NOTE: jittered like the rest, but kept in the spot's own hex, and
    // not on the start's own ring, which is kept clear for fields
    spots
      .map(spot => ({
        ...spot,
        tree: {
          x: spot.x - Math.floor(hashUnit(seed + ":x:" + spot.x + "," + spot.y) * GRID_STEP * 0.5) - 1,
          y: spot.y - Math.floor(hashUnit(seed + ":y:" + spot.x + "," + spot.y) * GRID_STEP * 0.5) - 1
        }
      }))
      .filter(spot => reached.has(spot.hex.toString()) && start.distance(spot.hex) >= 2 &&
        Hex().fromPoint(spot.tree).toString() == spot.hex.toString() && allowed(spot.tree))
      .sort((a, b) => b.woods - a.woods || a.x - b.x || a.y - b.y)
      .slice(0, Math.max(0, MIN_START_TREES - near))
      .forEach(spot => result.push(spot.tree));
  }
  return result;
}

const terrainValueFn = {
  "mountain": (distance) => distance <= 2 ? 2 : (15 - distance * 3),
  "shallow water": (distance) => (10 - distance * 2),
  "deep water": () => 0,
  "stone": (distance) => distance <= 2 ? 3 : (15 - distance * 3),
  "grassland": (distance) => (10 - distance * 2),
};

const walkable = {
  "mountain": 0,
  "shallow water": 0,
  "deep water": 0,
  "stone": 0.5,
  "grassland": 1.0
};

async function generateEconomicValue(grid, landscape, progressUpdate) {
  const spiral = Grid.spiral({ radius: 5 });
  spiral.shift(); // Ignore centre
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    let found = {};
    const target = grid[grid_index];
    if (landscape[target].terrain == "grassland") {
      for (let spiral_index = 0; spiral_index < spiral.length; spiral_index++) {
        const hex = target.add(spiral[spiral_index]);
        if (hex in landscape) {
          const terrain = landscape[hex].terrain;
          if (!(terrain in found)) {
            found[terrain] = terrainValueFn[terrain](target.distance(hex));
          }
        }
      }
      landscape[target].economic_value = Object.values(found).reduce((a, b) => a + b, 0);
    }
    if (grid_index % UPDATE_PROGRESS_EVERY == 0) {
      await progressUpdate("economic");
    }
  }
}

function makeHouse(generator, settlements, grid, target, landscape) {
  Grid.spiral({ center: target, radius: 1}).forEach(hex => {
    landscape[hex].terrain = "grassland";
    if (settlements[hex]) {
      delete settlements[hex];
    }
  });
  settlements[target] = {
    x: target.x,
    y: target.y,
    frontDoorSide: generator.random_int() % 6,
  };
}

async function generateSettlements(seed, grid, landscape, start, progressUpdate, mainLand, natural) {
  const settlements = {};
  const villages = {};
  const generator = new MersenneTwister(seed);
  // Keep clearings inland and leave the player's starting neighbourhood alone.
  const candidates = grid.filter(target => MAP_CENTRE.distance(target) < MAP_RADIUS - 4 &&
    start.distance(target) >= MIN_START_SETTLEMENT_DISTANCE && mainLand.has(String(target)) && suitableHouse(natural,target.toPoint()) && landscape[target].terrain == "grassland" && Grid.hexagon({center:target,radius:1}).every(h => landscape[h] && Math.abs(landscape[h].elevation-landscape[target].elevation) < 55) &&
    Grid.hexagon({ center: target, radius: 1 }).every(h => landscape[h] && !landscape[h].terrain.includes("water")));
  const ranked = candidates.map(hex => ({ hex, rank: generator.random() + landscape[hex].economic_value / 50 }))
    .sort((a, b) => b.rank - a.rank).map(c => c.hex);
  // The first hamlet is within visiting distance of the start, as before.
  const reached = reachableFrom(start, landscape, {}, 8);
  const near = ranked.filter(h => reached.has(h.toString())).sort((a, b) => start.distance(a) - start.distance(b));
  const centres = [];
  const targetCount = Math.max(1, Math.round(grid.length / 140));
  const prefixes = ["Ash", "Bramble", "Cinder", "Elm", "Fern", "Hazel", "Oak", "Reed", "Thorn", "Willow", "Yew"];
  const suffixes = ["brook", "combe", "dale", "field", "ford", "ham", "hurst", "stead", "wick", "wood"];
  const nameOffset = generator.random_int() % prefixes.length;
  for (const centre of [...near, ...ranked]) {
    if (centres.length >= targetCount) break;
    if (centres.some(other => centre.distance(other) < 7)) continue;
    const sites = [centre, ...ranked.filter(h => h.toString() != centre.toString() && h.distance(centre) <= 3)];
    const chosen = [];
    const size = 3 + generator.random_int() % 6;
    for (const site of sites) {
      if (chosen.length >= size) break;
      if (chosen.every(h => h.distance(site) >= 2) &&
        Object.values(settlements).every(h => Hex(h).distance(site) >= 2)) chosen.push(site);
    }
    if (chosen.length < 3) continue;
    const id = "village-" + (centres.length + 1);
    const name = prefixes[(nameOffset + centres.length) % prefixes.length] +
      suffixes[generator.random_int() % suffixes.length] + (centres.length >= prefixes.length ? " " + (centres.length + 1) : "");
    villages[id] = { id, name, centre: { x: centre.x, y: centre.y }, houses: [] };
    centres.push(centre);
    for (const hex of chosen) {
      makeHouse(generator, settlements, grid, hex, landscape);
      settlements[hex].villageId = id;
      settlements[hex].villageCentre = hex.equals(centre);
    }
    await progressUpdate("settlements");
  }
  // A coastal land hex can have no natural three-house clearing. It is still
  // a community destination: establish one inland village clearing, leaving
  // the continuous coastline alone. This is geography generation, not supplies
  // granted by travel, and is independent of the visitor or arrival side.
  if (!centres.length && ranked.length) {
    const centre = ranked[0];
    const sites = [centre, ...ranked.filter(h => h.distance(centre) <= 3)];
    const chosen = [];
    for (const site of sites) if (chosen.length<3 && chosen.every(h=>h.distance(site)>=2)) chosen.push(site);
    const id = "village-1";
    villages[id] = { id, name: prefixes[nameOffset] + suffixes[generator.random_int()%suffixes.length], centre: {x:centre.x,y:centre.y}, houses: [] };
    for (const hex of chosen) { makeHouse(generator,settlements,grid,hex,landscape); settlements[hex].villageId=id; settlements[hex].villageCentre=hex.equals(centre); }
  }
  // Keep the bedroll clearing and its farm-sized ring free of trees.
  Grid.hexagon({ center: start, radius: 1 }).forEach(hex => {
    landscape[hex].terrain = "grassland";
  });
  return { settlements, villages, settlementSites: ranked };
}

function discoverStartingTiles(ecs, id, center) {
  const tiles = Grid.spiral({ center, radius: STARTING_KNOWN_DISTANCE })
    .map(s => ({ x: s.x, y: s.y }));
  discoverTiles(ecs, { id, tiles });
}

export async function generateMap(state, seed, progressUpdate, options = {}) {
  // NOTE: a new map starts with an empty space index; entity ids restart at
  // 1, so anything left from an old map would point at the wrong entities
  state.space = {};
  state.redraws ||= [];
  state.world = options.world ? { ...options.world, home: { ...options.hex } } : generateWorld(seed);
  if (options.geographyFixture == "mountain-pass") {
    const centre = worldPoint(state.world.home, MAP_CENTRE.toPoint());
    state.world.geographyFixture = {kind:"mountain-pass", ...centre};
  }
  state.snow = {};
  state.snowRevision = 0;
  state.environmentUpdatedAt = state.days;

  const grid = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
  let landscape = await generateTerrain(grid, state.world, progressUpdate);
  await generateEconomicValue(grid, landscape, progressUpdate);
  const fixtureStart = state.world.geographyFixture && grid.filter(h => MAP_CENTRE.distance(h)==MAP_RADIUS-2 &&
    Grid.hexagon({center:h,radius:2}).every(n=>landscape[n]?.terrain=="grassland"))
    .sort((a,b)=>a.toPoint().x-b.toPoint().x || a.y-b.y)[0];
  let start = Hex(fixtureStart || homeOf(state.world).start || options.start || { x: MAP_RADIUS, y: 2 });
  const { settlements, villages, settlementSites } = await generateSettlements(seed, grid, landscape, start, progressUpdate, mainLandKeys(state.world), naturalGroundFor(state.world));
  // Village keys also cross maps in kinship, event and courtship records.
  if (state.ecs.namespace) {
    for (const id of Object.keys(villages)) { const v = villages[id]; delete villages[id]; v.id = state.ecs.namespace + id; villages[v.id] = v; }
    for (const house of Object.values(settlements)) house.villageId = state.ecs.namespace + house.villageId;
  }
  state.villages = villages;
  const entrances = prepareEntrances(grid, landscape, settlements, state.world, MAP_CENTRE, MAP_RADIUS);

  // NOTE: Every tile takes its world hex's temperature, but high ground is
  // a step colder. How high a tile is comes from the same height field the
  // renderer draws, now that the houses have settled the terrain. A tile's
  // biome (so high ground's is colder) decides how thickly trees grow on it.
  const home = homeOf(state.world);
  const field = landFieldFor(state.world);
  const geography = buildGeography(grid, landscape, settlements, entrances, [start], {
    settlementSites,
    terrainAt:p=>field.terrainAt(worldPoint(state.world.home,p)),
    elevationAt:(x,y)=>field.elevationAt(worldPoint(state.world.home,{x,y}))
  });
  for (const id of Object.keys(villages)) if (!Object.values(settlements).some(h => h.villageId == id)) delete villages[id];
  const ground = groundForState({map:{seed,geography},ecs:{mappable:landscape,spatial:landscape},space:Object.fromEntries(Object.keys(landscape).map(k=>[k,[k]]))});
  for (const key in landscape) {
    const tile = landscape[key];
    if (walkable[tile.terrain] && !safeTile(ground,tile)) tile.terrain = "mountain";
    tile.elevation = ground.hex(tile).centre;
    tile.temperature = tileTemperature(home.temperature, tile.terrain == "mountain" || tile.elevation >= HIGH_GROUND);
  }
  if (!options.world && !state.world.geographyFixture) {
    // Choose the initial camp on the finished surface. An optional road can be
    // absent, so the old survey coordinate is not proof of a walk to a village.
    const components = new Map(), houses = Object.values(settlements);
    const suitableArrival = hex => {
      if (!Grid.hexagon({ center: hex, radius: 2 }).every(h => landscape[h]?.terrain == "grassland") ||
        houses.some(h => hex.distance(Hex(h)) < MIN_START_SETTLEMENT_DISTANCE)) return false;
      let reached = components.get(String(hex));
      if (!reached) {
        reached = reachableFrom(hex, landscape, settlements, grid.length);
        for (const key of reached) components.set(key, reached);
      }
      return houses.some(h => hex.distance(Hex(h)) <= 8 && reached.has(String(
        Grid.hexagon({ center: Hex(h), radius: 1 }).neighborsOf(Hex(h), ALL_SIDES)[h.frontDoorSide])));
    };
    const alternatives = grid.filter(h => MAP_CENTRE.distance(h) == MAP_RADIUS - 2)
      .sort((a,b) => start.distance(a) - start.distance(b) || a.x-b.x || a.y-b.y);
    const chosen = [start, ...alternatives].find(suitableArrival);
    if (chosen) start = chosen;
  }
  let trees = generateTrees(seed, landscape, {}, grid.pointWidth(), grid.pointHeight(), {
    biomeAt: hex => biomeOf(landscape[hex].temperature, home.moisture),
    start
  }).filter(tree => {
    const hex = Hex().fromPoint(tree);
    return landscape[hex]?.terrain == "grassland";
  });
  // Every pass has the same initial resource guarantees as the opening.
  for (const entry of Object.values(entrances)) {
    const extra = generateTrees(seed, landscape, settlements, grid.pointWidth(), grid.pointHeight(), {
      biomeAt: hex => biomeOf(landscape[hex].temperature, home.moisture), start: Hex(entry.hexes[2])
    });
    const reached = reachableFrom(Hex(entry.hexes[2]), landscape, settlements, 4);
    for (const tree of extra.filter(t => reached.has(String(Hex().fromPoint(t))) && Hex(entry.hexes[2]).distance(Hex().fromPoint(t)) >= 2)) {
      if (!trees.some(t => Math.hypot(t.x-tree.x,t.y-tree.y)<10)) trees.push(tree);
    }
  }
  const generator = new MersenneTwister(seed);

  const tiles = Object.values(landscape).map((tile) => ({
    nameable: { nickname: "Map tile" },
    spatial: { x: tile.x, y: tile.y, immovable: true },
    mappable: { terrain: tile.terrain, temperature: tile.temperature, climateTemperature: home.temperature, elevation: tile.elevation, ...(tile.route ? {route:tile.route} : {}) },
    traits: { values: {} },
    valuable: { value: tile.economic_value },
    walkable: { worn: {}, speed: walkable[tile.terrain], neighbours: {} },
  }));

  const treeEntities = trees.map(tree => ({
    nameable: { nickname: "Tree" },
    spatial: { x: tree.x, y: tree.y, immovable: true },
    good: {
      type: "wood",
      amount: (generator.random_int() % 3) + 1
    }
  }));

  newEntities(state, [ ...tiles, ...treeEntities ]);
  state.ecs.building ||= {};
  state.ecs.container ||= {};
  state.ecs.household ||= {};
  for (const walk of Object.values(state.ecs.walkable)) { walk.routeWear = 0; walk.wearUpdatedAt = -543; }

  for (const id in state.ecs.walkable) {
    if (state.ecs.walkable[id].speed > 0) {
      const hex = Hex().fromPoint(state.ecs.spatial[id]);
      const grid = Grid.hexagon({ center: hex, radius: 1 });
      grid.neighborsOf(hex, ALL_SIDES).forEach((nHex, side) => {
        if (!(nHex in state.space)) {
          return;
        }
        const mId = state.space[nHex].filter(e => state.ecs.mappable[e])[0];
        if (mId && state.ecs.walkable[mId].speed > 0) {
          addBidirectionalLink(state.ecs, id, side, mId);
        }
      });
    }
  }

  const playerStartTile = { x: start.x, y: start.y };
  const map = {
    seed,
    playerStartTile,
    centre: { x: MAP_CENTRE.x, y: MAP_CENTRE.y },
    radius: MAP_RADIUS, entrances, geography, worldKey: worldKey(state.world.home)
  };

  state.map = map;
  for (const entry of Object.values(entrances)) entry.tileIds = entry.hexes.map(h => tileAt(state, Hex(h).toPoint()));
  state.settlement = { version: 1, lastSeason: -181, preparedSeason: -181, sites: {}, journeys: [], appliedJourneys: {}, sealedBorders: options.sealedBorders || [] };
  const transitRoutes=geography.routes.filter(route=>Object.values(entrances).some(e=>Hex(e.hexes[2]).equals(Hex(route[0]))));
  const transitHexes=transitRoutes.flat().map(h=>Hex(h));
  for(const hex of transitHexes)state.ecs.mappable[tileAt(state,hex.toPoint())].settlementTransit=true;
  for (const [index,village] of Object.values(villages).entries()) {
    const foundingSeason = index ? -32-Math.floor(hashUnit(seed+":founding:"+village.id)*148) : -180;
    const sites=Object.values(settlements).filter(h=>h.villageId==village.id);
    const approach=site=>Grid.hexagon({center:Hex(site),radius:1}).neighborsOf(Hex(site),ALL_SIDES)[site.frontDoorSide];
    const access=site=>Math.min(...transitHexes.map(h=>h.distance(approach(site))));
    sites.sort((a,b)=>access(a)-access(b) || Number(b.villageCentre)-Number(a.villageCentre));
    const first=sites.shift();
    sites.sort((a,b)=>Hex(first).distance(Hex(a))-Hex(first).distance(Hex(b)) || a.x-b.x || a.y-b.y);
    const ordered=[first,...sites];
    state.settlement.sites[village.id] = ordered.map((h,i)=>({point:Hex(h.x,h.y).toPoint(),entrance:h.frontDoorSide,establishSeason:foundingSeason+i*2}));
    village.access={kind:transitHexes.length?"regional route":"local route",crossings:Object.values(entrances).map(e=>e.key),distanceToTransit:transitHexes.length?access(first):null};
    village.sharedPlaces = [];
  }
  const prosperityVillage=options.settlementFixture=="prosperity" && Object.values(villages).find(v=>state.settlement.sites[v.id].length>=5);
  if(prosperityVillage)for(const site of state.settlement.sites[prosperityVillage.id])site.establishSeason=-1;
  // Prospective pads reserve one approach. History cannot route a through
  // connection across a house site and later construct across that road.
  for(const site of Object.values(state.settlement.sites).flat()) {
    const tile=tileAt(state,site.point);
    for(const side of ALL_SIDES)if(side!=site.entrance)removeBidirectionalLink(state.ecs,tile,side);
  }
  generateFamilies({ state, seed, playerStartTile, founding: true });
  initializeEcology(state,seed);
  generateHistory(state, seed, options.routeHistory || []);
  const playerId = Object.values(state.ecs.playable)[0].id;
  state.ecs.controllable[playerId].controllerId = playerId;
  discoverStartingTiles(state.ecs, playerId, playerStartTile);
  generateVillageLife(state, seed, playerStartTile);
  if(prosperityVillage) {
    const v=prosperityVillage;
    const eligible=v.houses.filter(id=>state.ecs.household[id].trade && expansionFits(state,id,expandedFootprint(state,id,1)) && expansionFits(state,state.ecs.household[id].workplaceId,expandedFootprint(state,state.ecs.household[id].workplaceId,1)));
    const prosperous=eligible.find(id=>["weaver","tanner"].includes(state.ecs.household[id].trade)) || eligible[0] || v.houses.find(id=>state.ecs.household[id].trade);
    const pub=v.sharedPlaces.find(id=>state.ecs.meetingPlace[id].kind=="alehouse");
    const host=pub && state.ecs.meetingPlace[pub].houseId;
    const poor=v.houses.find(id=>id!=prosperous && id!=host);
    const supply=(house,wood,grain)=>{
      const h=state.ecs.household[house],store=state.ecs.container[h.storeId];
      for(const [type,target] of [["wood",wood],["grain",grain]]) {
        const delta=target-(store.amounts[type] || 0);
        store.amounts[type]=target;
        h.estateAccount.initial[type]=(h.estateAccount.initial[type] || 0)+delta;
      }
    };
    supply(prosperous,80,60);
    if(host && host!=prosperous)supply(host,40,60);
    supply(poor,0,24);
    state.ecs.container[playerId]={id:playerId,capacity:96,amounts:{gruel:48,grain:24}};
    state.settlement.fixture={observerSupplies:"48 carried gruel and 24 carried grain",kind:"prosperity",label:"Initial prosperity setup",villageId:v.id,prosperousHouse:prosperous,workplaceId:state.ecs.household[prosperous].workplaceId,pubId:pub,pubHouse:host,poorHouse:poor,initialDay:state.days,stocks:"Trade household: 80 timber and 60 grain. Pub household: 40 timber and 60 grain if separate. Comparison household: no timber, 24 grain."};
  }
  giveTradeTools(state);
  // The existing starting-wood guarantee is placed outside actual roofs and
  // approaches after household geometry is known; clearance never yields logs.
  for (const clearing of [start, ...Object.values(entrances).map(e=>Hex(e.hexes[2]))]) {
    const reached = reachableFrom(clearing, landscape, settlements, 4);
    const safe = point => treeAllowed(state,point) && !(state.space[Hex().fromPoint(point)] || []).some(id=>
      state.ecs.mappable[id]?.villagePlot || state.ecs.farmable?.[id] || state.ecs.stockpile?.[id]);
    const extra = generateTrees(seed, landscape, settlements, grid.pointWidth(), grid.pointHeight(), {
      biomeAt: hex=>biomeOf(landscape[hex].temperature,home.moisture), start:clearing, allowed:safe
    });
    for(const tree of extra.filter(p=>reached.has(String(Hex().fromPoint(p))))) {
      if(Object.keys(state.ecs.good).some(id=>state.ecs.good[id].type=="wood" && Math.hypot(state.ecs.spatial[id].x-tree.x,state.ecs.spatial[id].y-tree.y)<10)) continue;
      newEntities(state,[{spatial:{...tree,immovable:true},nameable:{nickname:"Tree"},good:{type:"wood",amount:1+Math.floor(hashUnit(seed+":wood:"+tree.x+","+tree.y)*3)}}]);
    }
  }
  const naturalCaps=state.ecology.treeCaps;
  initializeEcology(state, seed);
  for(const [biome,count] of Object.entries(naturalCaps))state.ecology.treeCaps[biome]=Math.max(count,state.ecology.treeCaps[biome] || 0);
  generateForage(state, seed, playerStartTile);
  for (const entry of Object.values(entrances)) {
    entry.tileIds = entry.hexes.map(h => tileAt(state, Hex(h).toPoint()));
    // generateForage is idempotent only for guaranteed nearby spots; avoid
    // rerolling the entire ecology for each pass.
    generateForage(state, seed, entry.hexes[2], { onlyStart: true });
    const reached = new Set(), queue = [[entry.tileIds[2], 0]];
    for (const [id, depth] of queue) if (!reached.has(id)) { reached.add(id); if (depth < 4) for (const next of Object.values(state.ecs.walkable[id].neighbours)) queue.push([next, depth+1]); }
    const near = id => reached.has(tileAt(state, state.ecs.spatial[id]));
    const connected = new Set(), frontier = [entry.tileIds[2]];
    for(let i=0;i<frontier.length;i++) {
      const id=frontier[i];if(connected.has(id))continue;connected.add(id);
      for(const next of Object.values(state.ecs.walkable[id].neighbours)) if(!connected.has(next))frontier.push(next);
    }
    entry.villageReachable = Object.keys(state.ecs.building).some(id=>connected.has(tileAt(state,state.ecs.spatial[id])));
    entry.wood = Object.keys(state.ecs.tree || {}).filter(near).length;
    entry.food = Object.keys(state.ecs.forageable || {}).filter(near).length;
  }
  if (options.noPlayer) {
    for (const id of Object.keys(state.ecs.playable)) for (const component of Object.values(state.ecs)) if (component && typeof component == "object") delete component[id];
    state.ecs.playable = {};
  }
  updateWeather(state, 0, options.worldSeed ?? seed);
  await progressUpdate("complete");

  return { playerId, map };
}

function mid(a, b) {
  return math.lerp(a, b, 0.5);
}

const generateTriangle = () => {
  const ctr = Hex().center();
  const c = Hex().corners();
  return [
    c[4], mid(c[4], c[5]), c[5],
    mid(c[3], c[4]), mid(ctr, c[4]), mid(ctr, c[5]), mid(c[5], c[0]),
    c[3], mid(ctr, c[3]), ctr, mid(ctr, c[0]), c[0],
    mid(c[2], c[3]), mid(ctr, c[2]), mid(ctr, c[1]), mid(c[1], c[0]),
    c[2], mid(c[1], c[2]), c[1]
  ].map(v => math.lerp(v, ctr, 0.25));
};

export const TRIANGLES = generateTriangle();
export const TRIANGLE_INTERIOR_RADIUS = HEX_SIZE / 6;

export function triangleCenters({x, y}) {
  return TRIANGLES.map(p => ({ x: p.x + x, y: p.y + y }));
}
