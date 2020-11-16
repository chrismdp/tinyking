import * as Honeycomb from "honeycomb-grid";
import * as SimplexNoise from "simplex-noise";
import * as math from "game/math";

import MersenneTwister from "mersenne-twister";

import ReactGA from "react-ga";

import { newEntities, entitiesInSameLocation } from "game/entities";
import { directlyControlledBy, discoverTiles } from "game/playable";
import { addBidirectionalLink, removeBidirectionalLink } from "game/pathfinding";

export const HEX_SIZE = 60;
const MAP_RADIUS = 10;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3);

const SETTLEMENT_LIKELIHOOD = 50; // 30 - certain, 100 - sparse
const MIN_START_SETTLEMENT_DISTANCE = 3;
const STARTING_KNOWN_DISTANCE = 5;

const UPDATE_PROGRESS_EVERY = 500;

const HAIR = {
  red: 0x8D3633,
  brown: 0x292021,
  black: 0x20232A,
  blonde: 0x957E3C
};
const hair = Object.values(HAIR);

const BODY_MALE = 0x4E3F30;
const BODY_FEMALE = 0x3B6071;

export const Hex = Honeycomb.extendHex({
  size: HEX_SIZE,
  orientation: "flat",
  origin: [ HEX_SIZE, HEX_HEIGHT * 0.5 ]
});

export const InnerHex = Honeycomb.extendHex({
  size: 0.5 * HEX_SIZE,
  orientation: "flat",
  origin: [ HEX_SIZE * 0.5, HEX_HEIGHT * 0.25 ]
});

export const Grid = Honeycomb.defineGrid(Hex);

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
      tickable: {},
      controllable: {},
      holder: { held: [], capacity: 2 },
      personable: {
        type: "person",
        size: p > 1 ? 12 : 20,
        hair: hair[generator.random_int() % hair.length],
        body: male ? BODY_MALE : BODY_FEMALE,
        tiredness: 0.2 + Math.random() * 0.4,
        hunger: 0.4 + Math.random() * 0.4
      },
      manager: { jobs: [] },
      planner: {
        world: {
          no_place_for: {},
          jobs: [],
          places: {},
          feeling: {},
          holding: {},
          hour: days,
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

async function generateTerrain(grid, seed, progressUpdate) {
  ReactGA.event({category: "Map generation", action: "generate"});

  const simplex = new SimplexNoise(seed);
  const centre = { x: grid.width * 0.5, y: grid.height * 0.5 };
  let result = {};
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    const hex = grid[grid_index];

    const d = { x: (centre.x - hex.x), y: (centre.y - hex.y) };
    const relativeDistance = (d.x * d.x + d.y * d.y) / (grid.width * grid.width);
    hex.customHeight =
      Math.min(1.5, simplex.noise2D(hex.x * 0.025, hex.y * 0.025) * 1) +
      Math.max(0, simplex.noise2D(hex.x * 0.1, hex.y * 0.1) * 2);
    if (relativeDistance >= 0.19) {
      hex.customHeight -= (relativeDistance - 0.19) * 25;
    }
    if (hex.x == 0 || hex.y == 0 || hex.x == grid.width-1 || hex.y == grid.height-1) {
      hex.customHeight = -1;
    }
    let terrain = "";
    if (hex.customHeight > 1.4) {
      terrain = "mountain";
    } else if (hex.customHeight <= -0.2) {
      terrain = "deep water";
    } else if (hex.customHeight < 0) {
      terrain = "shallow water";
    } else {
      if (simplex.noise2D(hex.x * 0.5, hex.y * 0.5) > 0.85) {
        terrain = "stone";
      } else {
        terrain = "grassland";
      }
    }
    const point = hex.toPoint();
    result[hex] = {
      x: point.x,
      y: point.y,
      terrain: terrain
    };
    if (grid_index % UPDATE_PROGRESS_EVERY == 0) {
      await progressUpdate("terrain");
    }
  }
  return result;
}

const GRID_STEP = 30;
function generateTrees(seed, landscape, settlements, world_x, world_y) {
  const result = [];
  const simplex = new SimplexNoise(seed);
  let generator = new MersenneTwister(seed);

  for (let sx = 0; sx < world_x / GRID_STEP; sx++) {
    const x = sx * GRID_STEP;
    for (let sy = 0; sy < world_y / GRID_STEP; sy++) {
      const y = sy * GRID_STEP;

      const hex = Hex().fromPoint(x, y);
      if (hex && landscape[hex] && landscape[hex].terrain == "grassland" && !settlements[hex]) {
        if (Math.min(simplex.noise2D(x * 0.001, y * 0.001), 0.6) +
          (simplex.noise2D(x * 0.01, y * 0.01) * 0.3) +
          (simplex.noise2D(x * 0.02, y * 0.02) * 0.0) > 0.6) {
          result.push({
            x: x + generator.random_int() % (GRID_STEP * 0.5) - GRID_STEP * 0.5,
            y: y + generator.random_int() % (GRID_STEP * 0.5) - GRID_STEP * 0.5
          });
        }
      }
    }
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

async function findPlayerStart(grid, landscape, progressUpdate) {
  const center = Grid.pointToHex(grid.pointWidth() * 0.5, grid.pointHeight() * 0.5);

  const spiral = Grid.spiral({ center, radius: MAP_RADIUS });
  for (let spiral_index = 0; spiral_index < spiral.length; spiral_index++) {
    const hex = spiral[spiral_index];
    if (landscape[hex].terrain == "grassland") {
      return hex;
    }
    if (spiral_index % UPDATE_PROGRESS_EVERY == 0) {
      await progressUpdate("player start");
    }
  }
  // TODO: do something more useful here
  throw "Cannot find any grassland for player to start on!";
}

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

function makeHouse(settlements, grid, target, landscape) {
  Grid.spiral({ center: target, radius: 1}).forEach(hex => {
    landscape[hex].terrain = "grassland";
    if (settlements[hex]) {
      delete settlements[hex];
    }
  });
  settlements[target] = {
    x: target.x,
    y: target.y,
    frontDoorSide: Math.floor(Math.random() * 6) % 6,
  };
}

async function generateSettlements(seed, grid, landscape, start, progressUpdate) {
  let settlements = {};
  let generator = new MersenneTwister(seed);
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    const target = grid[grid_index];
    if (!settlements[target] && landscape[target].terrain == "grassland") {
      const dieRoll = Math.max(3, SETTLEMENT_LIKELIHOOD - landscape[target].economic_value * 2);
      if (generator.random_int() % dieRoll == 0) {
        if (start.distance(target) >= MIN_START_SETTLEMENT_DISTANCE) {
          makeHouse(settlements, grid, target, landscape);
        }
      }
    }
    if (grid_index % UPDATE_PROGRESS_EVERY == 0) {
      await progressUpdate("settlements");
    }
  }

  makeHouse(settlements, grid, start, landscape, generator);
  return settlements;
}

function discoverStartingTiles(ecs, id, center) {
  const tiles = Grid.spiral({ center, radius: STARTING_KNOWN_DISTANCE })
    .map(s => ({ x: s.x, y: s.y }));
  discoverTiles(ecs, { id, tiles });
}

export const ALL_SIDES = Array.from({length: 6}, (x, i) => i);

export async function generateMap(state, seed, progressUpdate) {
  const grid = Grid.rectangle({width: MAP_RADIUS * 2, height: MAP_RADIUS * 2});
  let landscape = await generateTerrain(grid, seed, progressUpdate);
  await generateEconomicValue(grid, landscape, progressUpdate);
  const start = await findPlayerStart(grid, landscape, progressUpdate);
  const settlements = await generateSettlements(seed, grid, landscape, start, progressUpdate);
  const trees = generateTrees(seed, landscape, settlements, grid.pointWidth(), grid.pointHeight());

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
    mappable: { terrain: tile.terrain },
    tickable: {},
    traits: { values: {} },
    valuable: { value: tile.economic_value },
    walkable: { worn: {}, speed: walkable[tile.terrain], neighbours: {} },
  }));

  const treeEntities = trees.map(tree => ({
    nameable: { nickname: "Tree" },
    spatial: { x: tree.x, y: tree.y, immovable: true },
    good: {
      type: "wood",
      amount: Math.ceil(Math.random(1) * 3)
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
    width: grid.pointWidth(),
    height: grid.pointHeight()
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
