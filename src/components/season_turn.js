import React from "react";
import { GameState } from "components/contexts";
import { FESTIVAL_MOODS, attendFestival, finishSeasonTurn, festivalPlace, festivalPeople } from "game/seasons";
import { personLabel } from "game/knowledge";
import { Hex } from "game/hex";
const seasons=["spring","summer","autumn","winter"];
export function SeasonTurn() {
  const s=React.useContext(GameState),page=s.seasonTurn;
  if(!page)return null;
  const kind=seasons[((page.season%4)+4)%4],next=seasons[((page.season+1)%4+4)%4];
  return <div className="season-turn" role="dialog" aria-modal="true" aria-label="The season turns"><article>
    <p className="eyebrow">The season turns · year {Math.floor(page.season/4)+1}</p>
    <h1>{kind[0].toUpperCase()+kind.slice(1)} in the village</h1>
    <p>What you saw and what people told you.</p>
    {page.lines.length ? <ul>{page.lines.map(line=><li key={line.id} className={"season-"+line.section}>{line.text}</li>)}</ul> : <p>No news reached you this season.</p>}
    <button onClick={()=>{finishSeasonTurn(s);s.ui.actions.end_turn();}}>Begin {next}</button>
  </article></div>;
}
export function FestivalNotice() {
  const s=React.useContext(GameState),f=s.festivals?.active;
  if(!f || !s.ui)return null;
  const a=s.ui.playerId,e=s.ecs;
  const known=e.playable?.[a]?.known || [];
  const distance = v => {const p=festivalPlace(s,v),at=e.spatial[a];return at ? Math.hypot(p.x-at.x,p.y-at.y) : 0;};
  const villages=Object.values(s.villages || {}).filter(v=>{
    const point=festivalPlace(s,v);
    const gathering=Object.keys(e.planner || {}).some(id=>!e.personable?.[id]?.dead && e.village?.[id]?.villageId==v.id && e.planner[id].world.festivalPlace);
    return point && gathering && known.some(h=>String(Hex(h))==String(Hex().fromPoint(point)));
  }).sort((x,y)=>distance(x)-distance(y)).slice(0,1);
  const people=festivalPeople(s,Object.keys(e.personable || {}).filter(id=>id!=a&&!e.personable[id].dead&&e.planner?.[id]?.world.festivalPlace&&e.spatial?.[id]&&e.spatial?.[a]&&Math.hypot(e.spatial[id].x-e.spatial[a].x,e.spatial[id].y-e.spatial[a].y)<=300));
  return <aside className="festival-notice" aria-label="Season festival">
    <strong>{f.title}</strong><p>{FESTIVAL_MOODS[f.kind]}</p>
    {villages.map(v=><button key={v.id} title={"Attend at "+v.name} onClick={()=>{attendFestival(s,v.id);s.ui.actions.end_turn();}}>Attend</button>)}
    {people.map(id=><button key={id} onClick={()=>s.ui.actions.talk_to(id,"chat")}>Talk to {personLabel(s,id)}</button>)}
  </aside>;
}
