import { isAdult, isDependent } from "game/life_stages";
import { attachPeople, updateDirectoryPerson, hydratePeople } from "game/person_storage";
import { bindNewsContext, rememberNewsScopes, indexEventKnowledge } from "game/event_knowledge";
import { refreshPersonIndex } from "game/population_index";
import { runNearbyCourtships } from "game/nearby_courtship";
import { compactMap, summarySeason, buildHistoryMap, restoreDetails } from "game/world_history";
import { recordJourney, routeTile } from "game/settlement_routes";
import { advanceEnvironment } from "game/environment";
import { householdAccess } from "game/playable";
import { Hex } from "game/hex";
import { generateMap } from "game/map";
import { historyStep } from "game/history";
import { startIntro, introActive, CAMP_LAYOUT } from "game/intro";
import { HOP_NARRATIVE } from "game/guidance";
import { newEntities, deleteEntity } from "game/entities";
import { routeCrossing } from "game/geography";
import { DAYS_IN_SEASON, HOUR, season } from "game/time";
import { updateWeather } from "game/weather";
import { cancelLocalTasksForTravel, enqueueTask, canReachTask, cancelTask } from "game/manager";
import { releaseFriendWork } from "game/friend_help";
import { transferPossession, repairHouseholds } from "game/possessions";
import { recordEvent, withEventIndex } from "game/events";
import { romanticInterest, advanceSeason, withSocialIndex, SOCIAL_RATES } from "game/social";
import { drift } from "game/people";
import { hashUnit } from "game/math";
import { prepareDetail, applyPreparedDetail } from "game/hex_detail";
import { finishTransition } from "game/history_scope";
import { destinationFor, worldKey, neighbours, hexName } from "game/travel_geometry";
export { edgeSide, destinationFor, prepareEntrances, hexName, SIDE_NAMES } from "game/travel_geometry";
export const DEPARTURE_POLICY = "Travel cancels unfinished local tasks and favours without a reward. Work and deliveries stay done; borrowed harvest is left here for its household. Land, homes, stores and uncarried belongings stay yours here. Goods in your hands and carried personal possessions travel with you.";
export const TRANSITION_NEEDS = "The journey takes one season. Walking uses a little energy. Eat your own food or Rest before leaving if you need more.";
export { LOCAL_FIELDS } from "game/hex_storage";
import { LOCAL_FIELDS } from "game/hex_storage";
const IDENTITY = ["personable", "personality", "kinship", "relationships", "nameable", "controllable", "household", "village", "playable"];
const clone = value => JSON.parse(JSON.stringify(value));
const holdingFor = (s, id) => Object.fromEntries((s.ecs.holder[id]?.held || []).filter(item => !s.ecs.possession?.[item] && householdAccess(s.ecs, id, item)).map(item => [s.ecs.good[item]?.type, true]));
export function freezeOpinions(s) {
  for (const id of Object.keys(s.ecs.personality||{})) {
    const p = s.ecs.personality[id];
    p.opinionSeed ??= s.peopleSeed;
    if(s.newsModel)p.traveller ??= hashUnit(p.opinionSeed+":traveller:"+id)<SOCIAL_RATES.travellerShare;
    p.opinionThresholds ||= {
      ...s.opinionThresholds
    };
  }
}
export function localSnapshot(s) {
  return Object.fromEntries(LOCAL_FIELDS.filter(k => s[k] !== undefined).map(k => [k, s[k]]));
}
const publishedEvents = new WeakMap();
const referenceEvents = new WeakMap();
const knowledgeCursors = new WeakMap();
const knowledgeSets = new WeakMap();
// Reference imports are ordinary ECS records. During an owned history pass,
// remember each published component head and only copy changed heads again.
const referenceIndexes = new WeakMap();
export function withReferenceIndex(j, transition) {
  if(j.localPeople)return transition();
  if (referenceIndexes.has(j)) return transition();
  const index = { heads: new Map(), maps: new WeakMap(), opinions: new WeakSet(),
    components: Object.fromEntries(IDENTITY.map(key => [key, {}])) };
  index.remember = (id, person) => {
    id = String(id);
    const previous = index.heads.get(id);
    let changed = !previous;
    if (previous) for (const key of IDENTITY) if (previous[key] !== person[key]) { changed = true; break; }
    if (!changed) return previous;
    const head = { ...person };
    index.heads.set(id, head);
    for (const key of IDENTITY) if (head[key]) index.components[key][id] = head[key];
    return head;
  };
  for (const id in j.people) index.remember(id, j.people[id]);
  referenceIndexes.set(j, index);
  return finishTransition(transition, () => referenceIndexes.delete(j));
}

function publish(s, j) {
  if(j.localPeople)bindNewsContext(s,j);
  const catalogue = referenceIndexes.get(j);
  if (!catalogue) freezeOpinions(s);
  const roster = (catalogue || j.localPeople) && s.residents ? Object.keys(s.residents) : Object.keys(s.ecs.personable);
  // Keep the original order of newly published deaths, including people whose
  // ECS reference predates their residence. Estate/event ordering is observable.
  if (catalogue) {
    j.pendingEstates ||= {};
    const deaths = new Set(roster.filter(id => s.ecs.personable[id]?.dead && j.people[id] && !j.estateDone?.[id]));
    if (deaths.size) for (const id in s.ecs.personable) if (deaths.has(id)) j.pendingEstates[id] = true;
  }
  for (const id of roster) if (!s.residents || s.residents[id]) {
    if (catalogue) {
      const p = s.ecs.personality[id];
      if (p && !catalogue.opinions.has(p)) {
        p.opinionSeed ??= s.peopleSeed;
        p.opinionThresholds ||= { ...s.opinionThresholds };
        catalogue.opinions.add(p);
      }
    }
    const existing = j.people[id];
    j.estateDone ||= {};
    j.pendingEstates ||= {};
    if (s.ecs.personable[id].dead) {
      if (!existing) j.estateDone[id] = true; // This community's prehistory already settled its own estates.
      else if (!j.estateDone[id]) j.pendingEstates[id] = true;
    }
    j.people[id] ||= {};
    for (const key of IDENTITY) if (s.ecs[key]?.[id]) j.people[id][key] = s.ecs[key][id];
    catalogue?.remember(id, j.people[id]);
    updateDirectoryPerson(j,id);
    if(j.localPeople)(j.locations ||= {})[id]=s.residents?.[id] ? s.map?.worldKey || j.active : null;
  }
  if (!j.eventOrder) {
    j.eventOrder = Object.fromEntries(Object.keys(j.events).map((id, index) => [id, index]));
    j.nextEventOrder = Object.keys(j.events).length;
  }
  const events=s.events || [];
  const published=j.wholeWorld ? publishedEvents.get(events) || 0 : 0;
  for (let index=published;index<events.length;index++) {
    const e=events[index];
    if (!(e.id in j.events)) j.eventOrder[e.id] = j.nextEventOrder++;
    j.events[e.id] = e;
    if(j.localPeople && e.awareness)indexEventKnowledge(s,e);
  }
  if(j.wholeWorld)publishedEvents.set(events,events.length);
  j.knowledge ||= {};
  for (const id of j.localPeople ? (s.knowledge===j.knowledge ? [] : Object.keys(s.residents||{})) : Object.keys(s.knowledge||{})) {
    if(!s.knowledge?.[id])continue;
    const known = s.knowledge[id];
    if(j.wholeWorld){publishKnowledge(s,j,id,known);continue;}
    const previous = j.knowledge[id];
    if (!previous) {
      j.knowledge[id] = known;
      continue;
    }
    if (previous === known) continue;
    const seen = new Set(previous.events || []),
      extra = (known.events || []).filter(event => !seen.has(event));
    const events = extra.length ? [...(previous.events || []), ...extra] : previous.events;
    j.knowledge[id] = s.residents?.[id] ? {
      ...known,
      events
    } : {
      ...previous,
      events
    };
  }
  for (const [id, v] of Object.entries(s.villages || {})) if (v.houses?.length || !j.villages[id]) j.villages[id] = v;
}
// Called immediately after a resident death is published, before another
// community can reassign its absentee owner's estate as an empty household.
function reconcileEstates(s, j) {
  const deaths = Object.keys(j.pendingEstates || {}).filter(id => !j.estateDone[id]);
  if (!deaths.length) return;
  const dying = new Set(deaths);
  const succession = id => {
    const chain = [];
    while (id && j.people[id]?.personable.dead) {
      const heir = j.people[id].personable.heirId ?? null;
      chain.push({
        from: id,
        to: heir
      });
      id = heir;
    }
    return chain;
  };
  const successor = id => succession(id).at(-1)?.to ?? null;
  const inherit = (view, item, id) => {
    for (const {
      from,
      to
    } of succession(id)) transferPossession(view, item, to, "inheritance", from);
  };
  for (const id of deaths) {
    j.estateDone[id] = true;
    delete j.pendingEstates[id];
  }
  for (const person in j.people) {
    const records = j.people[person];
    if (dying.has(records.controllable?.controllerId) && records.controllable.controllerId != person) {
      const controllerId=successor(records.controllable.controllerId) || person;
      if(j.localPeople)records.controllable.controllerId=controllerId;
      else records.controllable = { ...records.controllable, controllerId };
      referenceIndexes.get(j)?.remember(person, records);
    }
  }
  // Ordinary local deaths are already settled by die(). Scan ownership once,
  // and refresh only maps with an actual outstanding estate. Do not recopy
  // every community's entire reference closure for every death in the batch.
  for (const map of Object.values(j.maps)) {
    const items = [], assets = [];
    for (const id in map.ecs.possession) {
      const p = map.ecs.possession[id];
      if (dying.has(p.ownerId)) items.push([id,p]);
    }
    for (const asset of Object.keys(map.ecs.controllable||{})) {
      const c = map.ecs.controllable[asset];
      if (asset != c.controllerId && dying.has(c.controllerId) && (!map.ecs.personable[asset] || map.residents[asset])) assets.push({asset,c,owner:c.controllerId});
    }
    if (!items.length && !assets.length) continue;
    references(map, j);
    for (const [item, p] of items) inherit(map, item, p.ownerId);
    const houses = {};
    for (const {
      asset,
      c,
      owner
    } of assets) {
      if (map.ecs.building?.[asset]) (houses[owner] ||= []).push(asset);
      c.controllerId = successor(owner) || asset;
    }
    for (const [owner, ids] of Object.entries(houses)) for (const {
      from,
      to
    } of succession(owner)) if (to) recordEvent(map, "inheritance", [from, to], ids);
    repairHouseholds(map);
    publish(map, j);
  }
  for (const trip of j.transit) {
    const affected = Object.entries(trip.bundle.entities).filter(([item, c]) => dying.has(c.possession?.ownerId) || item != c.controllable?.controllerId && dying.has(c.controllable?.controllerId));
    if (!affected.length) continue;
    const map = j.maps[trip.from];
    references(map, j);
    const parcel = {
      ...map,
      ecs: {
        ...map.ecs,
        controllable: {
          ...map.ecs.controllable
        },
        possession: {
          ...map.ecs.possession
        },
        good: {
          ...map.ecs.good
        },
        haulable: {
          ...map.ecs.haulable
        }
      }
    };
    for (const [item, c] of affected) {
      for (const key of ["possession", "good", "controllable", "haulable"]) if (c[key]) parcel.ecs[key][item] = c[key];
      if (dying.has(c.possession?.ownerId)) inherit(parcel, item, c.possession.ownerId);
      if (item != c.controllable?.controllerId && dying.has(c.controllable?.controllerId)) c.controllable.controllerId = successor(c.controllable.controllerId) || item;
    }
    map.events = parcel.events;
    map.knowledge = parcel.knowledge;
    publish(map, j);
  }
}
export { publish as publishCommunity };

export function moveMarriageResidents(s, moves) {
  const j = s.travel, touched = new Set();
  for (const { id, from, to } of moves) {
    const house = from.ecs.household[id].houseId;
    const bundle = takeTraveller(from, id);
    putTraveller(to, bundle, to.ecs.spatial[house], j);
    to.ecs.planner[id].world.moveHome = house;
    delete j.visits[id];
    recordEvent(to, "world_move", [id], [], { fromWorld: from.map.worldKey, toWorld: to.map.worldKey, reason: "marriage", summary: true });
    touched.add(from); touched.add(to);
  }
  for (const map of touched) { repairHouseholds(map); references(map, j); publish(map, j); }
  if (touched.has(j.maps[j.active])) {
    for (const field of LOCAL_FIELDS) if (field !== "days") s[field] = j.maps[j.active][field];
    s.redraws ||= [];
    s.redraws.push(...moves.map(move => move.id));
  }
}

function references(s, j, road = false) {
  if(j.localPeople) {
    attachPeople(s,j);bindNewsContext(s,j);
    return;
  }
  Object.defineProperty(s, "peopleDirectory", {
    value: j.people,
    enumerable: false,
    writable: true,
    configurable: true
  });
  // Import only references this community can actually use, rather than an
  // all-world copy in every map. The authoritative directory retains everyone.
  const residents = Object.keys(s.residents), required = new Set(residents);
  for (const id of residents) {
    const person = j.people[id],
      kin = person?.kinship || s.ecs.kinship[id];
    for (const other of kin?.parents || []) if (other) required.add(other);
    for (const other of kin?.children || []) if (other) required.add(other);
    if (kin?.spouse) required.add(kin.spouse);
    for (const other in s.ecs.relationships[id]?.known) if (other) required.add(other);
    for (const other in s.knowledge?.[id]?.people) if (other) required.add(other);
  }
  for (const id in s.ecs.controllable) {
    const c = s.ecs.controllable[id];
    if (j.people[c.controllerId]) required.add(c.controllerId);
  }
  // A multi-source breadth-first walk computes the same two-generation
  // union, without revisiting every shared ancestor once per resident.
  let frontier = [...required];
  for (let depth = 0; depth < 2; depth++) {
    const next = [];
    for (const id of frontier) {
      const kin = j.people[id]?.kinship || s.ecs.kinship[id];
      for (const other of [...(kin?.parents || []), ...(kin?.children || []), kin?.spouse]) if (other && !required.has(other)) {
        required.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }
  for (const id in s.ecs.personable) if (!s.residents[id] && !required.has(id)) for (const key of IDENTITY) delete s.ecs[key]?.[id];
  const catalogue = referenceIndexes.get(j);
  let imported = road ? undefined : catalogue?.maps.get(s.ecs);
  if (catalogue && !road && !imported) { imported = new Map(); catalogue.maps.set(s.ecs, imported); }
  const keys = road && catalogue ? ["personable", "controllable"] : IDENTITY;
  const tables = keys.map(key => s.ecs[key]);
  for (const id of required) {
    if (s.residents[id]) { imported?.delete(id); continue; }
    if (!j.people[id]) continue;
    const person = catalogue ? catalogue.heads.get(String(id)) || catalogue.remember(id, j.people[id]) : j.people[id];
    // Family moves can replace an absent dependent's local home records.
    // Refresh those writable references even when the directory head is stable.
    if (imported?.get(id) === person &&
      (!person.household || s.ecs.household?.[id] === person.household) &&
      (!person.village || s.ecs.village?.[id] === person.village)) continue;
    for (let n = 0; n < keys.length; n++) {
      const value = person[keys[n]];
      if (value) {
        const table = tables[n] ||= s.ecs[keys[n]] = {};
        if (table[id] !== value) table[id] = value;
      }
    }
    imported?.set(id, person);
  }
  if (road && catalogue) for (const key of IDENTITY) if (key !== "personable" && key !== "controllable") {
    // This detached, synchronous road step cannot expose a table or observe a
    // later publication. Native prototypes provide the same foreign lookups
    // without copying every remote relationship table for each traveller.
    Object.setPrototypeOf(s.ecs[key] ||= {}, catalogue.components[key]);
  }
  if (imported) for (const id of imported.keys()) if (!required.has(id)) imported.delete(id);
  s.knowledge ||= {};
  for (const id of residents) if (j.knowledge?.[id]) {
    const local=s.knowledge[id] || {},global=j.knowledge[id];
    if(j.wholeWorld){if(local!==global)publishKnowledge(s,j,id,local);continue;}
    const seen=new Set(global.events || []);
    s.knowledge[id]={...global,...local,events:[...(global.events || []),...(local.events || []).filter(event=>!seen.has(event))]};
  }
  // Events retain globally unique IDs. Knowledge remains with its observer.
  if(j.wholeWorld)importLearnedEvents(s,j);
  else {
    const learned = new Set(Object.keys(s.residents).flatMap(id => s.knowledge?.[id]?.events || []));
    const own = new Set((s.events || []).map(e => e.id));
    const incoming = [...learned].filter(id => !own.has(id) && j.events[id]).sort((a, b) => j.eventOrder[a] - j.eventOrder[b]);
    if (incoming.length) s.events = [...(s.events || []), ...incoming.map(id => j.events[id])];
  }
  if (!j.wholeWorld) s.villages = {
    ...Object.fromEntries(Object.entries(j.villages).map(([id, v]) => [id, {
      ...v,
      houses: [],
      sharedPlaces: []
    }])),
    ...s.villages
  };
}
// New worlds own their summary graph. Merge only newly appended knowledge,
// retaining the global order and the current resident's disclosure metadata.
function publishKnowledge(s,j,id,known) {
  const previous=j.knowledge[id];
  if(!previous || previous===known){j.knowledge[id]=known;return;}
  const base=previous.events ||= [],heard=known.events || [];
  let index=knowledgeSets.get(base);
  if(!index){index={seen:new Set(),length:0};knowledgeSets.set(base,index);}
  for(let n=index.length;n<base.length;n++)index.seen.add(base[n]);
  for(let n=knowledgeCursors.get(heard)||0;n<heard.length;n++)if(!index.seen.has(heard[n])){base.push(heard[n]);index.seen.add(heard[n]);}
  knowledgeCursors.set(heard,heard.length);index.length=base.length;
  if(s.residents?.[id])j.knowledge[id]=s.knowledge[id]={...previous,...known,events:base};
}
// Each event and learned-event array is append-only during an owned world step.
// Cursors avoid rescanning old history. Replaced arrays get a fresh index.
function importLearnedEvents(s,j) {
  const events=s.events ||= [];
  let index=referenceEvents.get(events);
  if(!index){index={own:new Set(),length:0,readers:new WeakMap(),waiting:new Set()};referenceEvents.set(events,index);}
  for(let n=index.length;n<events.length;n++)index.own.add(events[n].id);
  const incoming=new Set();
  const consider=id=>{if(index.own.has(id))return;if(j.events[id]){incoming.add(id);index.waiting.delete(id);}else index.waiting.add(id);};
  for(const id of [...index.waiting])consider(id);
  for(const resident of Object.keys(s.residents)) {
    const learned=s.knowledge?.[resident]?.events;
    if(!learned)continue;
    const from=index.readers.get(learned)||0;
    for(let n=from;n<learned.length;n++)consider(learned[n]);
    index.readers.set(learned,learned.length);
  }
  for(const id of [...incoming].sort((a,b)=>j.eventOrder[a]-j.eventOrder[b])){events.push(j.events[id]);index.own.add(id);}
  index.length=events.length;
}
export function initialiseTravel(s, seed) {
  freezeOpinions(s);
  s.needsUpdatedAt = s.days;
  s.residents = Object.fromEntries(Object.keys(s.ecs.personable).map(id => [id, true]));
  const key = worldKey(s.world.home),
    season = Math.floor(s.days / DAYS_IN_SEASON);
  s.travel = {
    seed,
    active: key,
    season,
    maps: {},
    people: {},
    knowledge: {},
    events: {},
    villages: {},
    transit: [],
    visits: {},
    historyCalls: []
  };
  s.travel.routeHistory=(s.settlement?.journeys || []).filter(j=>j.borderKey && !j.imported);
  s.travel.sealedBorders=Object.fromEntries(Object.values(s.map.entrances || {}).map(e=>[e.key,key]));
  if(s.settlement)s.settlement.observedAt=s.days;
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
export async function ensureMap(s, key, progress, options) {
  const j = s.travel;
  if (j.maps[key]?.compact) {
    const summary=j.maps[key], hex=s.world.hexes.find(h=>worldKey(h)===key);
    const stored=j.hexRecords?.[key] && await s.persistence?.readHex(j.hexRecords[key]);
    const update=progress || (async(label,value)=>{if(s.transition)await s.ui?.actions?.progress_update?.(label,.15+.75*value);});
    let map;
    if(stored)hydratePeople(stored,j);
    if (stored) map = stored.unopenedDetail ? applyPreparedDetail(s, key, stored, summary) : restoreDetails(stored, summary);
    else if ((s.worldHistory?.detailOrigins || j.detailRecipes) && (key !== j.active || s.ui.playerId)) {
      const prepared = await prepareDetail(s, key, update, options);
      map = applyPreparedDetail(s, key, prepared, summary);
      delete j.preparedMaps[key];
    } else map = await buildHistoryMap(s,hex,summary,update,options);
    delete map.unopenedDetail;
    j.maps[key]=map;
    if(j.localPeople){publish(map,j);references(map,j);}
    return map;
  }
  if (j.maps[key]) return j.maps[key];
  const hex = s.world.hexes.find(h => worldKey(h) == key);
  if (!hex || hex.ocean) throw new Error("Cannot enter " + key);
  const fresh = emptyWorld(),
    seed = Math.floor(hashUnit(j.seed + ":hex:" + key) * 4294967296);
  fresh.ecs.namespace = "w" + hex.x + "_" + hex.y + "-";
  const started = performance.now();
  const result = await generateMap(fresh, seed, async (label, value) => {
    if (s.transition && s.ui?.actions?.progress_update) await s.ui.actions.progress_update(label, .15 + .75 * value);
  }, {
    world: s.world,
    hex,
    noPlayer: true,
    worldSeed: j.seed,
    routeHistory: j.routeHistory || [],
    sealedBorders: Object.keys(j.sealedBorders || {})
  });
  fresh.map = result.map;
  const knownTrips=new Set((j.routeHistory || []).map(t=>t.key));
  j.routeHistory ||= [];
  for(const trip of fresh.settlement?.journeys || [])if(trip.borderKey && !trip.imported && !knownTrips.has(trip.key))j.routeHistory.push(trip);
  j.sealedBorders ||= {};
  for(const entry of Object.values(fresh.map.entrances))j.sealedBorders[entry.key] ||= key;
  if(fresh.settlement)fresh.settlement.observedAt=s.days;
  fresh.residents = Object.fromEntries(Object.keys(fresh.ecs.personable).map(id => [id, true]));
  freezeOpinions(fresh);
  // A never-visited hex has its own deterministic prehistory, followed by all
  // elapsed global seasons, irrespective of its eventual first visitor.
  for (let season = 1; season <= j.season; season++) {
    if (s.transition) await s.ui?.actions?.progress_update?.("Catching up with the passing seasons: " + season + " of " + j.season, .9 + .05 * (season - 1) / j.season);
    const next = historyStep(fresh, season);
    Object.assign(fresh, next);
    advanceEnvironment(fresh,season*DAYS_IN_SEASON,j.seed);
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
// A route reads coarse land/pass data only. It never generates detailed maps.
export function journeyRoute(s, destination) {
  const start = s.travel.active, hexes = new Map(s.world.hexes.map(h => [worldKey(h), h]));
  if (!hexes.has(destination) || hexes.get(destination).ocean) return null;
  const queue = [start], previous = new Map([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    if (key == destination) {
      const route = [];
      for (let at = key; at != null; at = previous.get(at)) route.unshift(at);
      return route;
    }
    for (const [side, next] of neighbours(hexes.get(key)).entries()) {
      const to = worldKey(next);
      if (previous.has(to) || !hexes.has(to) || hexes.get(to).ocean) continue;
      const map = key == start ? s.map : s.travel.maps[key]?.map;
      if (map?.entrances && !map.entrances[side]) continue;
      if (!map && s.world.landSeed && !routeCrossing({ ...s.world, home: hexes.get(key) }, side)) continue;
      previous.set(to, key); queue.push(to);
    }
  }
  return null;
}
export const journeyText = journey => {
  const n = journey?.route?.length || 0;
  return n + (n == 1 ? " season remains" : " seasons remain");
};
function packJourneyCamp(s, journey) {
  if (!journey?.campId) return;
  const planner = s.ecs.planner[s.ui.playerId];
  delete planner.world.journeyCamp;
  delete planner.world.fireHome;delete planner.world.byFire;
  delete planner.world.places.sleep;
  // Packing runs before planners at dawn. Finish a full night's forced rest
  // here so the interrupted sleep does not send a rested traveller home again.
  if (planner.world.sleepHours >= 6) {
    delete planner.world.forcedRest;
    delete s.ecs.personable[s.ui.playerId].collapsed;
  }
  delete planner.world.sleepStart;
  delete planner.world.sleepHours;
  planner.task = null; planner.plan = null;
  if (s.ecs.camp?.[journey.campId]) deleteEntity(s, journey.campId);
  delete journey.campId;
}
export function stopJourney(s) {
  const journey = s.travel?.journey;
  if (!journey || s.transition) return;
  // Keep the bedroll available if the player stops for the night. It becomes
  // their ordinary camp for resting in this hex.
  const planner = s.ecs.planner[s.ui.playerId];
  if(journey.campId)planner.world.restCamp=planner.world.restHome=planner.world.restBed=journey.campId;
  delete planner.world.journeyCamp;
  delete planner.world.fireHome;delete planner.world.byFire;
  for (const job of [...s.ecs.manager[s.ui.playerId].jobs]) if (job.job.key == "travel") cancelTask(s, job.id);
  s.travel.journey = null;
}
function queueJourneyHop(s) {
  const journey = s.travel.journey;
  const side = neighbours(s.world.home).findIndex(h => worldKey(h) == journey.route[0]);
  const tile = s.map.entrances?.[side]?.tileIds[0];
  if (!tile || !queueTravel(s, tile)) { journey.paused = true; return false; }
  journey.orderId = s.ecs.manager[s.ui.playerId].jobs.find(j => j.job.key == "travel")?.id;
  return true;
}
export function planJourney(s, destination) {
  if (!s.travel || s.transition || s.worldBusy || introActive(s)) return false;
  const route = journeyRoute(s, destination);
  if (!route || route.length < 2) return false;
  const side = neighbours(s.world.home).findIndex(h => worldKey(h) == route[1]);
  const tile = s.map.entrances?.[side]?.tileIds[0];
  if (!tile || !canReachTask(s, s.ui.playerId, tile) || s.ecs.personable[s.ui.playerId]?.dead) return false;
  packJourneyCamp(s, s.travel.journey);
  s.travel.journey = { actorId: s.ui.playerId, route: route.slice(1), destination };
  return queueJourneyHop(s);
}
// Called before planners, including after restore. Arrival hands the next walk
// back to the same ordered HTN queue; no middle hex is skipped.
export function updateJourney(s) {
  const journey = s.travel?.journey;
  if (!journey || s.transition || introActive(s)) return;
  if (journey.actorId != s.ui.playerId || s.ecs.personable[s.ui.playerId]?.dead) { s.travel.journey = null; return; }
  const job = s.ecs.manager[s.ui.playerId].jobs.find(j => j.job.key == "travel");
  if (journey.orderId && !job) { stopJourney(s); return; }
  if (!journey.orderId && !journey.paused) queueJourneyHop(s);
  if (journey.paused) return;
  const hour = s.days % 1 * 24, dark = hour >= 18 || hour < 6;
  const id = s.ui.playerId, planner = s.ecs.planner[id], point = s.ecs.spatial[id];
  const waking=!dark && (planner.world.sleepHours>=6 || planner.world.sleepDawn!=null && s.days>=planner.world.sleepDawn);
  const refuelled=s.ecs.personable[id].energy>0 && !planner.world.forcedRest &&
    !["sleep","eat_food"].includes(planner.task?.[0]) && !["rest","eat_food"].includes(planner.world.currentJob);
  if(journey.campId && (waking || refuelled)) {packJourneyCamp(s,journey);return;}
  if (journey.campId) return;
  if(!(s.ecs.personable[id].energy<=0) && !planner.world.forcedRest)return;
  if(s.chat?.active || planner.world.capturedBy || planner.world.capturedAttentionOf)return;
  // Finish an actual edge crossing before attempting to camp off the nav mesh.
  if (planner.task?.[0] == "leave_edge") return;
  releaseLocalWork(s, id);
  if (job) job.assignedId = null;
  planner.task = null; planner.plan = null; planner.world.currentJob = null;
  const [camp] = newEntities(s, [{ spatial: { x: point.x, y: point.y, immovable: true },
    nameable: { nickname: "Journey camp" }, camp: { bundle: { ...CAMP_LAYOUT.bundle }, journey: true },
    sleepable: { capacity: 1, level: 0, occupiers: [] }, controllable: { controllerId: id }, village: { villageId: null } }]);
  journey.campId = camp;
  planner.world.places.sleep = camp;
  planner.world.journeyCamp = true;
  planner.world.fireHome = camp;planner.world.energyEmpty=true;
  delete planner.world.duskHome;
  s.redraws.push(camp, id);
}
export function acceptTravel(s, tileId) {
  const d = destinationFor(s, tileId);
  if (!d || d.blocked || s.transition || s.worldBusy || introActive(s) || s.ecs.personable[s.ui.playerId]?.dead || !canReachTask(s, s.ui.playerId, tileId)) return false;
  packJourneyCamp(s, s.travel.journey);
  s.travel.journey = { actorId: s.ui.playerId, destination: d.key, route: [d.key] };
  const queued = queueTravel(s, tileId);
  s.travel.journey.orderId = s.ecs.manager[s.ui.playerId].jobs.find(j => j.job.key == "travel")?.id;
  return queued;
}
function queueTravel(s, tileId) {
  const d = destinationFor(s, tileId);
  if (s.ecs.personable[s.ui.playerId]?.dead || !d || d.blocked || s.transition || !canReachTask(s, s.ui.playerId, tileId)) return false;
  const id = s.ui.playerId;
  delete s.ecs.personable[id].pendingJourney;
  cancelLocalTasksForTravel(s);
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
    detail: "Walking to the edge for " + hexName(d.hex,s.world.home) + " · " + journeyText(s.travel.journey)
  });
  return true;
}
function takeTraveller(s, id) {
  rememberNewsScopes(s,id);
  releaseLocalWork(s, id);
  const playable = s.ecs.playable?.[id];
  if (playable) playable.homesByMap={...playable.homesByMap,[s.map.worldKey || worldKey(s.world.home)]:s.ecs.household?.[id]?.houseId};
  if (playable) playable.knownByMap = {
    ...playable.knownByMap,
    [s.map.worldKey || worldKey(s.world.home)]: playable.known
  };
  const carried = new Set(s.ecs.holder?.[id]?.held || []);
  for (const [item, p] of Object.entries(s.ecs.possession || {})) if (p.ownerId == id && p.carried) carried.add(item);
  const ids = [id, ...carried],
    entities = {};
  for (const entity of ids) {
    entities[entity] = {};
    for (const [key, component] of Object.entries(s.ecs)) if (component && typeof component == "object" && component[entity]) {
      entities[entity][key] = component[entity];
      // Identity records stay as remote references for family, ownership, news.
      if (entity != id || !IDENTITY.includes(key) || s.travel?.localPeople || s.newsContext?.localPeople) delete component[entity];
    }
    for (const key of Object.keys(s.space)) s.space[key] = s.space[key].filter(i => i != entity);
  }
  delete s.residents[id];
  refreshPersonIndex(s,id);
  s.redraws?.push(...ids);
  const chatPairs={};
  for(const [key,record] of Object.entries(s.chat?.pairs||{}))if(record.actorId==id||record.npcId==id) {
    chatPairs[key]=record;
    delete s.chat.pairs[key];
  }
  return {
    id,
    entities,
    knowledge: s.knowledge?.[id],
    chatPairs,
    homeHouse: s.ecs.household?.[id]?.houseId
  };
}
function putTraveller(s, bundle, point, j) {
  for (const [id, components] of Object.entries(bundle.entities)) for (const [key, value] of Object.entries(components)) (s.ecs[key] ||= {})[id] = value;
  const id = bundle.id;
  s.residents[id] = true;
  if(j?.localPeople)(j.locations ||= {})[id]=s.map?.worldKey || j.active;
  const playable = s.ecs.playable?.[id];
  if (playable) playable.known = playable.knownByMap?.[s.map.worldKey || worldKey(s.world.home)] || [];
  Object.assign(s.ecs.spatial[id], point);
  for (const item of Object.keys(bundle.entities).filter(i => i != id)) if (s.ecs.spatial[item]) Object.assign(s.ecs.spatial[item], point);
  if (bundle.knowledge) (s.knowledge ||= {})[id] = bundle.knowledge;
  if(Object.keys(bundle.chatPairs||{}).length) {
    s.chat ||= {version:1,pairs:{}};
    Object.assign(s.chat.pairs,bundle.chatPairs);
  }
  if (j) {
    const queue = Object.keys(bundle.entities).map(id => s.ecs.controllable[id]?.controllerId).filter(Boolean),
      seen = new Set();
    for (const id of queue) if (!seen.has(id)) {
      seen.add(id);
      const records = j.people[id];
      if (records && !s.residents[id]) for (const [key, value] of Object.entries(records)) (s.ecs[key] ||= {})[id] = value;
      const controller = s.ecs.controllable[id]?.controllerId;
      if (controller && controller != id) queue.push(controller);
    }
  }
  s.ecs.planner ||= {};s.ecs.manager ||= {};
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
  refreshPersonIndex(s,id);
  s.redraws?.push(id);
}
function clearMapDialogs(s) {
  s.ui.resourceOrder = null;
  s.ui.customsResult = null;
  s.ui.talkResult = null;
  s.ui.show.selected_person = null;
  s.ui.familyPersonId = null;
  s.ui.selected = null;
}
export function enterMap(s, key, bundle, side) {
  clearMapDialogs(s);
  const j = s.travel,
    map = j.maps[key];
  for (const field of LOCAL_FIELDS) delete s[field];
  Object.assign(s, map);
  s.days = j.days;
  j.active = key;
  delete j.unopenedHexes?.[key];
  s.world = {
    ...s.world,
    home: Object.fromEntries(key.split(",").map((n, i) => [i ? "y" : "x", +n]))
  };
  putTraveller(s, bundle, s.map.entrances[side].campPoint, j);
  references(s, j);
  s.ecs.manager[bundle.id].jobs = [];
  s.arrivalEntry = s.map.entrances[side];
  // One camp per person and map. A return uses the same camp and its stores.
  s.arrivalCampId = Object.keys(s.ecs.camp || {}).find(id => s.ecs.controllable[id]?.controllerId == bundle.id);
  const remembered=s.ecs.playable[bundle.id]?.homesByMap?.[key];
  s.arrivalHomeId = remembered && s.ecs.spatial[remembered] ? remembered : null;
  s.map = {
    ...s.map,
    playerStartTile: {
      ...s.arrivalEntry.hexes[2]
    }
  };
  s.intro = null;
  startIntro(s, { narrative: HOP_NARRATIVE });
  s.ui.show.selected_person = null;
  s.ui.familyPersonId = null;
  s.ui.selected = null;
  recordEvent(s, "arrival", [bundle.id], [], {
    worldHex: key,
    fromWorld: bundle.from
  });
  if (!j.wholeWorld) advanceEnvironment(s,j.days,j.seed);
  else s.environmentUpdatedAt=s.needsUpdatedAt=s.days;
  updateWeather(s, 0, j.seed);
  j.maps[key] = localSnapshot(s);
}
function ageTraveller(s, bundle, season) {
  const transit = {
    ecs: {
      nextId: 1,
      namespace: "transit-" + bundle.id + "-"
    },
    residents: {
      [bundle.id]: true
    },
    days: season * DAYS_IN_SEASON,
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
  if(s.newsModel)transit.newsModel=s.newsModel;
  references(transit, s.travel, true);
  if(s.newsModel)transit.newsModel=s.newsModel;
  if (bundle.knowledge) transit.knowledge[bundle.id] = s.newsModel ? bundle.knowledge : clone(bundle.knowledge);
  if(Object.keys(bundle.chatPairs||{}).length)transit.chat={version:1,pairs:clone(bundle.chatPairs)};
  let aged;
  if (s.travel.wholeWorld) {
    // The bundle is already a private copy. On the road there is no map,
    // household construction or second resident to marry. Run the very same
    // drift and demographic rules without historyStep's second copy of every
    // remote person's entire relationship list. Death can reassign a remote
    // dependent's controller, so isolate those small records too.
    for (const id of Object.keys(transit.ecs.controllable||{})) if (!bundle.entities[id]) transit.ecs.controllable[id] = { ...transit.ecs.controllable[id] };
    drift(transit, 24 * DAYS_IN_SEASON);
    advanceSeason(transit, season, true);
    aged = transit;
  } else aged = historyStep(transit, season);
  for (const [id, components] of Object.entries(bundle.entities)) for (const key of Object.keys(components)) if (aged.ecs[key]?.[id]) components[key] = aged.ecs[key][id];
  bundle.knowledge = aged.knowledge[bundle.id];
  if(aged.chat)bundle.chatPairs=aged.chat.pairs;
  publish(aged, s.travel);
  return aged;
}
function settleRoadEstate(s, trip) {
  const j = s.travel,
    id = trip.bundle.id,
    home = j.maps[trip.from];
  references(home, j);
  const point = home.map.entrances[trip.side ?? 0]?.campPoint || Hex(home.map.playerStartTile).toPoint();
  putTraveller(home, trip.bundle, point, j);
  delete home.ecs.planner[id];
  delete home.ecs.guest?.[id];
  for (const item of home.ecs.holder[id]?.held || []) if (home.ecs.haulable?.[item]) home.ecs.haulable[item].heldBy = null;
  if (home.ecs.holder[id]) home.ecs.holder[id].held = [];
  for (const item of Object.keys(trip.bundle.entities).filter(i => i != id)) if (home.ecs.possession?.[item]) home.ecs.possession[item].carried = false;
  publish(home, j);
  reconcileEstates(s, j);
  delete j.visits[id];
}
export async function completeTravel(s, order) {
  if (s.transition) return;
  s.transition = {
    label: "One season on the road…",
    destination: order.destination
  };
  try {
    await s.ui?.actions?.progress_update?.("One season on the road", 0);
    const j = s.travel,
      from = j.active,
      id = s.ui.playerId,
      departure = s.days,
      arrival = Math.floor(departure) + DAYS_IN_SEASON + 6 * HOUR;
    recordEvent(s, "departure", [id], [], {
      fromWorld: from,
      toWorld: order.destination
    });
    cancelLocalTasksForTravel(s);
    s.map = {
      ...s.map,
      homeId: s.ecs.household[id]?.houseId || s.map.homeId
    };
    const bundle = takeTraveller(s, id);
    bundle.from = from;
    ageTraveller(s, bundle, Math.floor(arrival / DAYS_IN_SEASON), {
      player: true
    });
    // Keep the actual bundle visible to the same estate lifecycle as NPC cargo
    // throughout the season and any destination generation.
    const trip = { bundle, from, to: order.destination, side: order.side, due: arrival, player: true };
    j.transit.push(trip);
    j.maps[from] = localSnapshot(s);
    publish(s, j);
    // Exactly one crossed season; the departed map is now off-screen.
    s.days = arrival;
    if (s.simulationClock) { s.simulationClock.hour = 0; s.simulationClock.winter = season(arrival) == "winter"; }
    j.days = s.days;
    await advanceWorldClock(s, {
      travelling: true
    });
    if(bundle.entities[id].personable.dead) {
      settleRoadEstate(s,trip);
      activateResidentMap(s,from);
      j.transit=j.transit.filter(t=>t!=trip);
      return;
    }
    await s.ui?.actions?.progress_update?.(j.maps[order.destination] ? "Opening the familiar lands" : "Preparing the lands ahead", .15);
    await ensureMap(s, order.destination);
    // Reference-only visitors become physical only once the player opens this map.
    await receiveNpcs(s, j);
    await s.ui?.actions?.progress_update?.("Arriving at the edge of the region", .95);
    enterMap(s, order.destination, bundle, (order.side + 3) % 6);
    j.transit = j.transit.filter(t => t != trip);
    if (j.journey?.actorId == id) {
      if (j.journey.route[0] == order.destination) j.journey.route.shift();
      delete j.journey.orderId;
      if (!j.journey.route.length) j.journey = null;
    }
    j.lastJourney = {
      from,
      to: order.destination,
      departure,
      arrival: s.days,
      side: order.side
    };
    await evictAwayMaps(s);
  } finally {
    s.transition = null;
  }
}

// Mutual interest is symmetric. During this departure batch, someone with a
// prospect stays, so a departure cannot remove anybody else's viable prospect.
// Evaluate unordered adult pairs once, retaining the existing romance rule.
export function viableResidents(s) {
  const e = s.ecs, prospects = new Set();
  const candidates = Object.keys(s.residents).filter(id => {
    const p = e.personable[id], kin = e.kinship?.[id];
    return s.residents[id] && p && !p.dead && isAdult(p.age) && !e.playable?.[id] && kin &&
      (!kin.spouse || !e.personable[kin.spouse] || e.personable[kin.spouse].dead);
  });
  if(s.newsModel) {
    for(const left of candidates.filter(id=>e.personality?.[id]?.traveller || s.newsContext?.visits?.[id]))for(const right of candidates) {
      if(left===right || prospects.has(left))continue;
      if(romanticInterest(s,left,right)){prospects.add(left);prospects.add(right);}
    }
    return prospects;
  }
  for (let a = 0; a < candidates.length; a++) for (let b = a + 1; b < candidates.length; b++) {
    const left = candidates[a], right = candidates[b];
    if (prospects.has(left) && prospects.has(right)) continue;
    if (romanticInterest(s, left, right)) { prospects.add(left); prospects.add(right); }
  }
  return prospects;
}

// A visit is motivated by the seeker's actual local pool, without peeking at
// unvisited personalities. Explore adjacent land in seeded order; remember trips.
function journeyIntent(s, id, key, j, season, prospects) {
  const p = s.ecs.personable[id],
    kin = s.ecs.kinship?.[id];
  if (!p || p.dead || isDependent(p.age) || s.ecs.playable?.[id] || kin?.spouse && !s.ecs.personable[kin.spouse]?.dead) return null;
  const visit = j.visits[id];
  if (visit) {
    if (season < visit.arrived + 3) return null;
    if (prospects ? prospects.has(id) : Object.keys(s.residents).some(b => s.residents[b] && romanticInterest(s, id, b))) return null;
    return {
      to: visit.home,
      returning: true
    };
  }
  if(j.localPeople && !s.ecs.personality?.[id]?.traveller)return null;
  if (prospects ? prospects.has(id) : Object.keys(s.residents).some(b => s.residents[b] && romanticInterest(s, id, b))) return null;
  const here = s.world?.hexes?.find(h => worldKey(h) == key) || j.world.hexes.find(h => worldKey(h) == key);
  const choices = neighbours(here).map((h, side) => ({
    hex: j.world.hexes.find(n => worldKey(n) == worldKey(h)),
    side
  })).filter(n => n.hex && !n.hex.ocean && (!s.map.entrances || s.map.entrances[n.side]));
  const tried = s.ecs.personable[id].visitedWorlds || [];
  choices.sort((a, b) => Number(tried.includes(worldKey(a.hex))) - Number(tried.includes(worldKey(b.hex))) || hashUnit(key + ":search:" + season + ":" + a.side) - hashUnit(key + ":search:" + season + ":" + b.side));
  return choices[0] && {
    to: worldKey(choices[0].hex),
    side: choices[0].side
  };
}
export function departNpc(s, id, intent, j = s.travel) {
  if (!s.residents[id] || !s.ecs.spatial[id] || s.ecs.personable[id]?.dead || j.transit.some(t => t.bundle.id == id)) return false;
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
  const side=intent.side ?? neighbours(j.world?.hexes.find(h=>worldKey(h)==from) || s.world.home).findIndex(h=>worldKey(h)==intent.to);
  const entry=s.map.entrances?.[side];
  if(entry && s.settlement)recordJourney(s,{key:"departure:"+id+":"+s.days,people:[id],from:routeTile(s,s.ecs.spatial[id]),to:entry.tileIds[0],reason:intent.returning?"returning home":"seeking company",borderKey:entry.key,count:1});
  const bundle = takeTraveller(s, id);
  repairHouseholds(s);
  bundle.from = from;
  const due = s.days + DAYS_IN_SEASON;
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
  const due = j.transit.filter(t => !t.player && (t.due <= s.days + 1e-9 || t.referenceVisit)),
    touched = new Map(), finished = new Set();
  for (const trip of due) {
    const id = trip.bundle.id;
    // Social time and the real estate follow the same life-cycle as residents.
    if (trip.agedSeason != j.season) {
      ageTraveller(s, trip.bundle, j.season);
      trip.agedSeason = j.season;
    }
    if (trip.bundle.entities[id].personable.dead) {
      finished.add(trip);
      settleRoadEstate(s, trip);
      continue;
    }
    // An autonomous visit must not construct terrain or run local prehistory.
    // Keep the actual person/cargo as a reference visit for three seasons.
    if (!j.maps[trip.to] && !trip.returning) {
      if (!trip.referenceVisit) {
        trip.referenceVisit = true;
        trip.arrived = j.season;
        trip.returnAt = trip.due + 3 * DAYS_IN_SEASON;
        trip.due = trip.returnAt;
        const p = trip.bundle.entities[id].personable;
        p.visitedWorlds = [...new Set([...(p.visitedWorlds || []), trip.to])];
        recordEvent(j.maps[trip.from], "world_visit", [id], [], { fromWorld: trip.from, toWorld: trip.to });
        publish(j.maps[trip.from], j);
      }
      if (s.days + 1e-9 >= trip.returnAt) {
        trip.visitWorld = trip.to;
        trip.to = trip.home.home;
        trip.returning = true;
        trip.referenceVisit = false;
        trip.due = trip.returnAt + DAYS_IN_SEASON;
      }
      continue;
    }
    const dest = j.maps[trip.to];
    finished.add(trip);
    dest.days = s.days;
    dest.redraws ||= [];
    touched.set(trip.to, dest);
    if (!dest.residents[id]) for (const key of IDENTITY) {
      const value = trip.bundle.entities[id][key];
      if (value) (dest.ecs[key] ||= {})[id] = value;
    }
    const side = trip.visitWorld ? trip.side : trip.side == null ? neighbours(s.world.hexes.find(h => worldKey(h) == trip.to)).findIndex(h => worldKey(h) == (trip.visitWorld || trip.from)) : (trip.side + 3) % 6;
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
        arrived: trip.arrived ?? j.season
      };
      const host = Object.keys(dest.residents).find(other => other != id && !dest.ecs.personable[other].dead && dest.ecs.household[other]?.houseId && (!j.wholeWorld || dest.ecs.building?.[dest.ecs.household[other].houseId] || dest.ecs.shelter?.[dest.ecs.household[other].houseId]?.stage==="house"));
      if(j.wholeWorld && !host) {
        (dest.ecs.guest ||= {})[id]={id,houseId:null,homeWorld:visit.home};
        dest.ecs.household[id]={id,houseId:null};
        dest.ecs.village[id]={id,villageId:null};
      }
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
          ...dest.ecs.village[id],
          villageId: dest.ecs.village[host]?.villageId,
          id
        };
      }
      const p = dest.ecs.personable[id];
      p.visitedWorlds = [...new Set([...(p.visitedWorlds || []), trip.to])];
    }
    if (!trip.returning) delete dest.ecs.profession?.[id];
    if(trip.to!=j.active || s.transition) {
      const home=dest.ecs.household[id]?.houseId;
      if(home && dest.settlement)recordJourney(dest,{key:"arrival:"+id+":"+trip.due,people:[id],from:entry.tileIds[0],to:routeTile(dest,dest.ecs.spatial[home]),reason:trip.returning?"returning home":"visiting household",borderKey:entry.key,count:1});
    }
    if (trip.to == j.active && !s.transition) {
      Object.assign(dest.ecs.spatial[id], dest.ecs.spatial[entry.tileIds[0]]);
      dest.ecs.planner[id].world.worldArrival = {
        tileId: entry.tileIds[2],
        houseId: dest.ecs.household[id]?.houseId
      };
    }
    refreshPersonIndex(dest,id);
    recordEvent(dest, trip.returning ? "return" : "world_visit", [id], [], {
      fromWorld: trip.visitWorld || trip.from,
      toWorld: trip.to
    });
  }
  for (const [key, dest] of touched) {
    references(dest, j);
    repairHouseholds(dest);
    publish(dest, j);
    if (key == j.active && !s.transition) {
      // The active snapshot is the running state; publish only simulation fields.
      for (const field of LOCAL_FIELDS) if (field != "days") s[field] = dest[field];
      s.redraws?.push(...(dest.redraws || []));
    }
    // A snapshot never owns a renderer queue. Active arrivals hand their
    // requests to the live state above; away arrivals need no redraw.
    if(j.localPeople)delete dest.redraws;
  }
  j.transit = j.transit.filter(t => !finished.has(t));
}
export async function advanceWorldClock(s, {
  travelling = false
} = {}) {
  const j = s.travel;
  if (!j) return;
  if (j.wholeWorld && !j.localPeople && s.transition && !referenceIndexes.has(j)) return withReferenceIndex(j, () => advanceWorldClock(s, { travelling }));
  j.world = s.world;
  j.days = s.days;
  j.maps[j.active] = localSnapshot(s);
  publish(s, j);
  reconcileEstates(s, j);
  const target = Math.floor(s.days / DAYS_IN_SEASON);
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
      if (s.transition) await s.ui?.actions?.progress_update?.("News from the neighbouring communities", .05 + .1 * start.indexOf(row) / start.length);
      if (j.wholeWorld) {
        const next=row.map.compact ? row.map : compactMap(row.map);
        if(next!==row.map)references(next,j);
        summarySeason(next,season,!!row.map.compact);
        next.days=s.days;
        j.maps[row.key]=row.map.compact ? next : restoreDetails(row.map,next);row.map=j.maps[row.key];
        publish(row.map,j);reconcileEstates(s,j);
        continue;
      }
      const next = historyStep(row.map, season);
      // Snapshot records changed by hourly ecology must remain independent.
      for (const component of ["tree","forageable","good"]) next.ecs[component] = Object.fromEntries(
        Object.entries(next.ecs[component] || {}).map(([id,value])=>[id,{...value}]));
      next.ecs.walkable = Object.fromEntries(Object.entries(next.ecs.walkable || {}).map(([id,value])=>[id,{...value,worn:{...value.worn}}]));
      next.snow = {...next.snow};
      next.space = Object.fromEntries(Object.entries(next.space).map(([key,ids])=>[key,[...ids]]));
      next.world = {...s.world,home:Object.fromEntries(row.key.split(",").map((n,i)=>[i?"y":"x",+n]))};
      advanceEnvironment(next,season*DAYS_IN_SEASON,j.seed);
      delete next.world;
      next.days = s.days;
      j.maps[row.key] = next;
      row.map = next;
      j.historyCalls.push({
        key: row.key,
        season,
        kind: "away"
      });
      publish(next, j);
      reconcileEstates(s, j);
    }
    runNearbyCourtships(s, season);
    await receiveNpcs(s, j);
    reconcileEstates(s, j);
    for (const {
      key,
      roster
    } of start) {
      const map = key == j.active && !travelling ? s : j.maps[key];
      references(map, j);
      withSocialIndex(map,()=>withEventIndex(map,()=>{
        const prospects = j.wholeWorld ? viableResidents(map) : null;
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
          const intent = journeyIntent(map, id, key, j, season, prospects);
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
      }));
      if(j.wholeWorld && map.compact) {
        for(const component of ["planner","manager","traits","attributes"])delete map.ecs[component];
        if(j.localPeople)delete map.redraws;
        j.maps[key]=map;
      } else j.maps[key]=localSnapshot(map);
      publish(map, j);
    }
  }
  await receiveNpcs(s, j);
  reconcileEstates(s, j);
  references(s, j);
}

// A control handover activates an existing community in place. It is not travel:
// no entry route, transit bundle, relocation or additional seasonal step.
export function activateResidentMap(s, key) {
  clearMapDialogs(s);
  const j=s.travel;
  if (key != j.active) j.maps[j.active]=localSnapshot(s);
  const map=j.maps[key];
  for(const field of LOCAL_FIELDS)delete s[field];
  Object.assign(s,map);
  s.days=j.days;
  j.active=key;
  delete j.unopenedHexes?.[key];
  s.world={...s.world,home:Object.fromEntries(key.split(",").map((n,i)=>[i?"y":"x",+n]))};
  references(s,j);
  s.redraws=Object.keys(s.ecs.spatial);
  updateWeather(s,0,j.seed);
}
export async function returnSuccessorFromRoad(s,id) {
  const j=s.travel,trip=j.transit.find(t=>t.bundle.id==id);
  if(!trip)return null;
  const home=j.maps[trip.from];
  references(home,j);
  const original=trip.bundle.entities[id].spatial;
  const onMap=(home.space[Hex().fromPoint(original)]||[]).some(tile=>home.ecs.walkable[tile]);
  const entry=home.map.entrances[trip.side ?? 0] || Object.values(home.map.entrances)[0];
  const point=onMap ? original : home.ecs.spatial[entry.tileIds[0]] || entry.campPoint;
  putTraveller(home,trip.bundle,point,j);
  home.ecs.personable[id].pendingJourney={to:trip.to,due:trip.due,reason:trip.reason||"visit"};
  j.transit=j.transit.filter(t=>t!=trip);
  publish(home,j);
  return trip.from;
}

// Persist the detailed records and the new world manifest together before
// releasing any away terrain. A failed transaction leaves the details resident.
export async function evictAwayMaps(s) {
  const j=s.travel;
  if(!j?.wholeWorld || !s.persistence?.checkpoint)return;
  const archived=Object.fromEntries(Object.entries(j.maps).filter(([key,map])=>key!==j.active&&!map.compact));
  if(!Object.keys(archived).length)return;
  if(s.persistence.deferCheckpoint) {
    // Keep the real details available for an immediate return or a retry.
    // The save controller submits after the first arrival frame, or on close.
    s.persistence.deferCheckpoint(archived).then(result=>{
      if(!result?.hexRecords)return;
      for(const [key,map] of Object.entries(archived))if(key!==j.active && j.maps[key]===map)j.maps[key]=compactMap(map);
    }).catch(()=>{}); // Autosave reports the error and retains the details.
    return;
  }
  for(const [key,map] of Object.entries(archived))j.maps[key]=compactMap(map);
  try {await s.persistence.checkpoint(archived);}
  catch(error){Object.assign(j.maps,archived);throw error;}
}
