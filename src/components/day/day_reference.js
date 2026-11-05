import React from "react";
import PropTypes from "prop-types";
import { personComponent } from "game/residents";
import { WorldHex } from "game/hex";
import { portraitKey, knownPersonName, describePerson, familyTree, personSheet, knownPeople, asksJournal, doing, actionWords } from "game/day_view";
import manOther from "../../assets/day/man-other.jpg";
import olderOther from "../../assets/day/older-man-other.webp";
import childOther from "../../assets/day/child-other.webp";
import man from "../../assets/day/man.jpg";
import older from "../../assets/day/older-man.webp";
import child from "../../assets/day/child.webp";
import woman from "../../assets/day/woman.webp";
const portraits={"man-0":man,"man-1":manOther,"older-man-0":older,"older-man-1":olderOther,"child-0":child,"child-1":childOther,"woman-0":woman,"woman-1":woman};
export function faceSource(s,id) {
  const n=personComponent(s,"nameable",id),p=personComponent(s,"personable",id);
  const key=portraitKey(id,n?.male,p?.age||30);
  return portraits[key];
}
export function Face({game,id,unknown=false}) {const group=unknown?"woman":portraitKey(id,personComponent(game,"nameable",id)?.male,personComponent(game,"personable",id)?.age||30).replace(/-\d+$/,"");return <span aria-hidden="true" className={"day-face day-art-"+group+(unknown?" unknown":"")} style={{backgroundImage:`url(${unknown?woman:faceSource(game,id)})`}}/>;}
Face.propTypes={game:PropTypes.object,id:PropTypes.string,unknown:PropTypes.bool};
export function DayReference({game:s,places,tab,setTab,person,onPerson,onPlace,onTravel,menu,disabled}) {
  const [world,setWorld]=React.useState(false),[root,setRoot]=React.useState(s.ui.playerId);
  return <><nav className="day-tabs" aria-label="Reference views">{["Map","Family","People","Asks"].map(t=><button key={t} className={tab===t?"on":""} onClick={()=>setTab(t)}>{t}</button>)}</nav><div className="day-reference">
    {tab==="Map"&&<><div className="day-map-title"><h2>{world?"Beyond the valley":"The valley"}</h2><button className="day-text-button" onClick={()=>setWorld(!world)}>{world?"Valley map":"World map"}</button></div>{world?<WorldMap game={s} menu={menu} disabled={disabled} onTravel={onTravel}/>:<>
      <p className="day-note">Every place in the valley. Choose a hex to spend the {menu.slot} there.</p><ValleyMap game={s} places={places} onPlace={onPlace} disabled={disabled}/><p className="day-map-key"><span>◆ You are here</span><span>Faces show people there</span></p>
      <details className="day-map-people"><summary>People at every place</summary>{places.map(g=><div key={g.id}><h3>{g.name}{g.here?" · you are here":""}</h3>{g.people.length?g.people.map(p=><button key={p.id} onClick={()=>onPerson(p.id)}>{describePerson(s,p.id)} · {doing(s,p.id)}</button>):<p className="day-note">No one here at the moment.</p>}</div>)}</details>
      <div className="day-ways"><div className="day-label">Ways out of the valley</div><p className="day-note">A hop takes three parts of the day. Set out in the morning or afternoon.</p>{menu.choices.filter(c=>c.activity==="travel").map(c=><TravelChoice key={c.id} game={s} choice={c} disabled={disabled} onTravel={onTravel}/>)}{s.travel?.dayJourney&&<p>You are on the road. Continue your story to reach the next valley.</p>}</div>
    </>}</>}
    {tab==="Family"&&<><div className="day-label reed">The people you belong to</div><h2>Family</h2><p className="day-note">Your mother asked you to find her family. Names and faces fill in as you learn who people are.</p><label>Whose family?<select aria-label="Family of" value={root} onChange={e=>setRoot(e.target.value)}>{knownPeople(s).map(id=><option key={id} value={id}>{knownPersonName(s,id)}</option>)}</select></label><Family game={s} root={root} onPerson={onPerson}/></>}
    {tab==="People"&&<><div className="day-label reed">People you know of</div><label className="day-person-select">Choose a person<select aria-label="Known person" value={person||s.ui.playerId} onChange={e=>onPerson(e.target.value)}>{knownPeople(s).map(id=><option key={id} value={id}>{knownPersonName(s,id)}</option>)}</select></label><PersonSheet game={s} id={person||s.ui.playerId}/></>}
    {tab==="Asks"&&<><div className="day-label reed">What people asked of you</div><h2>Asks</h2><p className="day-note">Their words, and what you have learned. How you keep a promise is up to you.</p>{asksJournal(s).length?asksJournal(s).map(a=><article className={"day-ask "+a.status} key={a.id}><div className="day-person-head"><Face game={s} id={a.giverId}/><div><button className="day-person-name" onClick={()=>onPerson(a.giverId)}>{describePerson(s,a.giverId)}</button><h3>{a.title}</h3></div></div>{a.words?<blockquote>“{a.words}”</blockquote>:<p>{a.context}</p>}<p className="day-ask-outcome">{a.outcome}</p>{a.learned.length>0&&<details open><summary>What you have learned</summary>{a.learned.map((line,i)=><p key={i}>{line}</p>)}</details>}</article>):<div className="day-empty"><p>No one has asked you for anything yet.</p><p>Spend time together. Ask about Help when you talk.</p></div>}</>}
  </div></>;
}
DayReference.propTypes={game:PropTypes.object,places:PropTypes.array,tab:PropTypes.string,setTab:PropTypes.func,person:PropTypes.string,onPerson:PropTypes.func,onPlace:PropTypes.func,onTravel:PropTypes.func,menu:PropTypes.object,disabled:PropTypes.bool,revision:PropTypes.number};
function shortName(name) {return name.split(",")[0].replace(/^The |^An /,"").replace(" house","").replace("Your ","Your ");}
function ValleyMap({game:s,places,onPlace,disabled}) {
  const sorted=[...places].sort((a,b)=>a.point.y-b.point.y||a.point.x-b.point.x),cols=4,rows=Math.ceil(sorted.length/cols),height=rows*78+20;
  return <svg className="day-valley-map" viewBox={`0 0 394 ${height}`} role="group" aria-label="Valley hex map">
    {sorted.map((g,i)=>{const row=Math.floor(i/cols),col=i%cols,x=45+col*93+(row%2?12:0),y=50+row*78;
      const words=shortName(g.name).split(" "),lines=[];for(const word of words){if(!lines.length||lines.at(-1).length+word.length>12)lines.push(word);else lines[lines.length-1]+=" "+word;}
      return <g key={g.id} role="button" tabIndex={disabled?-1:0} aria-disabled={disabled} aria-label={"Go to "+g.name+(g.here?", you are here":"")} onClick={()=>{if(!disabled)onPlace(g);}} onKeyDown={e=>{if(!disabled&&["Enter"," "].includes(e.key)){e.preventDefault();onPlace(g);}}} className={"day-map-hex "+(g.here?"here":"")} transform={`translate(${x},${y})`}><title>{g.name}{g.people.length?": "+g.people.map(p=>describePerson(s,p.id)).join(", "):""}</title><polygon points="0,-47 42,-24 42,24 0,47 -42,24 -42,-24"/>{lines.slice(0,3).map((l,j)=><text key={j} textAnchor="middle" y={-14+j*12}>{l}</text>)}{g.people.slice(0,3).map((p,j)=><image key={p.id} href={faceSource(s,p.id)} x={-11*g.people.slice(0,3).length+22*j} y={22} width="19" height="19" preserveAspectRatio="xMidYMid slice"/>)}{g.here&&<text className="day-here-label" textAnchor="middle" y="-29">YOU</text>}</g>;
    })}
  </svg>;
}
ValleyMap.propTypes={game:PropTypes.object,places:PropTypes.array,onPlace:PropTypes.func,disabled:PropTypes.bool};
function WorldMap({game:s,menu,disabled,onTravel}) {
  const hexes=s.world.hexes,points=hexes.map(h=>({...h,key:h.x+","+h.y,point:WorldHex(h).toPoint()}));
  const xs=points.map(h=>h.point.x),ys=points.map(h=>h.point.y),minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX+150,height=Math.max(...ys)-minY+160;
  const ways=menu.choices.filter(c=>c.activity==="travel"),destinations=new Set(ways.map(c=>c.destination));
  return <><p className="day-note">Each hex is a valley or region. The bright border shows a road you can take from here.</p><svg className="day-world-map" viewBox={`0 0 ${width} ${height}`} aria-label="World hex map">{points.map(h=>{
    const current=h.key===s.travel.active,reachable=destinations.has(h.key),x=h.point.x-minX+75,y=h.point.y-minY+80;
    return <g key={h.key} transform={`translate(${x},${y})`} className={(current?"here ":"")+(reachable?"reachable ":"")+(h.ocean?"ocean":"")}><polygon points="0,-57 50,-28 50,28 0,57 -50,28 -50,-28"/><text textAnchor="middle" y="0">{current?"You":h.ocean?"Sea":reachable?"Road":"?"}</text>{current&&<text textAnchor="middle" y="20">are here</text>}</g>;
  })}</svg><div className="day-label">Roads from here</div>{ways.map(c=><TravelChoice key={c.id} game={s} choice={c} onTravel={onTravel} disabled={disabled}/>)}{!ways.length&&<p>{s.travel.dayJourney?"You are on the road. Return to Story to continue.":"No road leads out from here."}</p>}<p className="day-note">Distant lands are still unknown. Ask travellers about them.</p></>;
}
WorldMap.propTypes={game:PropTypes.object,menu:PropTypes.object,disabled:PropTypes.bool,onTravel:PropTypes.func};
function TravelChoice({game:s,choice:c,disabled,onTravel}) {return <div className="day-travel-choice"><button disabled={disabled||!c.available} onClick={()=>onTravel(c)}>{actionWords(s,c)}</button><small>{c.reason}</small>{c.personId&&<small>Your travelling companion: {describePerson(s,c.personId)}</small>}</div>;}
TravelChoice.propTypes={game:PropTypes.object,choice:PropTypes.object,disabled:PropTypes.bool,onTravel:PropTypes.func};
function Family({game:s,root,onPerson}) {
  const tree=familyTree(s,root),levels={[tree.rootId]:0},queue=[tree.rootId],byId=Object.fromEntries(tree.nodes.map(n=>[n.id,n]));
  for(const id of queue){const node=byId[id];if(!node)continue;for(const [ids,delta] of [[node.parents,-1],[node.children,1],[node.siblings,0],[[node.spouse].filter(Boolean),0]])for(const other of ids)if(levels[other]===undefined){levels[other]=levels[id]+delta;queue.push(other);}}
  const generations=[...new Set(Object.values(levels))].sort((a,b)=>a-b);
  return <div className="day-family-tree">{generations.map(level=><div key={level} className="day-generation"><div className="day-label">{level<0?level===-1?"Parents":"Grandparents":level>0?level===1?"Children":"Grandchildren":"This generation"}</div><div className="day-kin-row">{tree.nodes.filter(n=>levels[n.id]===level).map(n=><div className={"day-kin "+(n.id===tree.rootId?"root":"")} key={n.id}><button disabled={n.unknown} onClick={()=>onPerson(n.id)}><Face game={s} id={n.id} unknown={n.unknown}/><span>{n.name}</span></button>{n.dead&&<small>Remembered</small>}{n.spouse&&byId[n.spouse]&&<small>Married to {byId[n.spouse].name}</small>}{n.parents.length>0&&<small>Child of {n.parents.map(id=>byId[id]?.name||"Unknown").join(" and ")}</small>}</div>)}</div></div>)}</div>;
}
Family.propTypes={game:PropTypes.object,root:PropTypes.string,onPerson:PropTypes.func};
function PersonSheet({game:s,id}) {
  const sheet=personSheet(s,id),self=id===s.ui.playerId;
  return <div className="day-person-sheet"><div className="day-sheet-head"><Face game={s} id={id}/><div><h2>{self?"You":sheet.name}</h2><p className="reed">{self?"A new life in the valley":sheet.closeness}</p>{sheet.trade&&<p>{sheet.trade}</p>}</div></div><div className="day-label">What you know</div>{sheet.traits.length>0&&<p>Seems {sheet.traits.join(" and ")}.</p>}{sheet.story.map((line,i)=><p key={i}>{line}</p>)}<div className="day-label">What they have said</div>{sheet.said.length?sheet.said.map((line,i)=><blockquote key={i}>“{line}”</blockquote>):<p className="day-note">You have not spoken together yet.</p>}<div className="day-label">What you have told them</div>{sheet.aboutYou.length?sheet.aboutYou.map((line,i)=><p key={i}>“{line}”</p>):<p className="day-note">Your story is still new to them.</p>}</div>;
}
PersonSheet.propTypes={game:PropTypes.object,id:PropTypes.string};
