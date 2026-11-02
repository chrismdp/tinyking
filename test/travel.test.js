import { Hex, Grid, ALL_SIDES, WorldHex, WorldGrid } from "game/hex";
import { newEntities } from "game/entities";
import { addBidirectionalLink } from "game/pathfinding";
import { peopleWorld } from "./support/people";
import { edgeSide, destinationFor, initialiseTravel, acceptTravel, localSnapshot, freezeOpinions } from "game/travel";
import { createPossession } from "game/possessions";
import { disposition } from "game/people";
import { historyStep } from "game/history";
export function travelWorld() {
  const {
    state: s,
    player,
    person,
    parent,
    sibling
  } = peopleWorld();
  // A small, connected world is diagnostic geometry, not a generated community.
  s.ecs.spatial = Object.fromEntries([player, person, parent, sibling].map(id => [id, {
    ...Hex(4, 4).toPoint()
  }]));
  s.ecs.mappable = {};
  s.ecs.walkable = {};
  s.space = {};
  const hexes = Grid.hexagon({
    center: Hex(4, 4),
    radius: 4
  });
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
      neighbours: {},
      worn: {}
    }
  })));
  hexes.forEach((h, i) => Grid.hexagon({
    center: h,
    radius: 1
  }).neighborsOf(h, ALL_SIDES).forEach((n, side) => {
    const j = hexes.findIndex(h => h.equals(n));
    if (j >= 0) addBidirectionalLink(s.ecs, tiles[i], side, tiles[j]);
  }));
  s.map = {
    seed: 13,
    centre: {
      x: 4,
      y: 4
    },
    radius: 4,
    playerStartTile: {
      x: 4,
      y: 2
    }
  };
  s.ui.show = {};
  s.villages = {};
  s.events = [];
  s.social = {
    lastSeason: 0,
    courtships: {},
    avoidance: {}
  };
  s.world = {
    home: {
      x: 5,
      y: 5
    },
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
  initialiseTravel(s, 13);
  return {
    s,
    player,
    person,
    parent,
    sibling,
    tiles
  };
}
it("offers all six sides consistently at corners and blocks ocean and world rim", () => {
  const {
    s,
    tiles
  } = travelWorld();
  for (const side of ALL_SIDES) {
    const id = tiles.find(id => edgeSide(s, id) === side);
    expect(id).toBeDefined();
    const d = destinationFor(s, id);
    expect(d.side).toBe(side);
    expect(d.arrivalSide).toBe((side + 3) % 6);
    expect(d.blocked).toBeFalsy();
    d.hex.ocean = true;
    expect(destinationFor(s, id).blocked).toMatch(/ocean/i);
    d.hex.ocean = false;
  }
  for (const id of tiles) expect(edgeSide(s, id)).toBe(edgeSide(s, id));
  const id = tiles.find(id => edgeSide(s, id) === 0);
  s.world.hexes = s.world.hexes.filter(h => h !== destinationFor(s, id).hex);
  expect(destinationFor(s, id).blocked).toMatch(/world/i);
});
it("announces cancellation, releases claims and actual borrowed crop, retaining unique working-hand objects", () => {
  const {
    s,
    player,
    tiles
  } = travelWorld();
  const id = tiles.find(id => edgeSide(s, id) === 0);
  const item = createPossession(s, player, "Brooch");
  s.ecs.holder[player].held = [item];
  s.ecs.haulable[item].heldBy = player;
  const [crop] = newEntities(s, [{
    spatial: {
      ...s.ecs.spatial[player]
    },
    good: {
      type: "grain",
      amount: 1
    },
    haulable: {
      heldBy: player,
      reservedFor: player
    },
    controllable: {
      controllerId: "family"
    }
  }]);
  s.ecs.holder[player].held.push(crop);
  s.favours = {
    requests: {
      r: {
        id: "r",
        status: "accepted",
        kind: "harvest",
        cargo: [crop]
      }
    }
  };
  s.ecs.manager[player].jobs = [{
    id: "task-1",
    job: {
      key: "favour"
    },
    favourId: "r",
    assignedId: player
  }];
  s.ecs.farmable = {
    f: {
      claimerId: player,
      slots: [{
        workerId: player
      }, {
        workerId: "other"
      }]
    }
  };
  expect(acceptTravel(s, id)).toBe(true);
  expect(s.favours.requests.r.status).toBe("cancelled");
  expect(s.ecs.holder[player].held).toEqual([item]);
  expect(s.ecs.controllable[crop].controllerId).toBe("family");
  expect(s.ecs.haulable[crop].heldBy).toBeFalsy();
  expect(s.ecs.farmable.f.slots).toEqual([{}, {
    workerId: "other"
  }]);
  expect(s.ecs.manager[player].jobs.map(j => j.job.key)).toEqual(["travel"]);
});
it("preserves directional dispositions independently of the destination seed and quantiles", () => {
  const {
    s,
    player,
    person,
    parent
  } = travelWorld();
  freezeOpinions(s);
  s.ecs.personality[parent].dislikes = ["generous", "proud", "brave"];
  const before = [disposition(s, person, player), disposition(s, parent, player), disposition(s, player, person)];
  s.peopleSeed = "another-world";
  s.opinionThresholds = {
    hate: 100,
    love: 101
  };
  expect([disposition(s, person, player), disposition(s, parent, player), disposition(s, player, person)]).toEqual(before);
});
it("history is pure and does not age or drift a remote person", () => {
  const {
    s,
    player,
    person
  } = travelWorld();
  s.residents = {
    [player]: true
  };
  const before = JSON.stringify(s.ecs.personable[person]);
  const next = historyStep(localSnapshot(s), 1);
  expect(JSON.stringify(next.ecs.personable[person])).toBe(before);
});

it("preserves remote bonds and complete input purity while exactly one resident ages and drifts", () => {
  const {
    s,
    person,
    parent
  } = travelWorld();
  s.residents = {
    [parent]: true
  };
  s.ecs.relationships[person].known[parent] = {
    ring: "personal",
    goodwill: 45,
    base: 0
  };
  s.ecs.relationships[parent].known[person] = {
    ring: "personal",
    goodwill: 45,
    base: 0
  };
  const input = localSnapshot(s),
    before = JSON.stringify(input),
    age = s.ecs.personable[parent].age;
  const next = historyStep(input, 1);
  expect(JSON.stringify(input)).toBe(before);
  expect(next.ecs.relationships[person].known[parent]).toEqual({
    ring: "personal",
    goodwill: 45,
    base: 0
  });
  expect(next.ecs.relationships[parent].known[person].goodwill).toBeCloseTo(43.2);
  expect(next.ecs.personable[parent].lifeYears).toBeGreaterThan(0);
  expect(next.ecs.personable[parent].age).toBeGreaterThanOrEqual(age);
  expect(next.ecs.personable[person]).toEqual(input.ecs.personable[person]);
});

it("runtime children inherit the established calibration without recalibrating existing residents", () => {
  const {
      community
    } = require("./support/travel"),
    {
      birth
    } = require("../src/game/social");
  const {
    s,
    ids
  } = community();
  const before = JSON.stringify(ids.map(id => s.ecs.personality[id]));
  s.opinionThresholds = {
    hate: 20,
    love: 30
  };
  s.peopleSeed = 999;
  const child = birth(s, ids[1], ids[2], 1);
  expect(s.ecs.personality[child].opinionThresholds).toEqual(s.ecs.personality[ids[1]].opinionThresholds);
  expect(s.ecs.personality[child].opinionSeed).toBe(s.ecs.personality[ids[1]].opinionSeed);
  expect(JSON.stringify(ids.map(id => s.ecs.personality[id]))).toBe(before);
});
