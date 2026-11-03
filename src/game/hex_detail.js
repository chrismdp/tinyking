import { isAdult } from "game/life_stages";
import { compressGame, decompressGame } from "game/save_game";
import { stripPeople, hydratePeople, PERSON_COMPONENTS } from "game/person_storage";
import { buildHistoryMap, restoreDetails } from "game/world_history";
import { neighbours, worldKey } from "game/travel_geometry";

// Keep historical construction inputs, never terrain, in unopened hexes.
// Social rings retain the audience for construction news. Current full bonds
// and learned events are applied when the player opens the hex.
export function captureDetailOrigins(s) {
  const origins = {}, relationships = new WeakMap();
  const constructionBonds = r => {
    if (!relationships.has(r)) relationships.set(r, { id: r.id,
      known: Object.fromEntries(Object.entries(r.known).filter(([, bond]) => bond.ring !== "public").map(([other, bond]) => [other, { ring: bond.ring }])) });
    return relationships.get(r);
  };
  for (const [key, map] of Object.entries(s.travel.maps)) origins[key] = {
    ...map,
    ecs: { ...map.ecs, relationships: Object.fromEntries(Object.entries(map.ecs.relationships).map(([id, r]) => [id, constructionBonds(r)])) },
    events: [], knowledge: {}, social: { lastSeason: 0, courtships: {}, avoidance: {} }, days: .375
  };
  // Clone the complete recipe graph once. Remote component heads shared by
  // communities stay shared here, while all recipes are detached from play.
  // prepareDetail still clones each build's mutable input independently.
  s.worldHistory.detailOrigins = structuredClone(origins);
}

// Completed history becomes fixed construction plans. A plan contains people
// by ID, their house assignments and adult/dead roles needed by the builder.
// Personalities, names, kin, bonds and knowledge remain in the one directory.
export async function releaseHistoryWorkspace(s) {
  const j=s.travel;if(!j.localPeople || !s.worldHistory?.detailOrigins)return;
  j.contents=s.worldHistory.contents;j.detailRecipes={};
  for(const [key,origin] of Object.entries(s.worldHistory.detailOrigins)) {
    const recipe=stripPeople(origin,j),ids=recipe.personIds;
    recipe.construction={homes:Object.fromEntries(ids.map(id=>[id,origin.ecs.household[id]?.houseId])),
      adults:ids.filter(id=>isAdult(origin.ecs.personable[id].age)),dead:ids.filter(id=>origin.ecs.personable[id].dead),
      guests:ids.filter(id=>origin.ecs.guest?.[id]),controllers:Object.fromEntries(ids.map(id=>[id,origin.ecs.controllable[id]?.controllerId]))};
    for(const table of Object.values(recipe.ecs))if(table && typeof table==="object")for(const id of ids)delete table[id];
    const bytes=new Uint8Array(await compressGame(recipe));
    let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    j.detailRecipes[key]=btoa(binary);
    delete s.worldHistory.detailOrigins[key];
  }
  delete s.worldHistory;
}
async function readRecipe(s,key) {
  const j=s.travel,text=atob(j.detailRecipes[key]),bytes=Uint8Array.from(text,c=>c.charCodeAt(0));
  const recipe=await decompressGame(bytes),plan=recipe.construction;
  for(const id of recipe.personIds) {
    const person=structuredClone(j.people[id]);if(!person)throw new Error("Missing construction person "+id);
    for(const component of PERSON_COMPONENTS)if(person[component])(recipe.ecs[component] ||= {})[id]=person[component];
    recipe.ecs.personable[id]={...person.personable,age:plan.adults.includes(id)?24:10,dead:plan.dead.includes(id)};
    recipe.ecs.household[id]={id,houseId:plan.homes[id]};
    recipe.ecs.village[id]={id,villageId:recipe.ecs.village[plan.homes[id]]?.villageId??null};
    recipe.ecs.controllable[id]={id,controllerId:plan.controllers[id]};
    if(plan.guests.includes(id))(recipe.ecs.guest ||= {})[id]={id};
  }
  delete recipe.personIds;delete recipe.eventRefs;delete recipe.construction;
  recipe.events=[];recipe.knowledge={};return recipe;
}

const preparations = new WeakMap();
function jobsFor(j) {
  let jobs = preparations.get(j);
  if (!jobs) { jobs = new Map(); preparations.set(j, jobs); }
  return jobs;
}
export function detailNeighbours(s) {
  const hex = s.world.hexes.find(h => worldKey(h) === s.travel.active);
  return neighbours(hex).map(worldKey).filter(key => s.travel.maps[key]);
}

export function prepareDetail(s, key, progress = async () => {}, options = {}) {
  const j = s.travel;
  if (j.preparedMaps?.[key]) return Promise.resolve(j.preparedMaps[key]);
  const jobs = jobsFor(j);
  if (jobs.has(key)) return jobs.get(key);
  // Every asynchronous build owns its input graph, even while play advances a
  // season, saves, changes the active hex or replaces the entire game.
  const context = { world: s.world, worldHistory: s.worldHistory, travel: j, days: .375, ui: { playerId: s.ui.playerId } };
  const hex = s.world.hexes.find(h => worldKey(h) === key);
  const build=origin=>buildHistoryMap(context, hex, origin, progress, options).then(map => {
    map.constructionStores=Object.fromEntries(Object.entries(origin.ecs.container||{}).map(([id,c])=>[id,{...c.amounts}]));
    map.unopenedDetail = true;
    (j.unopenedHexes ||= {})[key] = true;
    if(j.localPeople) {
      const prepared=stripPeople(map,j);
      for(const table of Object.values(prepared.ecs))if(table && typeof table==="object")for(const id of prepared.personIds)delete table[id];
      (j.preparedMaps ||= {})[key]=prepared;return prepared;
    }
    (j.preparedMaps ||= {})[key] = map;
    return map;
  });
  const work=(j.detailRecipes ? readRecipe(s,key).then(build) : build(structuredClone(s.worldHistory.detailOrigins[key]))).finally(() => jobs.delete(key));
  jobs.set(key, work);
  return work;
}

export async function prepareNeighbourDetails(s, progress = async () => {}, options = {}) {
  const j = s.travel;
  if (!s.worldHistory?.detailOrigins && !s.travel.detailRecipes) return;
  const keys = detailNeighbours(s);
  j.detailQueue = keys.filter(key => j.maps[key]?.compact && !j.hexRecords?.[key] && !j.preparedMaps?.[key]);
  const pending = [...j.detailQueue];
  for (const [index, key] of pending.entries()) {
    if (s.travel !== j) return;
    await prepareDetail(s, key, async (label, value) => {
      // A new arrival takes priority over older background preparations.
      while (options.background && s.travel === j && s.transition && s.transition.destination !== key) await new Promise(resolve => setTimeout(resolve, 16));
      if (s.travel !== j) return;
      await progress(label, (index + value) / pending.length);
    }, options);
    j.detailQueue = j.detailQueue.filter(other => other !== key);
  }
}

const afterPaint = fn => requestAnimationFrame(() => setTimeout(fn, 0));
export function scheduleNeighbourDetails(s, schedule = afterPaint) {
  const j = s.travel;
  if (!s.worldHistory?.detailOrigins && !s.travel.detailRecipes) return;
  // Persist intent before yielding. Reload derives any remaining work from the
  // active hex and the committed detail pointers, including interrupted builds.
  j.detailQueue = detailNeighbours(s).filter(key => j.maps[key]?.compact && !j.hexRecords?.[key] && !j.preparedMaps?.[key]);
  schedule(() => {
    if (s.travel !== j) return;
    prepareNeighbourDetails(s, () => new Promise(resolve => setTimeout(resolve, 0)), { background: true })
      .then(() => { if (s.travel === j) s.persistence?.request(); })
      .catch(error => { if (s.travel === j) s.detailError = error.message; });
  });
}

// Construction uses the fixed end-of-history recipe. Identity, ownership,
// residents, food and news then come from the current compact community.
export function applyPreparedDetail(s, key, detail, summary) {
  if(s.travel.localPeople)hydratePeople(detail,s.travel);
  const origin = s.worldHistory?.detailOrigins?.[key], ecs = { ...summary.ecs };
  ecs.household = Object.fromEntries(Object.entries(summary.ecs.household).map(([id, h]) => [id, {
    ...h, trade: h.trade ?? detail.ecs.household[id]?.trade,
    workplaceId: h.workplaceId ?? detail.ecs.household[id]?.workplaceId
  }]));
  ecs.container = Object.fromEntries(Object.entries(summary.ecs.container).map(([id, store]) => {
    const before = origin?.ecs.container[id]?.amounts || detail.constructionStores?.[id], after = detail.ecs.container[id]?.amounts;
    const amounts = { ...store.amounts };
    if (before && after) for (const type of Object.keys(before)) amounts[type] = Math.max(0, (amounts[type] || 0) - (before[type] - (after[type] || 0)));
    return [id, { ...store, amounts }];
  }));
  const events = [...summary.events, ...detail.events];
  const knowledge = { ...summary.knowledge };
  for (const [id, learned] of Object.entries(detail.knowledge)) {
    const current = knowledge[id] || {};
    if(summary.newsModel){knowledge[id]={...current,...learned,people:{...current.people,...learned.people}};delete knowledge[id].events;continue;}
    const known = new Set(current.events || []);
    knowledge[id] = { ...current, events: [...known, ...(learned.events || []).filter(event => !known.has(event))] };
  }
  return restoreDetails(detail, { ...summary, ecs, events, knowledge,
    eventIds: { next: Math.max(summary.eventIds?.next || 0, detail.eventIds?.next || 0) } });
}
