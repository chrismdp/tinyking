import { drift } from "game/people";
import { householdAccess } from "game/playable";
import { Hex } from "game/hex";
import { generateMap } from "game/map";
import { historyStep } from "game/history";
import { startIntro } from "game/intro";
import { updateWeather } from "game/weather";
import { cancelTask, enqueueTask, canReachTask } from "game/manager";
import { cancelFavour } from "game/favours";
import { releaseFriendWork } from "game/friend_help";
import { heirFor, transferPossession, repairHouseholds } from "game/possessions";
import { recordEvent } from "game/events";
import { romanticInterest } from "game/social";
import { hashUnit } from "game/math";
import { destinationFor, worldKey, neighbours, hexName } from "game/travel_geometry";
export { edgeSide, destinationFor, prepareEntrances, hexName, SIDE_NAMES } from "game/travel_geometry";
export const DEPARTURE_POLICY = "Travel cancels unfinished local tasks and favours without a reward. Work and deliveries stay done; borrowed harvest is left here for its household. Land, homes, stores and uncarried belongings stay yours here. Goods in your hands and carried personal possessions travel with you.";
export const TRANSITION_NEEDS = "The journey takes one season. Hunger and tiredness stay as they are while off-map and making camp; normal needs continue during the walk to the edge.";
const LOCAL_FIELDS = ["ecs", "space", "map", "villages", "events", "knowledge", "talking", "social", "favours", "ecology", "snow", "snowRevision", "residents", "peopleSeed", "opinionThresholds", "days"];
const IDENTITY = ["personable", "personality", "kinship", "relationships", "nameable", "controllable", "household", "village", "playable"];
const clone = value => JSON.parse(JSON.stringify(value));
const holdingFor = (s, id) => Object.fromEntries((s.ecs.holder[id]?.held || []).filter(item => !s.ecs.possession?.[item] && householdAccess(s.ecs, id, item)).map(item => [s.ecs.good[item]?.type, true]));
export function freezeOpinions(s) {
  for (const p of Object.values(s.ecs.personality || {})) {
    p.opinionSeed ??= s.peopleSeed;
    p.opinionThresholds ||= {
      ...s.opinionThresholds
    };
  }
}
export function localSnapshot(s) {
  return Object.fromEntries(LOCAL_FIELDS.filter(k => s[k] !== undefined).map(k => [k, s[k]]));
}
function publish(s, j) {
  freezeOpinions(s);
  for (const id of Object.keys(s.ecs.personable || {})) if (!s.residents || s.residents[id]) {
    j.people[id] ||= {};
    for (const key of IDENTITY) if (s.ecs[key]?.[id]) j.people[id][key] = s.ecs[key][id];
  }
  for (const e of s.events || []) j.events[e.id] = e;
  for (const [id, v] of Object.entries(s.villages || {})) if (v.houses?.length || !j.villages[id]) j.villages[id] = v;
}
function references(s, j) {
  Object.defineProperty(s, "peopleDirectory", {
    value: j.people,
    enumerable: false,
    writable: true,
    configurable: true
  });
  // Import only references this community can actually use, rather than an
  // all-world copy in every map. The authoritative directory retains everyone.
  const required = new Set(Object.keys(s.residents));
  for (const id of Object.keys(s.residents)) {
    const person = j.people[id],
      kin = person?.kinship || s.ecs.kinship[id];
    for (const other of [...(kin?.parents || []), ...(kin?.children || []), kin?.spouse, ...Object.keys(s.ecs.relationships[id]?.known || {}), ...Object.keys(s.knowledge?.[id]?.people || {})]) if (other) required.add(other);
  }
  for (const c of Object.values(s.ecs.controllable || {})) if (j.people[c.controllerId]) required.add(c.controllerId);
  const roots = [...required];
  // Two generations in either direction, and the siblings reached through a
  // parent's children. Later imports always rebuild this closure.
  for (const root of roots) {
    const queue = [[root, 0]];
    for (const [id, depth] of queue) if (depth < 2) {
      const kin = j.people[id]?.kinship || s.ecs.kinship[id];
      for (const other of [...(kin?.parents || []), ...(kin?.children || []), kin?.spouse]) if (other) {
        required.add(other);
        queue.push([other, depth + 1]);
      }
    }
  }
  for (const id of Object.keys(s.ecs.personable || {})) if (!s.residents[id] && !required.has(id)) for (const key of IDENTITY) delete s.ecs[key]?.[id];
  for (const id of required) if (!s.residents[id] && j.people[id]) for (const [key, value] of Object.entries(j.people[id])) (s.ecs[key] ||= {})[id] = value;
  // Events retain globally unique IDs. Knowledge remains with its observer.
  const learned = new Set(Object.keys(s.residents).flatMap(id => s.knowledge?.[id]?.events || []));
  const own = new Set((s.events || []).map(e => e.id));
  s.events = [...(s.events || []), ...Object.values(j.events).filter(e => !own.has(e.id) && learned.has(e.id))];
  s.villages = {
    ...Object.fromEntries(Object.entries(j.villages).map(([id, v]) => [id, {
      ...v,
      houses: [],
      sharedPlaces: []
    }])),
    ...s.villages
  };
}
export function initialiseTravel(s, seed) {
  freezeOpinions(s);
  s.residents = Object.fromEntries(Object.keys(s.ecs.personable).map(id => [id, true]));
  const key = worldKey(s.world.home),
    season = Math.floor(s.days / 3);
  s.travel = {
    seed,
    active: key,
    season,
    maps: {},
    people: {},
    events: {},
    villages: {},
    transit: [],
    visits: {},
    historyCalls: []
  };
  publish(s, s.travel);
  s.travel.maps[key] = localSnapshot(s);
}
const emptyWorld = () => ({
  ecs: {
    nextId: 1
  },
  space: {},
  redraws: [],
  ui: {
    show: {}
  },
  days: 0.375
});
export async function ensureMap(s, key) {
  const j = s.travel;
  if (j.maps[key]) return j.maps[key];
  const hex = s.world.hexes.find(h => worldKey(h) == key);
  if (!hex || hex.ocean) throw new Error("Cannot enter " + key);
  const fresh = emptyWorld(),
    seed = Math.floor(hashUnit(j.seed + ":hex:" + key) * 4294967296);
  fresh.ecs.namespace = "w" + hex.x + "_" + hex.y + "-";
  const started = performance.now();
  const result = await generateMap(fresh, seed, async label => {
    if(s.transition && s.ui?.actions?.progress_update) await s.ui.actions.progress_update(label);
  }, {
    world: s.world,
    hex,
    noPlayer: true,
    worldSeed: j.seed
  });
  fresh.map = result.map;
  fresh.residents = Object.fromEntries(Object.keys(fresh.ecs.personable).map(id => [id, true]));
  freezeOpinions(fresh);
  // A never-visited hex has its own deterministic prehistory, followed by all
  // elapsed global seasons, irrespective of its eventual first visitor.
  for (let season = 1; season <= j.season; season++) {
    const next = historyStep(fresh, season);
    Object.assign(fresh, next);
    j.historyCalls.push({
      key,
      season,
      kind: "fresh"
    });
  }
  j.timings ||= [];
  j.timings.push({
    key,
    ms: performance.now() - started,
    season: j.season
  });
  j.maps[key] = localSnapshot(fresh);
  publish(fresh, j);
  return j.maps[key];
}
export function releaseLocalWork(s, id) {
  const p = s.ecs.planner?.[id];
  if (p) {
    if (p.world.helpingFriend) releaseFriendWork(s, id);
    for (const other of Object.values(s.ecs.planner)) {
      if (other.world.capturedBy == id || other.world.capturedAttentionOf == id || other.world.social?.partnerId == id) {
        delete other.world.social;
        other.world.capturedBy = null;
        other.world.capturedAttentionOf = null;
        other.task = null;
        other.plan = null;
      }
    }
  }
  for (const farm of Object.values(s.ecs.farmable || {})) {
    if (farm.claimerId == id) farm.claimerId = null;
    for (const slot of farm.slots) if (slot.workerId == id) delete slot.workerId;
  }
  for (const bed of Object.values(s.ecs.sleepable || {})) bed.occupiers = bed.occupiers.filter(p => p != id);
  for (const manager of Object.values(s.ecs.manager || {})) for (const job of manager.jobs) if (job.assignedId == id) job.assignedId = null;
}
export function acceptTravel(s, tileId) {
  const d = destinationFor(s, tileId);
  if (!d || d.blocked || s.transition || !canReachTask(s, s.ui.playerId, tileId)) return false;
  const id = s.ui.playerId;
  for (const job of [...s.ecs.manager[id].jobs]) cancelTask(s, job.id);
  for (const r of Object.values(s.favours?.requests || {})) cancelFavour(s, r);
  releaseLocalWork(s, id);
  s.ecs.planner[id].task = null;
  s.ecs.planner[id].plan = null;
  s.ecs.planner[id].world = {
    actorId: id,
    ordered: true,
    places: {},
    no_place_for: {},
    feeling: {},
    holding: holdingFor(s, id),
    days: s.days
  };
  enqueueTask(s, {
    key: "travel"
  }, tileId, {
    destination: d.key,
    side: d.side,
    detail: "Walking to " + hexName(d.hex) + " · one season off-map"
  });
  return true;
}
function takeTraveller(s, id) {
  releaseLocalWork(s, id);
  const carried = new Set(s.ecs.holder?.[id]?.held || []);
  for (const [item, p] of Object.entries(s.ecs.possession || {})) if (p.ownerId == id && p.carried) carried.add(item);
  const ids = [id, ...carried],
    entities = {};
  for (const entity of ids) {
    entities[entity] = {};
    for (const [key, component] of Object.entries(s.ecs)) if (component && typeof component == "object" && component[entity]) {
      entities[entity][key] = component[entity];
      // Identity records stay as remote references for family, ownership, news.
      if (entity != id || !IDENTITY.includes(key)) delete component[entity];
    }
    for (const key of Object.keys(s.space)) s.space[key] = s.space[key].filter(i => i != entity);
  }
  delete s.residents[id];
  s.redraws?.push(...ids);
  return {
    id,
    entities,
    knowledge: s.knowledge?.[id],
    homeHouse: s.ecs.household?.[id]?.houseId
  };
}
function putTraveller(s, bundle, point, j) {
  for (const [id, components] of Object.entries(bundle.entities)) for (const [key, value] of Object.entries(components)) (s.ecs[key] ||= {})[id] = value;
  const id = bundle.id;
  s.residents[id] = true;
  Object.assign(s.ecs.spatial[id], point);
  for (const item of Object.keys(bundle.entities).filter(i => i != id)) if (s.ecs.spatial[item]) Object.assign(s.ecs.spatial[item], point);
  if (bundle.knowledge) (s.knowledge ||= {})[id] = bundle.knowledge;
  if (j) references(s, j);
  const old = s.ecs.planner[id],
    ordered = !!s.ecs.playable[id];
  s.ecs.planner[id] = {
    id,
    world: {
      actorId: id,
      ordered,
      no_place_for: {},
      jobs: [],
      places: {},
      feeling: {},
      holding: holdingFor(s, id),
      days: s.days
    }
  };
  // Transfer the independent actor, never somebody else's family planner.
  if (old?.world.profession && s.ecs.workplace?.[old.world.profession.workplaceId]) s.ecs.planner[id].world.profession = old.world.profession;
  s.ecs.manager[id] = {
    id,
    jobs: [],
    ordered
  };
  s.redraws?.push(id);
}
export function enterMap(s, key, bundle, side) {
  const j = s.travel,
    map = j.maps[key];
  for (const field of LOCAL_FIELDS) delete s[field];
  Object.assign(s, map);
  s.days = j.days;
  j.active = key;
  s.world = {
    ...s.world,
    home: Object.fromEntries(key.split(",").map((n, i) => [i ? "y" : "x", +n]))
  };
  references(s, j);
  putTraveller(s, bundle, s.map.entrances[side].campPoint, j);
  s.ecs.manager[bundle.id].jobs = [];
  s.arrivalEntry = s.map.entrances[side];
  // One camp per person and map. A return uses the same camp and its stores.
  s.arrivalCampId = Object.keys(s.ecs.camp || {}).find(id => s.ecs.controllable[id]?.controllerId == bundle.id);
  s.arrivalHomeId = s.map.homeId;
  s.map = {
    ...s.map,
    playerStartTile: {
      ...s.arrivalEntry.hexes[2]
    }
  };
  s.intro = null;
  startIntro(s);
  s.ui.show.selected_person = null;
  s.ui.selected = null;
  recordEvent(s, "arrival", [bundle.id], [], {
    worldHex: key,
    fromWorld: bundle.from
  });
  updateWeather(s, 0, j.seed);
  j.maps[key] = localSnapshot(s);
}
function ageTraveller(s, bundle, season, {
  player = false
} = {}) {
  const transit = {
    ecs: {
      nextId: 1,
      namespace: "transit-" + bundle.id + "-"
    },
    residents: {
      [bundle.id]: true
    },
    days: season * 3,
    peopleSeed: s.peopleSeed,
    opinionThresholds: s.opinionThresholds,
    events: [],
    villages: {},
    knowledge: {},
    social: {
      courtships: {},
      avoidance: {}
    }
  };
  for (const [id, components] of Object.entries(bundle.entities)) for (const [key, value] of Object.entries(components)) (transit.ecs[key] ||= {})[id] = clone(value);
  references(transit, s.travel);
  if (bundle.knowledge) transit.knowledge[bundle.id] = clone(bundle.knowledge);
  const aged = player ? transit : historyStep(transit, season);
  if (player) drift(aged, 72);
  for (const [id, components] of Object.entries(bundle.entities)) for (const key of Object.keys(components)) if (aged.ecs[key]?.[id]) components[key] = aged.ecs[key][id];
  bundle.knowledge = aged.knowledge[bundle.id];
  publish(aged, s.travel);
  return aged;
}
function settleRoadEstate(s, trip, aged) {
  const j = s.travel,
    id = trip.bundle.id,
    heir = heirFor(aged, id),
    home = j.maps[trip.from];
  references(home, j);
  const point = home.map.entrances[trip.side ?? 0]?.campPoint || Hex(home.map.playerStartTile).toPoint();
  putTraveller(home, trip.bundle, point, j);
  delete home.ecs.planner[id];
  delete home.ecs.guest?.[id];
  for (const item of home.ecs.holder[id]?.held || []) if (home.ecs.haulable?.[item]) home.ecs.haulable[item].heldBy = null;
  if (home.ecs.holder[id]) home.ecs.holder[id].held = [];
  for (const item of Object.keys(trip.bundle.entities).filter(i => i != id)) if (home.ecs.possession?.[item]) home.ecs.possession[item].carried = false;
  for (const map of Object.values(j.maps)) {
    references(map, j);
    for (const [item, p] of Object.entries(map.ecs.possession || {})) if (p.ownerId == id) transferPossession(map, item, heir, "inheritance", id);
    for (const [other, c] of Object.entries(map.ecs.controllable || {})) if (c.controllerId == id && other != id) c.controllerId = heir || other;
    repairHouseholds(map);
    publish(map, j);
  }
  delete j.visits[id];
}
export async function completeTravel(s, order) {
  if (s.transition) return;
  s.transition = {
    label: "One season on the road…",
    destination: order.destination
  };
  try {
    const j = s.travel,
      from = j.active,
      id = s.ui.playerId,
      departure = s.days;
    recordEvent(s, "departure", [id], [], {
      fromWorld: from,
      toWorld: order.destination
    });
    s.map = {
      ...s.map,
      homeId: s.ecs.household[id]?.houseId || s.map.homeId
    };
    const bundle = takeTraveller(s, id);
    bundle.from = from;
    ageTraveller(s, bundle, Math.floor((departure + 3) / 3), {
      player: true
    });
    j.maps[from] = localSnapshot(s);
    publish(s, j);
    // Exactly one crossed season; the departed map is now off-screen.
    s.days = departure + 3;
    j.days = s.days;
    await advanceWorldClock(s, {
      travelling: true
    });
    await ensureMap(s, order.destination);
    enterMap(s, order.destination, bundle, (order.side + 3) % 6);
    j.lastJourney = {
      from,
      to: order.destination,
      departure,
      arrival: s.days,
      side: order.side
    };
  } finally {
    s.transition = null;
  }
}

// A visit is motivated by the seeker's actual local pool, without peeking at
// unvisited personalities. Explore adjacent land in seeded order; remember trips.
function journeyIntent(s, id, key, j, season) {
  const p = s.ecs.personable[id],
    kin = s.ecs.kinship?.[id];
  if (!p || p.dead || p.age < 18 || s.ecs.playable?.[id] || kin?.spouse && !s.ecs.personable[kin.spouse]?.dead) return null;
  const visit = j.visits[id];
  if (visit) {
    if (season < visit.arrived + 3) return null;
    if (Object.keys(s.residents).some(b => s.residents[b] && romanticInterest(s, id, b))) return null;
    return {
      to: visit.home,
      returning: true
    };
  }
  if (Object.keys(s.residents).some(b => s.residents[b] && romanticInterest(s, id, b))) return null;
  const here = s.world?.hexes?.find(h => worldKey(h) == key) || j.world.hexes.find(h => worldKey(h) == key);
  const choices = neighbours(here).map((h, side) => ({
    hex: j.world.hexes.find(n => worldKey(n) == worldKey(h)),
    side
  })).filter(n => n.hex && !n.hex.ocean);
  const tried = s.ecs.personable[id].visitedWorlds || [];
  choices.sort((a, b) => Number(tried.includes(worldKey(a.hex))) - Number(tried.includes(worldKey(b.hex))) || hashUnit(key + ":search:" + season + ":" + a.side) - hashUnit(key + ":search:" + season + ":" + b.side));
  return choices[0] && {
    to: worldKey(choices[0].hex),
    side: choices[0].side
  };
}
export function departNpc(s, id, intent, j = s.travel) {
  const from = s.map.worldKey || j.active,
    home = j.visits[id];
  const saved = {
    household: clone(s.ecs.household[id] || {}),
    village: clone(s.ecs.village[id] || {}),
    profession: s.ecs.profession?.[id] && clone(s.ecs.profession[id])
  };
  recordEvent(s, "departure", [id], [], {
    fromWorld: from,
    toWorld: intent.to,
    reason: intent.returning ? "returning home" : "seeking company"
  });
  const bundle = takeTraveller(s, id);
  bundle.from = from;
  const due = s.days + 3;
  j.transit.push({
    bundle,
    from,
    to: intent.to,
    side: intent.side,
    due,
    returning: !!intent.returning,
    home: home || {
      home: from,
      ...saved
    }
  });
  publish(s, j);
}
async function receiveNpcs(s, j) {
  const due = j.transit.filter(t => t.due <= s.days + 1e-9);
  for (const trip of due) {
    const dest = await ensureMap(s, trip.to);
    references(dest, j);
    dest.days = s.days;
    dest.redraws ||= [];
    const id = trip.bundle.id;
    // Social time and the real estate follow the same life-cycle as residents.
    const aged = ageTraveller(s, trip.bundle, j.season);
    if (aged.ecs.personable[id].dead) {
      settleRoadEstate(s, trip, aged);
      continue;
    }
    const side = trip.side == null ? neighbours(s.world.hexes.find(h => worldKey(h) == trip.to)).findIndex(h => worldKey(h) == trip.from) : (trip.side + 3) % 6;
    const entry = dest.map.entrances[side];
    putTraveller(dest, trip.bundle, entry.campPoint, j);
    const visit = trip.home;
    if (trip.returning) {
      dest.ecs.household[id] = {
        ...visit.household
      };
      dest.ecs.village[id] = {
        ...visit.village
      };
      if (visit.profession) (dest.ecs.profession ||= {})[id] = visit.profession;
      delete dest.ecs.guest?.[id];
      delete j.visits[id];
    } else {
      j.visits[id] = {
        ...visit,
        arrived: j.season
      };
      const host = Object.keys(dest.residents).find(other => other != id && !dest.ecs.personable[other].dead && dest.ecs.household[other]?.houseId);
      if (host) {
        (dest.ecs.guest ||= {})[id] = {
          id,
          houseId: dest.ecs.household[host].houseId,
          homeWorld: visit.home
        };
        dest.ecs.household[id] = {
          id,
          houseId: dest.ecs.household[host].houseId
        };
        dest.ecs.village[id] = {
          ...dest.ecs.village[host],
          id
        };
      }
      const p = dest.ecs.personable[id];
      p.visitedWorlds = [...new Set([...(p.visitedWorlds || []), trip.to])];
    }
    if (!trip.returning) delete dest.ecs.profession?.[id];
    repairHouseholds(dest);
    if (trip.to == j.active && !s.transition) {
      Object.assign(dest.ecs.spatial[id], dest.ecs.spatial[entry.tileIds[0]]);
      dest.ecs.planner[id].world.worldArrival = {
        tileId: entry.tileIds[2],
        houseId: dest.ecs.household[id]?.houseId
      };
    }
    recordEvent(dest, trip.returning ? "return" : "world_visit", [id], [], {
      fromWorld: trip.from,
      toWorld: trip.to
    });
    publish(dest, j);
    if (trip.to == j.active && !s.transition) {
      // The active snapshot is the running state; publish only simulation fields.
      for (const field of LOCAL_FIELDS) if (field != "days") s[field] = dest[field];
      s.redraws?.push(...(dest.redraws || []));
    }
  }
  j.transit = j.transit.filter(t => !due.includes(t));
}
export async function advanceWorldClock(s, {
  travelling = false
} = {}) {
  const j = s.travel;
  if (!j) return;
  j.world = s.world;
  j.days = s.days;
  j.maps[j.active] = localSnapshot(s);
  publish(s, j);
  const target = Math.floor(s.days / 3);
  while (j.season < target) {
    const season = ++j.season;
    const start = Object.entries(j.maps).map(([key, map]) => ({
      key,
      roster: Object.keys(map.residents).filter(id => map.residents[id]),
      map
    }));
    // Finish every community's season before resolving the transfer batch.
    for (const row of start) {
      references(row.map, j);
      if (row.key == j.active && !travelling) continue; // socialHour already ran live.
      const next = historyStep(row.map, season);
      next.days = s.days;
      j.maps[row.key] = next;
      row.map = next;
      j.historyCalls.push({
        key: row.key,
        season,
        kind: "away"
      });
      publish(next, j);
    }
    await receiveNpcs(s, j);
    for (const {
      key,
      roster
    } of start) {
      const map = key == j.active && !travelling ? s : j.maps[key];
      references(map, j);
      for (const id of roster) if (map.residents[id] && !j.transit.some(t => t.bundle.id == id)) {
        const visit = j.visits[id];
        if (visit && map.ecs.kinship[id]?.spouse && !map.ecs.personable[map.ecs.kinship[id].spouse]?.dead) {
          recordEvent(map, "world_move", [id], [], {
            fromWorld: visit.home,
            toWorld: key
          });
          delete j.visits[id];
          continue;
        }
        const intent = journeyIntent(map, id, key, j, season);
        if (!intent) continue;
        if (key == j.active && !travelling) {
          const side = intent.side ?? neighbours(s.world.home).findIndex(h => worldKey(h) == intent.to),
            tile = map.map.entrances[side]?.tileIds[0];
          if (tile && canReachTask(map, id, tile)) map.ecs.planner[id].world.worldJourney = {
            ...intent,
            side,
            tileId: tile
          };
        } else departNpc(map, id, intent, j);
      }
      j.maps[key] = localSnapshot(map);
      publish(map, j);
    }
  }
  await receiveNpcs(s, j);
  references(s, j);
}
