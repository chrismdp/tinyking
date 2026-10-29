import SimplexNoise from "simplex-noise";
import * as math from "game/math";
import { HEX_SIZE, Hex, Grid, ALL_SIDES } from "game/hex";

import MersenneTwister from "mersenne-twister";


import { newEntities, entitiesInSameLocation } from "game/entities";
import { directlyControlledBy, discoverTiles } from "game/playable";
import { addBidirectionalLink, removeBidirectionalLink } from "game/pathfinding";
import { createHeightField, HIGH_GROUND } from "game/height";
import { generateWorld, homeOf, tileTemperature, biomeOf } from "game/overworld";
import { updateWeather } from "game/weather";
import { MAP_RADIUS, MAP_CENTRE, createLandField, worldPoint } from "game/world_terrain";

export { HEX_SIZE, Hex, InnerHex, Grid, ALL_SIDES } from "game/hex";

const SETTLEMENT_LIKELIHOOD = 50; // 30 - certain, 100 - sparse
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

function generateFamily(size, spatial, front, generator, days) {
  let result = [];
  const grid = Grid.hexagon({ center: spatial, radius: 1 });
  const sides = Array.from({length: 6}, (v, i) => (front + i) % 6);
  const starts = grid.neighborsOf(spatial, sides);
  const familySeed = generator.random_int();
  for (let p = 0; p < size; p++) {
    const { x, y } = starts[p].toPoint();
    const male = generator.random_int() % 2 == 0;
    result.push({
      nameable: { type: "person", familySeed, male, seed: generator.random_int() },
      spatial: { x, y },
      traits: { values: {} },
      attributes: {},
      controllable: {},
      holder: { held: [], capacity: 2 },
      personable: {
        type: "person",
        size: p > 1 ? 12 : 20,
        male: male,
        hair: generator.random_int() % HAIR.length,
        body: male ? BODY_MALE : BODY_FEMALE,
        tiredness: 0.2 + generator.random_incl() * 0.4,
        hunger: 0.4 + generator.random_incl() * 0.4
      },
      manager: { jobs: [] },
      planner: {
        world: {
          no_place_for: {},
          jobs: [],
          places: {},
          feeling: {},
          holding: {},
          days,
        }
      },
    });
  }
  return result;
}

export function generateFamilies({ state, seed, playerStartTile }) {
  let generator = new MersenneTwister(seed);
  for (const buildingId in state.ecs.building) {
    let people = [];
    let spatial = Hex().fromPoint(state.ecs.spatial[buildingId]);
    if (spatial.x == playerStartTile.x && spatial.y == playerStartTile.y) {
      const player = { ...generateFamily(1, spatial, state.ecs.building[buildingId].entrance, generator, state.days)[0],
        playable: { known: [] },
      };
      people = [ player ];
    } else {
      const familySize = 1 + (generator.random_int() % 3);
      people = generateFamily(familySize, spatial, state.ecs.building[buildingId].entrance, generator, state.days).map(p => ({ ...p }));
    }
    const ids = newEntities(state, people);
    for (const id of ids) {
      state.ecs.controllable[id].controllerId = ids[0];
    }
    state.ecs.controllable[buildingId].controllerId = ids[0];
  }
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
  const result = [];
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
  let settlements = {};
  let generator = new MersenneTwister(seed);
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    const target = grid[grid_index];
    // NOTE: Keep house clearings inside the map and off the coast.
    const inland = MAP_CENTRE.distance(target) < MAP_RADIUS - 1;
    if (!settlements[target] && inland && landscape[target].terrain == "grassland" &&
      Grid.hexagon({ center: target, radius: 1 }).every(h => !landscape[h].terrain.includes("water"))) {
      const dieRoll = Math.max(3, SETTLEMENT_LIKELIHOOD - landscape[target].economic_value * 2);
      if (generator.random_int() % dieRoll == 0) {
        if (start.distance(target) >= MIN_START_SETTLEMENT_DISTANCE) {
          makeHouse(generator, settlements, grid, target, landscape);
        }
      }
    }
    if (grid_index % UPDATE_PROGRESS_EVERY == 0) {
      await progressUpdate("settlements");
    }
  }

  makeHouse(generator, settlements, grid, start, landscape, generator);
  return settlements;
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
  const settlements = await generateSettlements(seed, grid, landscape, start, progressUpdate);

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
  });
  const generator = new MersenneTwister(seed);

  const houses = Object.values(settlements).map(s => {
    const { x, y } = Hex(s.x, s.y).toPoint();
    return {
      spatial: { x, y, immovable: true },
      nameable: { nickname: "Log cabin" },
      controllable: {},
      building: { entrance: s.frontDoorSide, rooms: [] }
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

  const playerStartTile = { x: start.x, y: start.y };
  const map = {
    seed,
    playerStartTile,
    centre: { x: MAP_CENTRE.x, y: MAP_CENTRE.y },
    radius: MAP_RADIUS
  };

  generateFamilies({ state, seed, playerStartTile });
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
    const inhabitants = directlyControlledBy(state.ecs, state.ecs.controllable[id].controllerId).length + 1;

    // NOTE: Create rooms (2 each at the moment in every building, one for stockpiles one for sleeping
    building.rooms = newEntities(state, [
      {
        spatial: { ...state.ecs.spatial[id] },
        controllable: { controllerId: building.id },
        interior: { buildingId: building.id },
        sleepable: { capacity: 3, level: 1, occupiers: [] },
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
