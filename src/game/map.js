import { generateHistory, giveTradeTools } from "game/history";
import SimplexNoise from "simplex-noise";
import * as math from "game/math";
import { HEX_SIZE, Hex, Grid, ALL_SIDES } from "game/hex";

import MersenneTwister from "mersenne-twister";


import { newEntities, entitiesInSameLocation } from "game/entities";
import { directlyControlledBy, discoverTiles } from "game/playable";
import { addBidirectionalLink, removeBidirectionalLink } from "game/pathfinding";
import { createHeightField, HIGH_GROUND } from "game/height";
import { generateWorld, homeOf, tileTemperature, biomeOf } from "game/overworld";
import { initializeEcology, generateForage } from "game/ecology";
import { generateVillageLife } from "game/villages";
import { updateWeather } from "game/weather";
import { ADULT_AGE, generatePersonality, initializeRelationships } from "game/people";
import { MAP_RADIUS, MAP_CENTRE, createLandField, worldPoint } from "game/world_terrain";

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

function generatePerson({ spatial, male, age, familySeed, generator, days }) {
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
  const field = createLandField(world.landSeed);
  const home = homeOf(world);
  const result = {};
  for (let i = 0; i < grid.length; i++) {
    const hex = grid[i];
    const point = hex.toPoint();
    result[hex] = { ...point, terrain: field.terrainAt(worldPoint(home, point)) };
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
export function generateTrees(seed, landscape, settlements, world_x, world_y, { biomeAt, start }) {
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
        Hex().fromPoint(spot.tree).toString() == spot.hex.toString())
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

async function generateSettlements(seed, grid, landscape, start, progressUpdate) {
  const settlements = {};
  const villages = {};
  const generator = new MersenneTwister(seed);
  // Keep clearings inland and leave the player's starting neighbourhood alone.
  const candidates = grid.filter(target => MAP_CENTRE.distance(target) < MAP_RADIUS - 1 &&
    start.distance(target) >= MIN_START_SETTLEMENT_DISTANCE && landscape[target].terrain == "grassland" &&
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
    }
    await progressUpdate("settlements");
  }
  // Keep the bedroll clearing and its farm-sized ring free of trees.
  Grid.hexagon({ center: start, radius: 1 }).forEach(hex => {
    landscape[hex].terrain = "grassland";
  });
  return { settlements, villages };
}

function discoverStartingTiles(ecs, id, center) {
  const tiles = Grid.spiral({ center, radius: STARTING_KNOWN_DISTANCE })
    .map(s => ({ x: s.x, y: s.y }));
  discoverTiles(ecs, { id, tiles });
}

export async function generateMap(state, seed, progressUpdate) {
  // NOTE: a new map starts with an empty space index; entity ids restart at
  // 1, so anything left from an old map would point at the wrong entities
  state.space = {};
  state.world = generateWorld(seed);
  state.snow = {};
  state.snowRevision = 0;

  const grid = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
  let landscape = await generateTerrain(grid, state.world, progressUpdate);
  await generateEconomicValue(grid, landscape, progressUpdate);
  const start = Hex(homeOf(state.world).start);
  const { settlements, villages } = await generateSettlements(seed, grid, landscape, start, progressUpdate);
  state.villages = villages;

  // NOTE: Every tile takes its world hex's temperature, but high ground is
  // a step colder. How high a tile is comes from the same height field the
  // renderer draws, now that the houses have settled the terrain. A tile's
  // biome (so high ground's is colder) decides how thickly trees grow on it.
  const home = homeOf(state.world);
  const ground = createHeightField({ seed, terrainAt: key => landscape[key] && landscape[key].terrain });
  for (const key in landscape) {
    const tile = landscape[key];
    tile.temperature = tileTemperature(home.temperature,
      tile.terrain == "mountain" || ground.hex(tile).centre >= HIGH_GROUND);
  }
  const trees = generateTrees(seed, landscape, settlements, grid.pointWidth(), grid.pointHeight(), {
    biomeAt: hex => biomeOf(landscape[hex].temperature, home.moisture),
    start
  }).filter(tree => {
    const hex = Hex().fromPoint(tree);
    return landscape[hex]?.terrain == "grassland" && !settlements[hex];
  });
  const generator = new MersenneTwister(seed);

  const houses = Object.values(settlements).map(s => {
    const { x, y } = Hex(s.x, s.y).toPoint();
    return {
      spatial: { x, y, immovable: true },
      nameable: { nickname: "Log cabin" },
      controllable: {},
      building: { entrance: s.frontDoorSide, rooms: [] },
      village: { villageId: s.villageId }
    };
  });

  const tiles = Object.values(landscape).map((tile) => ({
    nameable: { nickname: "Map tile" },
    spatial: { x: tile.x, y: tile.y, immovable: true },
    mappable: { terrain: tile.terrain, temperature: tile.temperature },
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

  newEntities(state, [ ...tiles, ...houses, ...treeEntities ]);

  for (const id in state.ecs.walkable) {
    if (walkable[state.ecs.mappable[id].terrain]) {
      const hex = Hex().fromPoint(state.ecs.spatial[id]);
      const grid = Grid.hexagon({ center: hex, radius: 1 });
      grid.neighborsOf(hex, ALL_SIDES).forEach((nHex, side) => {
        if (!(nHex in state.space)) {
          return;
        }
        const mId = state.space[nHex].filter(e => state.ecs.mappable[e])[0];
        if (mId && walkable[state.ecs.mappable[mId].terrain]) {
          addBidirectionalLink(state.ecs, id, side, mId);
        }
      });
    }
  }

  for (const id in state.ecs.building) {
    const villageId = state.ecs.village[id].villageId;
    if (villageId) state.villages[villageId].houses.push(id);
  }

  const playerStartTile = { x: start.x, y: start.y };
  const map = {
    seed,
    playerStartTile,
    centre: { x: MAP_CENTRE.x, y: MAP_CENTRE.y },
    radius: MAP_RADIUS
  };

  generateFamilies({ state, seed, playerStartTile, founding: true });
  generateHistory(state, seed);
  const playerId = Object.values(state.ecs.playable)[0].id;
  state.ecs.controllable[playerId].controllerId = playerId;
  discoverStartingTiles(state.ecs, playerId, playerStartTile);

  for (const id in state.ecs.building) {
    const building = state.ecs.building[id];
    const entities = entitiesInSameLocation(state, state.ecs.spatial[id]);
    const mappables = entities.filter(e => state.ecs.mappable[e]);
    ALL_SIDES.forEach(side => {
      if (side != building.entrance) {
        removeBidirectionalLink(state.ecs, mappables[0], side);
      }
    });
    const householdSize = Object.values(state.ecs.household).filter(h => h.houseId == id).length;
    const inhabitants = directlyControlledBy(state.ecs, state.ecs.controllable[id].controllerId).length + 1;

    // NOTE: Create rooms (2 each at the moment in every building, one for stockpiles one for sleeping
    building.rooms = newEntities(state, [
      {
        spatial: { ...state.ecs.spatial[id] },
        controllable: { controllerId: building.id },
        interior: { buildingId: building.id },
        sleepable: { capacity: Math.max(3, householdSize), level: 1, occupiers: [] },
      },
      {
        spatial: { ...state.ecs.spatial[id] },
        interior: { buildingId: building.id },
        controllable: { controllerId: building.id },
        container: {
          capacity: (inhabitants + 1) * TRIANGLES.length,
          amounts: {
            gruel: inhabitants,
            grain: inhabitants * TRIANGLES.length
          }
        }
      }
    ]);
  }

  generateVillageLife(state, seed, playerStartTile);
  giveTradeTools(state);
  initializeEcology(state, seed);
  generateForage(state, seed, playerStartTile);
  updateWeather(state, 0, seed);
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
