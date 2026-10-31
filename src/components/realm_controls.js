import React from "react";
import { GameState } from "./contexts";
import { mapLayers, setMapLayer, reachFacts } from "game/realm_map";

export function windDescription(wind) {
  if (!wind || !wind.strength) return "Calm";
  const directions=["east","south-east","south","south-west","west","north-west","north","north-east"];
  const direction=directions[(Math.round(Math.atan2(wind.y,wind.x)/(Math.PI/4))+8)%8];
  return "Wind towards "+direction+" · strength "+wind.strength.toFixed(2);
}
export function RealmControls() {
  const s=React.useContext(GameState);
  const [,refresh]=React.useState(0);
  const layers=mapLayers(s), overview=s.renderer?.overview;
  const h=s.world?.hexes.find(h=>h.x+","+h.y==s.ui.realmSelection?.reachKey);
  const facts=h && overview && reachFacts(s,h);
  const communities=facts?.communities.filter(v=>!s.ui.realmSelection.villageId || v.id==s.ui.realmSelection.villageId);
  const changed=()=>{refresh(n=>n+1);};
  return <div id="realm-controls">
    <div id="camera-actions">
      <button onClick={()=>{s.renderer?.showRealm();changed();}} aria-label="Fit the whole realm">◇ Realm</button>
      <button onClick={()=>{s.renderer?.recenter();changed();}} aria-label="Recenter on you">◎ You</button>
      <small>Drag to pan · Pinch & twist to zoom / turn</small>
    </div>
    {overview && <div className="realm-tools">
      <details className="map-layers"><summary>Map layers</summary><div>{["communities","weather","wind"].map(layer=><label key={layer}><input type="checkbox" checked={layers[layer]} onChange={e=>{setMapLayer(s,layer,e.target.checked);changed();}}/>{layer[0].toUpperCase()+layer.slice(1)}</label>)}</div></details>
      {facts && <section className="reach-facts" aria-label="Realm selection">
        <button className="close" aria-label="Close reach details" onClick={()=>{s.ui.realmSelection=null;changed();}}>×</button>
        <h3>{facts.name}{facts.current ? " · You are here" : ""}</h3>
        <p>{facts.terrain} · {facts.temperature} · {facts.moisture}</p>
        {!facts.visited && <p>Unexplored. To visit, return to You and choose Travel at a walkable map edge. Each journey takes one season.</p>}
        {facts.visited && <p>Inspection only. Travel begins at a walkable map edge.</p>}
        {layers.weather && facts.weather && <p>Weather: {facts.weather.type} · {facts.weather.pressure.toFixed(0)} hPa</p>}
        {layers.wind && <p>{windDescription(facts.weather?.wind)}</p>}
        {layers.communities && communities.map(v=><div className="community-facts" key={v.id}><strong>{v.name}</strong>
          <p>Recognised elder: {v.elder || "Unknown"}. Elders recognise village customs.</p>
          {v.households.map(h=><p key={h.id}>Household owner: {h.owner}</p>)}
        </div>)}
        {layers.communities && facts.visited && !communities.length && <p>No communities discovered here by this person.</p>}
      </section>}
    </div>}
  </div>;
}
