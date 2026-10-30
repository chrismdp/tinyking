import { community, attach } from "./support/travel";
import { advanceWorldClock, acceptTravel, completeTravel, initialiseTravel, localSnapshot, departNpc } from "game/travel";
import { worldKey, neighbours } from "game/travel_geometry";
import { historyStep } from "game/history";
import { advanceSeason, related, romanticInterest, canCourt, eligiblePartners } from "game/social";
import { disposition, meet } from "game/people";
import { newEntities } from "game/entities";
import { createPossession } from "game/possessions";
import { createSimulation } from "game/simulation";
import { skipIntro, updateIntro } from "game/intro";
import { Hex } from "game/hex";
import { weatherForWorld } from "game/weather";
import { season, year } from "game/time";
const stepSeason = async s => {
  s.days += 3;
  advanceSeason(s, Math.floor(s.days / 3));
  await advanceWorldClock(s);
};
function pairedWorld() {
  const a = community(),
    b = community({
      namespace: "b-",
      key: worldKey(neighbours(a.s.world.home)[0]),
      player: false
    });
  attach(a.s, b.s);
  // Only one adjacent land community; nobody is told who lives there.
  for (const h of a.s.world.hexes) h.ocean = ![a.s.map.worldKey, b.s.map.worldKey].includes(worldKey(h));
  return {
    a,
    b
  };
}
it("autonomously searches despite unrelated but incompatible locals, while player stays home; arrivals wait for the next season", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    seeker = a.ids[1],
    incompatible = a.ids[2];
  s.ecs.personality[incompatible].likes = [];
  s.ecs.personality[incompatible].dislikes = ["generous"];
  s.ecs.personality[incompatible].opinionThresholds = {
    hate: -.5,
    love: .5
  };
  expect(eligiblePartners(s, seeker)).toContain(incompatible);
  expect(romanticInterest(s, seeker, incompatible)).toBe(false);
  await stepSeason(s);
  const intent = s.ecs.planner[seeker].world.worldJourney;
  expect(intent.to).toBe(b.s.map.worldKey);
  departNpc(s, seeker, intent);
  const due = s.days + 3;
  s.days = due;
  advanceSeason(s, Math.floor(due / 3));
  await advanceWorldClock(s);
  const dest = s.travel.maps[b.s.map.worldKey];
  expect(dest.residents[seeker]).toBe(true);
  expect(s.residents[seeker]).toBeUndefined();
  expect(s.travel.transit.some(t => t.bundle.id == seeker)).toBe(false);
  expect(dest.ecs.personable[seeker].age).toBe(26); // one departure and one journey season
  expect(dest.events.some(e => e.type === "world_visit" && e.people[0] === seeker)).toBe(true);
  expect(Object.keys(s.travel.maps)).toHaveLength(2);
  expect(s.travel.active).toBe(a.s.map.worldKey);
  // Contact and real summary courtship must work with transferred ID keys.
  for (let i = 0; i < 8 && !s.travel.maps[b.s.map.worldKey].ecs.kinship[seeker].spouse; i++) await stepSeason(s);
  const final = s.travel.maps[b.s.map.worldKey];
  expect(final.ecs.kinship[seeker].spouse).toBeTruthy();
  const spouse = final.ecs.kinship[seeker].spouse;
  expect(final.ecs.kinship[spouse].spouse).toBe(seeker);
  expect(final.events.some(e => e.type === "marriage" && e.people.includes(seeker))).toBe(true);
  expect(s.travel.visits[seeker]).toBeUndefined();
});
it("excludes siblings and first cousins across maps and after missing ancestors are later imported", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    x = a.ids[1],
    y = b.ids[1];
  s.ecs.kinship[x].parents = ["parent-a"];
  b.s.ecs.kinship[y].parents = ["parent-b"];
  attach(s, b.s);
  await advanceWorldClock(s);
  expect(related(s, x, y)).toBe(false); // warm the formerly stale ancestry cache
  s.ecs.kinship["parent-a"] = {
    parents: ["grandparent"],
    children: [x],
    spouse: null
  };
  s.ecs.kinship["parent-b"] = {
    parents: ["grandparent"],
    children: [y],
    spouse: null
  };
  expect(related(s, x, y)).toBe(true);
  expect(romanticInterest(s, x, y)).toBe(false);
  s.ecs.kinship[y] = {
    ...b.s.ecs.kinship[y],
    parents: ["parent-a"]
  };
  expect(related(s, x, y)).toBe(true);
});
it("moves the same player and real carried cargo across all six facing edges, one season exactly, preserving each old home", async () => {
  for (let side = 0; side < 6; side++) {
    const a = community(),
      s = a.s,
      id = a.ids[0],
      destKey = worldKey(neighbours(s.world.home)[side]);
    const b = community({
      namespace: "w" + side + "-",
      key: destKey,
      player: false
    });
    attach(s, b.s);
    // Prevent unrelated NPC journeys in this geometry/ownership fixture.
    for (const p of Object.values(s.ecs.personable)) p.age = 10;
    for (const p of Object.values(b.s.ecs.personable)) p.age = 10;
    const item = createPossession(s, id, "Family brooch");
    s.ecs.holder[id].held.push(item);
    s.ecs.haulable[item].heldBy = id;
    const [cargo] = newEntities(s, [{
      good: {
        type: "grain",
        amount: 1
      },
      spatial: {
        ...s.ecs.spatial[id]
      },
      haulable: {
        heldBy: id
      },
      controllable: {
        controllerId: a.ids[1]
      }
    }]);
    s.ecs.holder[id].held.push(cargo);
    s.ecs.controllable[a.house].controllerId = id;
    s.ecs.container = {
      store: {
        id: "store",
        amounts: {
          wood: 7
        },
        capacity: 100
      }
    };
    const before = s.days,
      provenance = JSON.stringify(s.ecs.possession[item]),
      tile = s.map.entrances[side].tileIds[0];
    expect(acceptTravel(s, tile)).toBe(true);
    const order = s.ecs.manager[id].jobs[0];
    await completeTravel(s, order);
    expect(s.days).toBe(before + 3);
    expect(season(s.days)).toBe("summer");
    expect(year(s.days)).toBe(1);
    expect(s.weather).toEqual(weatherForWorld(s.world, 13, s.days));
    expect(s.travel.active).toBe(destKey);
    expect(s.intro.tileIds).toEqual(s.map.entrances[(side + 3) % 6].tileIds);
    expect(s.ecs.playable[id]).toBeDefined();
    expect(Object.keys(s.ecs.playable).filter(p => s.residents[p])).toEqual([id]);
    expect(JSON.stringify(s.ecs.possession[item])).toBe(provenance);
    expect(s.ecs.haulable[cargo].heldBy).toBe(id);
    expect(s.ecs.controllable[cargo].controllerId).toBe(a.ids[1]);
    const home = s.travel.maps["5,5"];
    expect(home.ecs.container.store.amounts.wood).toBe(7);
    expect(home.ecs.controllable[a.house].controllerId).toBe(id);
    expect(s.travel.historyCalls.filter(c => c.key === "5,5" && c.season === 1)).toHaveLength(1);
    const needs = {
      ...s.ecs.personable[id]
    };
    updateIntro(s, 1);
    skipIntro(s);
    expect(s.ecs.personable[id]).toEqual(needs);
    const camp = s.intro.campId;
    skipIntro(s);
    expect(s.intro.campId).toBe(camp);
    const reverse = s.map.entrances[(side + 3) % 6].tileIds[0];
    acceptTravel(s, reverse);
    await completeTravel(s, s.ecs.manager[id].jobs[0]);
    skipIntro(s);
    expect(s.travel.active).toBe("5,5");
    expect(s.ecs.container.store.amounts.wood).toBe(7);
    expect(s.ecs.controllable[a.house].controllerId).toBe(id);
  }
});
it("ordinary active seasons catch up off-screen residents exactly once and autonomous walking departures cross the edge", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1];
  // Diagnostic survival isolation: no meals/planning other than the traveller;
  // hunger is below starvation over these four ordinary active seasons.
  for (const p of Object.values(s.ecs.personable)) {
    p.hunger = -20;
    p.tiredness = -20;
  }
  s.ecs.planner[a.ids[0]].plan = [["wait_for", 20]];
  s.ecs.planner[a.ids[2]].plan = [["wait_for", 20]];
  s.ecs.personality[a.ids[2]].likes = [];
  s.ecs.personality[a.ids[2]].dislikes = ["generous"];
  s.ecs.personality[a.ids[2]].opinionThresholds = {
    hate: -.5,
    love: .5
  };
  const sim = createSimulation(s);
  let walked = false;
  for (let i = 0; i < 3000; i++) {
    sim.step(6);
    if (sim.pending) await sim.pending;
    if (s.ecs.planner[id]?.task?.[0] === "leave_edge") walked = true;
  }
  expect(s.days).toBeGreaterThan(12);
  expect(walked).toBe(true);
  expect(s.travel.active).toBe("5,5");
  for (let season = 1; season <= 4; season++) expect(s.travel.historyCalls.filter(c => c.key === b.s.map.worldKey && c.season === season)).toHaveLength(1);
  expect(s.travel.maps[b.s.map.worldKey].events.some(e => e.type === "world_visit" && e.people[0] === id)).toBe(true);
});
it("persists a changed first camp/store/build through a multi-hop loop and several ordinary home seasons", async () => {
  const a = community(),
    s = a.s,
    id = a.ids[0];
  // This fixture supplies geometry and an existing build/store. It makes no
  // claim about player resource gathering; UI evidence covers normal orders.
  s.ecs.camp = {
    [a.house]: {
      id: a.house
    }
  };
  s.ecs.controllable[a.house].controllerId = id;
  s.ecs.container = {
    [a.house]: {
      id: a.house,
      amounts: {
        grain: 9,
        wood: 4
      },
      capacity: 100
    }
  };
  s.ecs.shelter = {
    [a.house]: {
      id: a.house,
      stage: "hut"
    }
  };
  for (const p of Object.values(s.ecs.personable)) p.age = 10;
  const keys = ["5,5", worldKey(neighbours(s.world.home)[0])];
  const second = community({
    namespace: "loop-b-",
    key: keys[1],
    player: false
  });
  attach(s, second.s);
  const cKey = worldKey(neighbours(second.s.world.home)[2]),
    third = community({
      namespace: "loop-c-",
      key: cKey,
      player: false
    });
  attach(s, third.s);
  keys.push(cKey, "5,5");
  for (const map of Object.values(s.travel.maps)) for (const p of Object.values(map.ecs.personable)) p.age = 10;
  const expected = cloneForTest(s.ecs.container[a.house]);
  for (let i = 1; i < keys.length; i++) {
    // Ordinary play's active season has already been processed by socialHour.
    for (let season = 0; season < 3; season++) await stepSeason(s);
    const side = neighbours(s.world.home).findIndex(h => worldKey(h) === keys[i]);
    expect(side).toBeGreaterThanOrEqual(0);
    acceptTravel(s, s.map.entrances[side].tileIds[0]);
    await completeTravel(s, s.ecs.manager[id].jobs[0]);
    skipIntro(s);
  }
  expect(s.travel.active).toBe("5,5");
  expect(s.ecs.container[a.house]).toEqual(expected);
  expect(s.ecs.shelter[a.house].stage).toBe("hut");
  expect(s.ecs.controllable[a.house].controllerId).toBe(id);
  const ledger = s.travel.historyCalls.filter(c => c.kind === "away");
  expect(new Set(ledger.map(c => c.key + ":" + c.season)).size).toBe(ledger.length);
  const residentPlayers = Object.values(s.travel.maps).flatMap(m => Object.keys(m.ecs.playable).filter(p => m.residents[p]));
  expect(residentPlayers).toEqual([id]);
});
const cloneForTest = value => JSON.parse(JSON.stringify(value));
it("an isolated related village seeks an unrelated community; returning NPCs walk in on the active map", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    sibling = a.ids[2];
  s.ecs.kinship[id].parents = ["shared-parent"];
  s.ecs.kinship[sibling].parents = ["shared-parent"];
  expect(eligiblePartners(s, id)).toHaveLength(0);
  await stepSeason(s);
  const intent = s.ecs.planner[id].world.worldJourney;
  expect(intent.to).toBe(b.s.map.worldKey);
  const item = createPossession(s, id, "Traveller tool");
  const own = s.ecs.controllable[a.house].controllerId;
  departNpc(s, id, intent);
  await stepSeason(s);
  const there = s.travel.maps[b.s.map.worldKey];
  expect(there.ecs.possession[item].ownerId).toBe(id);
  expect(s.travel.maps["5,5"].ecs.controllable[a.house].controllerId).toBe(own);
  // A real return trip is a whole further season, even on an active-map arrival.
  departNpc(there, id, {
    to: "5,5",
    returning: true
  }, s.travel);
  await stepSeason(s);
  expect(s.residents[id]).toBe(true);
  expect(s.ecs.holder[id]).toBeDefined();
  expect(s.ecs.possession[item].ownerId).toBe(id);
  expect(s.ecs.planner[id].world.worldArrival).toBeDefined();
  const before = {
    ...s.ecs.spatial[id]
  };
  const sim = createSimulation(s);
  sim.step(6);
  if (sim.pending) await sim.pending;
  sim.step(6);
  expect(s.ecs.spatial[id]).not.toEqual(before);
  expect(s.ecs.kinship[id].parents).toEqual(["shared-parent"]);
  expect(related(s, id, sibling)).toBe(true);
});
it("keeps a traveller's hater, friend and viable partner dispositions in both directions through a real transfer", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    friend = a.ids[2],
    hater = a.ids[0];
  s.ecs.personality[hater].opinionThresholds = {
    hate: 100,
    love: 101
  };
  for (const x of [id, friend, hater]) for (const y of [id, friend, hater]) if (x !== y) meet(s, x, y);
  s.ecs.relationships[id].known[friend] = {
    ring: "intimate",
    goodwill: 70,
    base: 70
  };
  s.ecs.relationships[friend].known[id] = {
    ring: "intimate",
    goodwill: 70,
    base: 70
  };
  expect(romanticInterest(s, id, friend)).toBe(true);
  expect(disposition(s, hater, id)).toBe("hate");
  const pairs = [[hater, id], [id, hater], [id, friend], [friend, id]],
    before = pairs.map(([x, y]) => disposition(s, x, y));
  departNpc(s, id, {
    to: b.s.map.worldKey,
    side: 0
  });
  await stepSeason(s);
  const dest = s.travel.maps[b.s.map.worldKey];
  expect(pairs.map(([x, y]) => disposition(dest, x, y))).toEqual(before);
  expect(dest.ecs.relationships[id].known[friend].ring).toBe("intimate");
  expect(canCourt(dest, id, friend)).toBe(false);
  departNpc(dest, id, {
    to: "5,5",
    returning: true
  }, s.travel);
  await stepSeason(s);
  expect(pairs.map(([x, y]) => disposition(s, x, y))).toEqual(before);
  expect(romanticInterest(s, id, friend)).toBe(true);
});
it("transit preserves a real season of outgoing goodwill for NPCs and the player without changing needs", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    friend = a.ids[2];
  s.ecs.relationships[id].known[friend] = {
    ring: "personal",
    goodwill: 45,
    base: 0
  };
  const hunger = s.ecs.personable[id].hunger;
  departNpc(s, id, {
    to: b.s.map.worldKey,
    side: 0
  });
  await stepSeason(s);
  const dest = s.travel.maps[b.s.map.worldKey];
  expect(dest.ecs.relationships[id].known[friend].goodwill).toBeCloseTo(43.2);
  expect(dest.ecs.personable[id].hunger).toBe(hunger);
  const player = a.ids[0];
  s.ecs.relationships[player].known[friend] = {
    ring: "personal",
    goodwill: 45,
    base: 0
  };
  const needs = {
    hunger: s.ecs.personable[player].hunger,
    tiredness: s.ecs.personable[player].tiredness
  };
  acceptTravel(s, s.map.entrances[0].tileIds[0]);
  await completeTravel(s, s.ecs.manager[player].jobs[0]);
  expect(s.ecs.relationships[player].known[friend].goodwill).toBeCloseTo(43.2);
  expect(s.ecs.personable[player]).toMatchObject(needs);
});
it("processes death in transit with the real carried heirloom and remote heir, retaining the estate and news", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    heir = a.ids[2];
  s.ecs.personable[id].age = 88;
  s.ecs.personable[id].lifeYears = 37.25;
  s.ecs.kinship[id].children = [heir];
  s.ecs.kinship[heir].parents = [id];
  s.ecs.controllable[a.house].controllerId = id;
  const item = createPossession(s, id, "Old ring");
  departNpc(s, id, {
    to: b.s.map.worldKey,
    side: 0
  });
  await stepSeason(s);
  expect(s.travel.people[id].personable).toMatchObject({
    dead: true,
    deathProcessed: true,
    deathCause: "old age"
  });
  const maps = Object.values(s.travel.maps);
  const itemMap = maps.find(m => m.ecs.possession?.[item]);
  expect(itemMap.ecs.possession[item].ownerId).toBe(heir);
  expect(itemMap.ecs.possession[item].owners.at(-1)).toMatchObject({
    personId: heir,
    reason: "inheritance"
  });
  expect(s.travel.maps["5,5"].ecs.controllable[a.house].controllerId).toBe(heir);
  expect(Object.values(s.travel.events).some(e => e.type === "death" && e.people[0] === id)).toBe(true);
  expect(maps.some(m => m.ecs.planner?.[id] && !m.ecs.personable[id].dead)).toBe(false);
});
it.each([false, true])("guest accommodation preserves the original controller/estate and clears local jobs (dependent=%s)", async dependent => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    head = dependent ? a.ids[2] : id;
  s.ecs.controllable[id].controllerId = head;
  s.ecs.controllable[a.house].controllerId = head;
  const item = createPossession(s, id, "Guest ring");
  const controller = s.ecs.controllable[id].controllerId;
  s.ecs.manager[id].jobs = [{
    id: "local",
    job: {
      key: "move_to_here"
    },
    targetId: a.tiles[0]
  }];
  departNpc(s, id, {
    to: b.s.map.worldKey,
    side: 0
  });
  await stepSeason(s);
  const dest = s.travel.maps[b.s.map.worldKey];
  expect(dest.ecs.controllable[id].controllerId).toBe(controller);
  expect(s.travel.maps["5,5"].ecs.controllable[a.house].controllerId).toBe(head);
  expect(dest.ecs.possession[item].ownerId).toBe(id);
  expect(dest.ecs.manager[id].jobs).toEqual([]);
  expect(dest.ecs.guest[id].houseId).toBeDefined();
});
it("eats genuine owned food from full working hands after player arrival; the held unique item survives", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[0];
  const item = createPossession(s, id, "Brooch");
  const [food] = newEntities(s, [{
    spatial: {
      ...s.ecs.spatial[id]
    },
    good: {
      type: "grain",
      amount: 1
    },
    haulable: {
      heldBy: id
    },
    controllable: {
      controllerId: id
    }
  }]);
  s.ecs.haulable[item].heldBy = id;
  s.ecs.holder[id].held = [item, food];
  s.ecs.personable[id].hunger = 1.5;
  acceptTravel(s, s.map.entrances[0].tileIds[0]);
  expect(s.ecs.planner[id].world.holding.grain).toBe(true);
  await completeTravel(s, s.ecs.manager[id].jobs[0]);
  skipIntro(s);
  expect(s.ecs.planner[id].world.holding.grain).toBe(true);
  const sim = createSimulation(s);
  for (let i = 0; i < 30; i++) {
    sim.step(6);
    if (sim.pending) await sim.pending;
  }
  expect(s.ecs.personable[id].hunger).toBeLessThan(.3);
  expect(s.ecs.good[food]).toBeUndefined();
  expect(s.ecs.holder[id].held).toContain(item);
  expect(s.ecs.possession[item].name).toBe("Brooch");
});
it("returns to the existing built household rather than resetting residence to the old bedroll", async () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[0];
  // Existing opening bedroll and a later completed house are distinct places.
  const [camp] = newEntities(s, [{
    spatial: {
      ...s.ecs.spatial[a.tiles[0]],
      immovable: true
    },
    camp: {},
    sleepable: {
      capacity: 0,
      occupiers: []
    },
    controllable: {
      controllerId: id
    }
  }]);
  s.map.homeId = camp;
  s.ecs.shelter = {
    [a.house]: {
      id: a.house,
      stage: "lean-to"
    }
  };
  s.ecs.household[id].houseId = a.house;
  s.ecs.controllable[a.house].controllerId = id;
  acceptTravel(s, s.map.entrances[0].tileIds[0]);
  await completeTravel(s, s.ecs.manager[id].jobs[0]);
  skipIntro(s);
  acceptTravel(s, s.map.entrances[3].tileIds[0]);
  await completeTravel(s, s.ecs.manager[id].jobs[0]);
  skipIntro(s);
  expect(s.ecs.household[id].houseId).toBe(a.house);
  expect(s.map.homeId).toBe(a.house);
  expect(Object.keys(s.ecs.camp)).toEqual([camp]);
});
it.each([false, true])("reconciles death after a visit/marriage move across the original estate exactly once (settled=%s)", async settled => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    child = b.ids[1];
  let heir = child;
  s.ecs.kinship[id].children = [child];
  b.s.ecs.kinship[child].parents = [id];
  attach(s, b.s);
  s.ecs.controllable[a.house].controllerId = id;
  const item = createPossession(s, id, "Original estate ring");
  s.ecs.possession[item].carried = false;
  departNpc(s, id, {
    to: b.s.map.worldKey,
    side: 0
  });
  await stepSeason(s);
  let dest = s.travel.maps[b.s.map.worldKey];
  if (settled) {
    for (let season = 0; season < 12 && !dest.ecs.kinship[id].spouse; season++) {
      await stepSeason(s);
      dest = s.travel.maps[b.s.map.worldKey];
    }
    heir = dest.ecs.kinship[id].spouse;
    expect(heir).toBeTruthy();
    expect(dest.ecs.kinship[heir].spouse).toBe(id);
    expect(dest.events.some(e => e.type == "marriage" && e.people.includes(id))).toBe(true);
    expect(dest.ecs.guest?.[id]).toBeUndefined();
    expect(s.travel.visits[id]).toBeUndefined();
  }
  dest.ecs.personable[id].age = 88;
  dest.ecs.personable[id].lifeYears = 37.25;
  await stepSeason(s);
  const home = s.travel.maps["5,5"];
  expect(s.travel.people[id].personable.dead).toBe(true);
  expect(home.ecs.controllable[a.house].controllerId).toBe(heir);
  expect(home.ecs.possession[item].ownerId).toBe(heir);
  expect(home.ecs.possession[item].owners.at(-1)).toMatchObject({
    personId: heir,
    reason: "inheritance"
  });
  const chain = JSON.stringify(home.ecs.possession[item].owners),
    events = Object.values(s.travel.events).filter(e => e.type === "inheritance" && e.people[0] === id && e.items.includes(item));
  expect(events).toHaveLength(1);
  expect(home.ecs.controllable[item].controllerId).toBe(heir);
  await stepSeason(s);
  expect(JSON.stringify(home.ecs.possession[item].owners)).toBe(chain);
  expect(Object.values(s.travel.events).filter(e => e.type === "inheritance" && e.people[0] === id && e.items.includes(item))).toHaveLength(1);
  const heirMap = Object.values(s.travel.maps).find(m => m.residents[heir]);
  expect(heirMap.knowledge[heir].events).toContain(events[0].id);
});
it("a departing family head leaves local relatives with an executable independent household planner", () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    relative = a.ids[2];
  s.ecs.controllable[relative].controllerId = id;
  departNpc(s, id, {
    to: b.s.map.worldKey,
    side: 0
  });
  expect(s.ecs.controllable[relative].controllerId).toBe(relative);
  const sim = createSimulation(s);
  expect(() => sim.step(6)).not.toThrow();
  expect(s.ecs.controllable[a.house].controllerId).toBe(id);
});
it("finishes the physical edge crossing before a hunger-triggered replan can pathfind from off-map", () => {
  const {
      a,
      b
    } = pairedWorld(),
    s = a.s,
    id = a.ids[1],
    tile = s.map.entrances[0].tileIds[0],
    intent = {
      to: b.s.map.worldKey,
      side: 0,
      tileId: tile
    };
  const {
      exitPoint,
      tileAt
    } = require("../src/game/travel_geometry"),
    out = exitPoint(s, tile),
    at = s.ecs.spatial[tile];
  s.ecs.spatial[id] = {
    ...s.ecs.spatial[id],
    x: at.x + (out.x - at.x) * .9,
    y: at.y + (out.y - at.y) * .9
  };
  expect(tileAt(s, s.ecs.spatial[id])).toBeUndefined();
  const p = s.ecs.planner[id];
  p.world.worldJourney = intent;
  p.task = ["leave_edge", tile, intent];
  p.plan = [];
  s.ecs.personable[id].hunger = 1;
  const sim = createSimulation(s);
  expect(() => sim.step(6)).not.toThrow();
  expect(s.travel.transit.some(t => t.bundle.id === id)).toBe(true);
});
it("cancels local promises added during the departure walk at the actual edge, releasing borrowed cargo before crossing", () => {
  const {
      a
    } = pairedWorld(),
    s = a.s,
    id = a.ids[0],
    tile = s.map.entrances[0].tileIds[0];
  acceptTravel(s, tile);
  const travel = s.ecs.manager[id].jobs[0];
  travel.assignedId = id;
  const [crop] = newEntities(s, [{
    spatial: {
      ...s.ecs.spatial[tile]
    },
    good: {
      type: "grain",
      amount: 1
    },
    haulable: {
      heldBy: id,
      reservedFor: id
    },
    controllable: {
      controllerId: a.ids[1]
    }
  }]);
  const [store] = newEntities(s, [{
    spatial: {
      ...s.ecs.spatial[a.house]
    },
    container: {
      capacity: 100,
      amounts: {}
    },
    interior: {
      buildingId: a.house
    },
    controllable: {
      controllerId: a.house
    }
  }]);
  s.ecs.household[a.house].storeId = store;
  s.ecs.farmable = {
    [a.tiles[1]]: {
      id: a.tiles[1],
      houseId: a.house,
      slots: [{
        state: "harvestable"
      }]
    }
  };
  s.ecs.holder[id].held = [crop];
  s.favours = {
    nextId: 0,
    requests: {
      late: {
        id: "late",
        giverId: a.ids[1],
        householdId: a.house,
        targetId: a.tiles[1],
        quantity: 1,
        progress: 0,
        produced: 1,
        delivered: 0,
        status: "accepted",
        kind: "harvest",
        cargo: [crop]
      }
    }
  };
  s.ecs.manager[id].jobs.push({
    id: "late-task",
    job: {
      key: "favour"
    },
    favourId: "late"
  });
  Object.assign(s.ecs.spatial[id], s.ecs.spatial[tile], {
    immovable: false
  });
  const p = s.ecs.planner[id];
  p.world.currentJob = "travel";
  p.plan = [["leave_edge", tile, travel]];
  const sim = createSimulation(s);
  sim.step(6);
  expect(s.favours.requests.late.status).toBe("cancelled");
  expect(s.ecs.haulable[crop].heldBy).toBeFalsy();
  expect(s.ecs.controllable[crop].controllerId).toBe(a.ids[1]);
  expect(s.ecs.spatial[crop].x).toBe(s.ecs.spatial[tile].x);
  expect(s.ecs.spatial[crop].y).toBe(s.ecs.spatial[tile].y);
  expect(s.ecs.manager[id].jobs.map(j => j.id)).toEqual([travel.id]);
});

it('keeps hourly weather on the global world seed after entering a separately seeded map',async()=>{
 const {a,b}=pairedWorld(),s=a.s,id=a.ids[0];b.s.map.seed=98765;
 acceptTravel(s,s.map.entrances[0].tileIds[0]);await completeTravel(s,s.ecs.manager[id].jobs[0]);skipIntro(s);
 expect(s.map.seed).toBe(98765);s.days+=1/24;
 const {updateWeather,weatherForWorld}=require('../src/game/weather');updateWeather(s);
 expect(s.weather).toEqual(weatherForWorld(s.world,13,s.days));
});
