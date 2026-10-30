import { Hex, Grid, WorldHex, WorldGrid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";
import { addBidirectionalLink } from "game/pathfinding";
import { initialiseTravel, localSnapshot, freezeOpinions } from "game/travel";
import { prepareEntrances, worldKey } from "game/travel_geometry";
export function community({
  namespace = "",
  key = "5,5",
  player = true
} = {}) {
  const s = {
    ecs: {
      nextId: 1,
      namespace
    },
    space: {},
    days: .375,
    redraws: [],
    ui: {
      show: {}
    },
    game_speed: "fast",
    peopleSeed: 13,
    opinionThresholds: {
      hate: -100,
      love: -50
    },
    knowledge: {},
    events: [],
    social: {
      lastSeason: 0,
      courtships: {},
      avoidance: {}
    }
  };
  const hexes = Grid.hexagon({
      center: Hex(6, 6),
      radius: 6
    }),
    worldHex = Object.fromEntries(key.split(",").map((n, i) => [i ? "y" : "x", +n]));
  s.world = {
    home: worldHex,
    hexes: WorldGrid.hexagon({
      center: WorldHex(5, 5),
      radius: 2
    }).map(h => ({
      x: h.x,
      y: h.y,
      biome: "grassland",
      temperature: "temperate",
      moisture: "normal",
      morality: "neutral"
    }))
  };
  const tiles = newEntities(s, hexes.map(h => ({
    spatial: {
      ...h.toPoint(),
      immovable: true
    },
    mappable: {
      terrain: "grassland"
    },
    walkable: {
      speed: 1,
      worn: {},
      neighbours: {}
    }
  })));
  hexes.forEach((h, i) => Grid.hexagon({
    center: h,
    radius: 1
  }).neighborsOf(h, ALL_SIDES).forEach((n, side) => {
    const j = hexes.findIndex(h => h.equals(n));
    if (j >= 0) addBidirectionalLink(s.ecs, tiles[i], side, tiles[j]);
  }));
  const [house] = newEntities(s, [{
    spatial: {
      ...Hex(6, 6).toPoint(),
      immovable: true
    },
    nameable: {
      nickname: "Home"
    },
    building: {
      rooms: []
    },
    household: {
      fields: [],
      backyards: []
    },
    controllable: {},
    village: {
      villageId: namespace + "v"
    }
  }]);
  s.villages = {
    [namespace + "v"]: {
      id: namespace + "v",
      name: "Village",
      houses: [house],
      centre: {
        x: 6,
        y: 6
      },
      sharedPlaces: []
    }
  };
  const ids = newEntities(s, Array.from({
    length: 3
  }, (_, i) => ({
    spatial: {
      ...Hex(6, 6).toPoint()
    },
    nameable: {
      nickname: "Person " + i
    },
    personable: {
      age: 25,
      lifeYears: 5.5,
      hunger: .2,
      tiredness: .2
    },
    kinship: {
      parents: [],
      children: [],
      spouse: null
    },
    personality: {
      traits: ["generous"],
      likes: ["generous"],
      dislikes: []
    },
    relationships: {
      known: {}
    },
    household: {
      houseId: house
    },
    village: {
      villageId: namespace + "v"
    },
    controllable: {},
    holder: {
      held: [],
      capacity: 2
    },
    traits: {
      values: {}
    },
    attributes: {},
    manager: {
      jobs: [],
      ordered: player && i === 0
    },
    planner: {
      world: {
        no_place_for: {},
        jobs: [],
        places: {},
        feeling: {},
        holding: {},
        days: s.days,
        ordered: player && i === 0
      }
    }
  })), "person-");
  for (const id of ids) s.ecs.controllable[id].controllerId = id;
  s.ecs.controllable[house].controllerId = ids[1];
  s.ecs.playable = player ? {
    [ids[0]]: {
      id: ids[0],
      known: []
    }
  } : {};
  s.ui.playerId = player ? ids[0] : undefined;
  const landscape = Object.fromEntries(hexes.map(h => [h, {
    ...h.toPoint(),
    terrain: "grassland"
  }]));
  const entrances = prepareEntrances(hexes, landscape, {
    [Hex(6, 6)]: {
      x: 6,
      y: 6
    }
  }, s.world, {
    x: 6,
    y: 6
  }, 6);
  for (const e of Object.values(entrances)) e.tileIds = e.hexes.map(h => s.space[Hex(h)][0]);
  s.map = {
    seed: 13,
    worldKey: key,
    centre: {
      x: 6,
      y: 6
    },
    radius: 6,
    playerStartTile: entrances[0].hexes[2],
    entrances
  };
  initialiseTravel(s, 13);
  freezeOpinions(s);
  return {
    s,
    ids,
    tiles,
    house
  };
}
export function attach(s, other) {
  const snap = localSnapshot(other),
    key = worldKey(other.world.home);
  s.travel.maps[key] = snap;
  Object.assign(s.travel.people, other.travel.people);
  Object.assign(s.travel.villages, other.travel.villages);
  return snap;
}
