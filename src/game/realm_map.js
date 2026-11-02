import { hexName } from "game/travel_geometry";
import { climateSummary } from "game/biome_field";
import { Hex } from "game/hex";
import { displayName } from "game/knowledge";
import { villageArea } from "game/settlement_details";
import { villageElder } from "game/village_customs";

export const reachKey = h => h.x + "," + h.y;
export function inspectRealm(s, key, villageId = null) {
  if (!s.world.hexes.some(h => reachKey(h) == key)) return;
  s.ui.realmSelection = { reachKey: key, villageId };
}

// Discovery is person AND map scoped. Never infer knowledge from generated
// villages, the global people directory, a previous player's discoveries or debug reveal.
export function knownCommunities(s, key = reachKey(s.world.home)) {
  const active = key == reachKey(s.world.home);
  const source = active ? s : s.travel?.maps?.[key];
  if (!source) return [];
  const viewer = s.ui.playerId;
  const discoveries = active ? source.ecs.playable?.[viewer]?.known : s.ecs.playable?.[viewer]?.knownByMap?.[key];
  const known = new Set((discoveries || []).map(h => h.x + "," + h.y));
  const nameState = { ...source, ui: { playerId: viewer }, personName: id => s.personName?.(id,source.ecs.nameable[id]) || source.ecs.nameable[id]?.nickname || "an unknown person",
    knowledge: { [viewer]: s.knowledge?.[viewer] || s.travel?.knowledge?.[viewer] } };
  // Use the current actor's actual identity knowledge for offscreen owners too.
  nameState.ecs = { ...source.ecs, relationships: { ...source.ecs.relationships, [viewer]: s.ecs.relationships?.[viewer] } };
  return Object.values(source.villages || {}).flatMap(v => {
    const centreId = (v.sharedPlaces || []).find(id => source.ecs.meetingPlace?.[id]?.kind == "green") || v.houses?.[0];
    const point = source.ecs.spatial?.[centreId];
    if (!point || !known.has(String(Hex().fromPoint(point)))) return [];
    const elderId = villageElder(source, v.id);
    const households = (v.houses || []).filter(id => source.ecs.spatial[id] && known.has(String(Hex().fromPoint(source.ecs.spatial[id])))).map(id => {
      const owner = source.ecs.controllable?.[id]?.controllerId;
      return { id, point: source.ecs.spatial[id], owner: owner ? displayName(nameState, owner) : "Unknown household" };
    });
    return [{ id: v.id, reachKey: key, name: v.name, point, elder: elderId ? displayName(nameState, elderId) : null, households,
      area: villageArea(source,v.id).filter(k=>known.has(k)).map(k=>Hex(...k.split(",").map(Number)).toPoint()) }];
  });
}
export function reachFacts(s, h) {
  const key = reachKey(h);
  return { key, name: hexName(h,s.world.home), current: key == reachKey(s.world.home),
    visited: key == reachKey(s.world.home) || !!s.travel?.hexRecords?.[key] || !!s.travel?.maps?.[key] && !s.travel.maps[key].compact,
    terrain: h.ocean ? "Ocean" : climateSummary(h), temperature: h.temperature, moisture: h.moisture,
    weather: s.weather?.[key], communities: knownCommunities(s, key) };
}

export function toggleWorldMap(s) {
  if (!s.travel || s.generating || s.transition || s.intro?.active || s.ui.show.main_menu || s.ui.show.mapgen) return;
  s.ui.show.world_overview = !s.ui.show.world_overview;
}
export function handleWorldMapKey(event, s) {
  const target = event.target;
  if (event.code != "KeyM" || event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable) return;
  toggleWorldMap(s);
  event.preventDefault();
  s.ui.actions?.end_turn?.();
}
export function worldMapRoads(s) {
  const roads = new Map();
  for (const trip of s.travel?.routeHistory || []) {
    if (!trip.borderKey) continue;
    const ends = trip.borderKey.split("/").sort();
    if (ends.length == 2) roads.set(ends.join("/"), ends);
  }
  return [...roads.values()];
}
