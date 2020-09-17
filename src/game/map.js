import * as Honeycomb from "honeycomb-grid";
import * as SimplexNoise from "simplex-noise";

import MersenneTwister from "mersenne-twister";

import ReactGA from "react-ga";

import { newEntities } from "game/entities";
import { discoverTiles } from "game/playable";

export const HEX_SIZE = 80;
const MAP_RADIUS = 10;

const SETTLEMENT_LIKELIHOOD = 50; // 30 - certain, 100 - sparse
const MIN_START_SETTLEMENT_DISTANCE = 3;
const STARTING_KNOWN_DISTANCE = 2;

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

function generateFamily(size, x, y, generator, homeId) {
  var result = [];
  for (var p = 0; p < size; p++) {
    result.push({
      nameable: { type: "person", seed: generator.random_int() },
      spatial: {
        x, y,
        dx: -Math.cos(p / (size * 1.5) * Math.PI * 2) * HEX_SIZE * 0.7,
        dy: Math.sin(p / (size * 1.5) * Math.PI * 2) * HEX_SIZE * 0.7
      },
      traits: { values: {} },
      supplies: { },
      homeable: { home: homeId },
      attributes: { energy: 10, health: 10 },
      tickable: {},
      workable: {},
      assignable: {},
      personable: {
        type: "person",
        size: p > 1 ? 12 : 20,
        hair: hair[generator.random_int() % hair.length],
        body: generator.random_int() % 2 == 0 ? BODY_MALE : BODY_FEMALE
      }
    });
  }
  return result;
}

function giveStartingGrain(supplies, id, amount) {
  supplies[id].grain = amount;
}

export function generateFamilies({ ecs, seed, playerStart }) {
  var generator = new MersenneTwister(seed);
  for (const habitableId in ecs.habitable) {
    var people = [];
    var spatial = ecs.spatial[habitableId];
    if (spatial.x == playerStart.x && spatial.y == playerStart.y) {
      const player = { ...generateFamily(1, spatial.x, spatial.y, generator, habitableId)[0],
        playable: { known: [] },
      };
      people = [ player ];
    } else {
      const familySize = 1 + (generator.random_int() % 5);
      people = generateFamily(familySize, spatial.x, spatial.y, generator, habitableId);
    }
    const ids = newEntities(ecs, people);
    giveStartingGrain(ecs.supplies, ids[0], people.length);
    for (const id of ids) {
      ecs.personable[id].controller = ids[0];
    }
    ecs.habitable[habitableId].owners = ids;
  }
}

export const Hex = Honeycomb.extendHex({
  size: HEX_SIZE,
  orientation: "flat",
  origin: [ HEX_SIZE, HEX_SIZE * Math.sqrt(3) * 0.5 ]
});

export const Grid = Honeycomb.defineGrid(Hex);

async function generateTerrain(grid, seed, progressUpdate) {
  ReactGA.event({category: "Map generation", action: "generate"});

  const simplex = new SimplexNoise(seed);
  const centre = { x: grid.width * 0.5, y: grid.height * 0.5 };
  var result = {};
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
    var terrain = "";
    if (hex.customHeight > 1.4) {
      terrain = "mountain";
    } else if (hex.customHeight <= -0.2) {
      terrain = "deep water";
    } else if (hex.customHeight < 0) {
      terrain = "shallow water";
    } else {
      if (simplex.noise2D(hex.x * 0.2, hex.y * 0.2) > 0.45) {
        terrain = "forest";
      } else if (simplex.noise2D(hex.x * 0.5, hex.y * 0.5) > 0.85) {
        terrain = "stone";
      } else {
        terrain = "grassland";
      }
    }
    result[hex] = {
      x: hex.x,
      y: hex.y,
      terrain: terrain
    };
    if (grid_index % UPDATE_PROGRESS_EVERY == 0) {
      await progressUpdate("terrain");
    }
  }
  return result;
}

const terrainValueFn = {
  "mountain": (distance) => distance <= 2 ? 2 : (15 - distance * 3),
  "shallow water": (distance) => (10 - distance * 2),
  "deep water": () => 0,
  "forest": (distance) => distance <= 2 ? 2 : (10 - distance * 2),
  "stone": (distance) => distance <= 2 ? 3 : (15 - distance * 3),
  "grassland": (distance) => (10 - distance * 2),
};

const walkable = {
  "mountain": false,
  "shallow water": false,
  "deep water": false,
  "forest": true,
  "stone": true,
  "grassland": true
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
    var found = {};
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

function makeHouseAndField(settlements, grid, target) {
  settlements[target] = {
    x: target.x,
    y: target.y,
    type: "house"
  };
}

async function generateSettlements(seed, grid, landscape, start, progressUpdate) {
  var settlements = {};
  var generator = new MersenneTwister(seed);
  for (let grid_index = 0; grid_index < grid.length; grid_index++) {
    const target = grid[grid_index];
    if (!settlements[target] && landscape[target].terrain == "grassland") {
      const dieRoll = Math.max(3, SETTLEMENT_LIKELIHOOD - landscape[target].economic_value * 2);
      if (generator.random_int() % dieRoll == 0) {
        if (start.distance(target) >= MIN_START_SETTLEMENT_DISTANCE) {
          makeHouseAndField(settlements, grid, target);
        }
      }
    }
    if (grid_index % UPDATE_PROGRESS_EVERY == 0) {
      await progressUpdate("settlements");
    }
  }

  makeHouseAndField(settlements, grid, start, landscape, generator);
  return settlements;
}

function discoverStartingTiles(ecs, id, center) {
  const tiles = Grid.spiral({ center, radius: STARTING_KNOWN_DISTANCE })
    .map(s => ({ x: s.x, y: s.y }));
  discoverTiles(ecs, { id, tiles });
}

export async function generateMap(ecs, seed, progressUpdate) {
  const grid = Grid.rectangle({width: MAP_RADIUS * 2, height: MAP_RADIUS * 2});
  var landscape = await generateTerrain(grid, seed, progressUpdate);
  await generateEconomicValue(grid, landscape, progressUpdate);
  const start = await findPlayerStart(grid, landscape, progressUpdate);
  const settlements = await generateSettlements(seed, grid, landscape, start, progressUpdate);
  const entities = [
    ...Object.values(landscape).map((tile) => ({
      nameable: { nickname: "Map tile" },
      spatial: { x: tile.x, y: tile.y },
      mappable: { terrain: tile.terrain, walkable: walkable[tile.terrain] },
      tickable: {},
      traits: { values: {} },
      valuable: { value: tile.economic_value },
      workable: {},
    })),
    ...Object.values(settlements).map((s) => {
      var entity = {
        spatial: { x: s.x, y: s.y },
      };
      if (s.type == "house") {
        entity.nameable = { nickname: "Log cabin" };
        entity.habitable = { owners: [] };
        entity.workable = {};
      }
      return entity;
    })
  ];

  const playerStart = { x: start.x, y: start.y };
  newEntities(ecs, entities);
  const map = {
    seed,
    playerStart,
    pointWidth: grid.pointWidth(),
    pointHeight: grid.pointHeight()
  };

  generateFamilies({ ecs, seed, playerStart });
  const playerId = Object.values(ecs.playable)[0].id;
  ecs.personable[playerId].controller = playerId;
  discoverStartingTiles(ecs, playerId, playerStart);

  await progressUpdate("complete");

  return { playerId, map };
}
