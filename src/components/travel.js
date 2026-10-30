import React from "react";
import { GameState } from "./contexts";
import { hexName, SIDE_NAMES } from "game/travel";
import { neighbours, worldKey } from "game/travel_geometry";
import { WeatherMap, BiomeKey } from "components/overworld";
export function TravelOverview() {
  const s = React.useContext(GameState);
  if (!s.world) return null;
  const home = s.world.hexes.find(h => worldKey(h) == worldKey(s.world.home));
  return <section className="world-overview" role="dialog" aria-label="World overview">
    <button className="close" aria-label="Close world overview" onClick={() => s.ui.actions.change_visibility({
      world_overview: false
    })}>×</button>
    <h3>{hexName(home)} · {home.biome}</h3><p>You are here. Click a walkable map-edge tile to travel.</p>
    <WeatherMap world={s.world} weather={s.weather} size={16} /><BiomeKey />
    <ul>{neighbours(home).map((h, side) => {
      const next = s.world.hexes.find(n => worldKey(n) == worldKey(h));
      return <li key={side}>{SIDE_NAMES[side]}: {next ? hexName(next) + " · " + (next.ocean ? "ocean — cannot enter" : next.biome) : "edge of the known world"}</li>;
    })}</ul>
  </section>;
}
export { TravelOffer } from "./travel_offer";
export default TravelOverview;
