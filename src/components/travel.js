import React from "react";
import { GameState } from "./contexts";
import { hexName, journeyRoute, journeyText } from "game/travel";
import { worldKey } from "game/travel_geometry";
import { knownCommunities, reachFacts, inspectRealm, worldMapRoads } from "game/realm_map";
import { Overworld, BiomeKey } from "./overworld";

export function TravelOverview() {
  const s = React.useContext(GameState);
  if (!s.world || !s.ui.show.world_overview) return null;
  const key = s.ui.realmSelection?.reachKey || worldKey(s.world.home);
  const hex = s.world.hexes.find(h => worldKey(h) == key) || s.world.home;
  const facts = reachFacts(s, hex);
  const playable = s.ecs.playable[s.ui.playerId];
  const known = new Set([worldKey(s.world.home), ...Object.keys(playable?.knownByMap || {})]);
  const communities = s.world.hexes.flatMap(h => knownCommunities(s, worldKey(h)));
  const journey = s.travel.journey;
  const route = facts.current || hex.ocean ? null : journeyRoute(s, key);
  const select = h => { inspectRealm(s, worldKey(h)); s.ui.actions.end_turn(); };
  return <section className="world-overview" role="dialog" aria-modal="false" aria-label="World map">
    <button className="close" aria-label="Close world map" onClick={() => s.ui.actions.change_visibility({world_overview:false})}>×</button>
    <h3>World map</h3>
    <p>{hexName(s.world.home)} · You are here. Each hop takes one season. Walk through each hex along the way.</p>
    <Overworld world={s.world} size={28} onSelect={select} known={known} communities={communities}
      selected={key} roads={worldMapRoads(s)} route={journey ? [worldKey(s.world.home), ...journey.route] : []}/>
    <p className="map-key">Red ring: you · Pale rim: known hex · Grey line: road · Gold line: planned journey</p>
    {journey && <p role="status">{journey.campId ? "Camped until dawn. " : journey.paused ? "Journey paused. " : ""}{journeyText(journey)}.
      <button onClick={() => s.ui.actions.stop_journey()}>Stop journey here</button></p>}
    <section className="world-destination" aria-label="Journey destination"><h3>{facts.name}</h3><p>{facts.terrain}</p>
      {facts.communities.map(v => <p key={v.id}>{v.name}</p>)}
      {!facts.current && (route ? <><p>{route.length - 1} {route.length == 2 ? "season" : "seasons"} on the road, plus walking.</p>
        <button disabled={s.worldBusy} onClick={() => s.ui.actions.plan_journey(key)}>{journey ? "Change course" : "Plan journey"}</button></> : <p>No land route to this hex.</p>)}
      {facts.current && <p>Choose a land hex to plan a journey.</p>}
    </section><BiomeKey/>
  </section>;
}
export { TravelOffer } from "./travel_offer";
export default TravelOverview;
