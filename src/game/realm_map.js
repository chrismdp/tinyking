import { climateSummary } from "game/biome_field";
import { Hex } from "game/hex";
import { displayName } from "game/knowledge";
import { villageArea } from "game/settlement_details";
import { villageElder } from "game/village_customs";

export const reachKey = h => h.x + "," + h.y;
export const mapLayers = s => ({ communities: true, weather: false, wind: false, ...s.ui?.mapLayers });
export function setMapLayer(s, layer, checked) {
  if (!["communities", "weather", "wind"].includes(layer)) return;
  s.ui.mapLayers = { ...mapLayers(s), [layer]: checked };
}
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
  return { key, name: "Reach " + h.x + ", " + h.y, current: key == reachKey(s.world.home),
    visited: key == reachKey(s.world.home) || !!s.travel?.maps?.[key],
    terrain: h.ocean ? "Ocean" : climateSummary(h), temperature: h.temperature, moisture: h.moisture,
    weather: s.weather?.[key], communities: knownCommunities(s, key) };
}
