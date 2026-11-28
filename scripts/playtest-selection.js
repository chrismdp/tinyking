/* eslint-disable no-undef */
require("./game-register");
const { Hex } = require("../src/game/hex");
const { path } = require("../src/game/pathfinding");
const { canPlaceField, tileContents } = require("../src/game/land_use");
const { designationPlants, clearableForage } = require("../src/game/designation");
const { resourcePermission } = require("../src/game/village_customs");
const { chatUnavailable, chatUnfriendly } = require("../src/game/manager");
const { patience } = require("../src/game/chat_patience");
const { isResident } = require("../src/game/residents");
const { deliveryHome } = require("../src/game/construction");

// All selection runs on detached snapshots. Use the same land, permission and
// navigation rules as the game, restricted to what the player has discovered.
function context(s, exclude = []) {
  const e = s.ecs, actor = s.ui.playerId, p = e.spatial[actor];
  const known = new Set(e.playable[actor].known.map(h => String(Hex(h))));
  const key = id => String(Hex().fromPoint(e.spatial[id]));
  const start = tileContents(s, actor).find(id => e.mappable[id]);
  const reserved = new Set([...exclude, ...(e.manager?.[actor]?.jobs || []).map(j => j.targetId)].map(String));
  return {
    e, actor,
    available: id => !reserved.has(String(id)) && known.has(key(id)) && resourcePermission(s, actor, id).permitted,
    reachable: id => {
      const tile = tileContents(s, id).find(other => e.mappable[other]);
      return tile && path(s, start, tile, (a, b) => known.has(key(b)));
    },
    distance: id => Math.hypot(e.spatial[id].x - p.x, e.spatial[id].y - p.y)
  };
}

function designationCandidates(s, { action = "create_field", allowTrees = false, exclude = [] } = {}) {
  const { e, actor, available, reachable, distance } = context(s, exclude);
  const treeComponents = new Set(["spatial", "nameable", "good", "tree", "controllable"]);
  return Object.keys(e.mappable).filter(id => available(id) && e.walkable[id]?.speed > 0 &&
    e.mappable[id].terrain == "grassland" && (action != "create_field" || canPlaceField(s, id)))
    .map(id => {
      const others = tileContents(s, id).filter(other => other != id && other != actor);
      const trees = others.filter(other => e.good?.[other]?.type == "wood" && e.good[other].amount > 0 && !e.haulable?.[other] &&
        Object.keys(e).every(component => !e[component]?.[other] || treeComponents.has(component)) &&
        resourcePermission(s, actor, other).permitted);
      const eligible = allowTrees ? others.every(other => trees.includes(other) || clearableForage(s, actor, other)) : designationPlants(s, actor, id) !== null;
      return { id, trees, eligible, distance: distance(id) };
    }).filter(c => c.eligible && reachable(c.id))
    .sort((a, b) => a.trees.length - b.trees.length || a.distance - b.distance || a.id.localeCompare(b.id));
}

function treeCandidates(s, exclude = []) {
  const { e, actor, available, reachable } = context(s, exclude);
  // Chopping delivers every log home. Exploring towards people must not
  // turn this into repeated hauls from the far side of the map.
  const home = e.spatial[deliveryHome(s, actor)] || e.spatial[actor];
  const distance = id => Math.hypot(e.spatial[id].x - home.x, e.spatial[id].y - home.y);
  return Object.keys(e.good || {}).filter(id => e.good[id].type == "wood" && e.good[id].amount > 0 &&
    !e.haulable?.[id] && available(id) && reachable(id))
    .sort((a, b) => distance(a) - distance(b) || a.localeCompare(b));
}

function restartCandidates(s, action, preferred, exclude = []) {
  const ids = action == "cut_tree_down" ? treeCandidates(s, exclude) : designationCandidates(s, { action, exclude }).map(c => c.id);
  return ids.includes(preferred) ? [preferred, ...ids.filter(id => id != preferred)] : ids;
}

function livingNeighbours(s) {
  const e = s.ecs, actor = s.ui.playerId;
  return Object.keys(e.personable || {}).filter(id => id != actor && e.spatial[id] && isResident(s, id) &&
    !e.personable[id].dead && e.personable[id].age >= 18 && e.controllable[id]?.controllerId != actor);
}

function chatCandidates(s) {
  const { e, actor, reachable, distance } = context(s);
  const known = new Set(e.playable[actor].known.map(h => String(Hex(h))));
  return livingNeighbours(s).filter(id => known.has(String(Hex().fromPoint(e.spatial[id]))) &&
    !chatUnavailable(s, actor, id) && reachable(id))
    .filter(id => { const slots = patience(s, actor, id); return slots.free >= slots.minimum; })
    .sort((a, b) => distance(a) - distance(b) || a.localeCompare(b));
}

// Assisted selection may locate a distant neighbour in the snapshot, but each
// Move here target stays within the continuously discovered part of the route.
function personApproach(s) {
  const e = s.ecs, actor = s.ui.playerId, p = e.spatial[actor];
  const key = id => String(Hex().fromPoint(e.spatial[id]));
  const known = new Set(e.playable[actor].known.map(h => String(Hex(h))));
  const start = tileContents(s, actor).find(id => e.mappable[id]);
  const distance = id => Math.hypot(e.spatial[id].x - p.x, e.spatial[id].y - p.y);
  const indoors = id => !!e.interior?.[id]?.buildingId;
  const people = livingNeighbours(s).filter(id => !chatUnfriendly(s, actor, id))
    .sort((a, b) => Number(indoors(a)) - Number(indoors(b)) || distance(a) - distance(b) || a.localeCompare(b));
  for (const person of people) {
    const goal = tileContents(s, person).find(id => e.mappable[id]);
    const route = goal && path(s, start, goal);
    if (!route) continue;
    const unseen = route.findIndex(step => !known.has(key(step.id)));
    const prefix = unseen < 0 ? route : route.slice(0, unseen);
    const moves = prefix.map(step => step.id).reverse().filter(id => distance(id) > 100 &&
      !e.mappable[id].buildingPlot && !tileContents(s, id).some(other => e.building?.[other]));
    return { person, moves, indoors: indoors(person) };
  }
  return null;
}

function worldIdentity(s, url, servedSeed) {
  const requested = new URL(url).searchParams.get("seed");
  const expectedSeed = requested ? (isNaN(+requested) ? requested : +requested) : servedSeed;
  const seed = s.travel?.seed;
  const loaded = !!(s.map && s.ecs?.spatial?.[s.ui?.playerId] && Object.keys(s.ecs.mappable || {}).length);
  return { loaded, seed, expectedSeed, source: requested ? "URL" : "served world",
    matches: expectedSeed !== undefined && seed === expectedSeed };
}

module.exports = { designationCandidates, treeCandidates, restartCandidates, worldIdentity, personApproach, chatCandidates };
