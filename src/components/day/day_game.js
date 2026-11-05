import React from "react";
import PropTypes from "prop-types";
import { replaceGame, decompressGame } from "game/save_game";
import { slotChoices, playSlot } from "game/day";
import { skipIntro } from "game/intro";
import { day_of_season, season } from "game/time";
import { revealValley, personName, describePerson, valleyPlaces, doing, actionWords, narrateSlot, rememberAsks, foodSupplies, houseStanding } from "game/day_view";
import { DayConversation } from "./day_conversation";
import { DayReference, Face } from "./day_reference";
import seed13 from "../../assets/day/seed-13.json.gz";
import seed7 from "../../assets/day/seed-7.json.gz";
import "./day.scss";

const seeds={13:seed13,7:seed7};
const cap=s=>s[0].toUpperCase()+s.slice(1);
export function DayGame() {
  const game=React.useRef(null),resolver=React.useRef(null);
  const [seed,setSeed]=React.useState(new URLSearchParams(window.location.search).get("seed")==="7"?7:13);
  const [load,setLoad]=React.useState(0),[error,setError]=React.useState(""),[revision,redraw]=React.useReducer(n=>n+1,0);
  const [menu,setMenu]=React.useState(null),[places,setPlaces]=React.useState([]),[selected,setSelected]=React.useState(null);
  const [tab,setTab]=React.useState("Map"),[phoneTab,setPhoneTab]=React.useState("Story"),[person,setPerson]=React.useState(null);
  const [busy,setBusy]=React.useState(false),[chat,setChat]=React.useState(null),[result,setResult]=React.useState(null),[history,setHistory]=React.useState([]);
  const main=React.useRef(null);
  const refresh=React.useCallback(s=>{
    if(!s.travel?.dayJourney)revealValley(s);
    const m=slotChoices(s),p=valleyPlaces(s,m);setMenu(m);setPlaces(p);
    setSelected(old=>p.some(g=>g.id===old)?old:(p.find(g=>g.people.some(x=>s.knowledge?.[s.ui.playerId]?.people?.[x.id]))||p.find(g=>g.here)||p[0])?.id);
    redraw();
  },[]);
  const start=React.useCallback(async selectedSeed=>{
    setError("");setLoad(1);setMenu(null);setChat(null);setResult(null);setHistory([]);setBusy(false);setSelected(null);
    const response=await fetch(seeds[selectedSeed]);
    if(!response.ok)throw new Error("The saved world could not be loaded. Please try again.");
    const data=await decompressGame(await response.arrayBuffer());
    const s={redraws:[]};replaceGame(s,data);s.personName=id=>personName(s,id);skipIntro(s);
    game.current=s;
    // Read-only browser observation, shared with the repo's play tools.
    window.tinyking=s;
    refresh(s);setPerson(s.ui.playerId);setLoad(0);
  },[refresh]);
  React.useEffect(()=>{start(seed).catch(e=>{setError(e.message);setLoad(0);});},[seed,start]);
  const play=async choice=>{
    if(busy||!choice?.available)return;
    setBusy(true);setError("");setPhoneTab("Story");
    main.current?.closest(".day-game")?.scrollTo({top:0,behavior:"smooth"});
    await new Promise(r=>setTimeout(r,40));
    try {
      const suppliesBefore=foodSupplies(game.current);
      const r=await playSlot(game.current,choice,{chooseLine:s=>{
        s.dayBook ||= game.current.dayBook ||= {askWords:{}};
        rememberAsks(s);setChat({game:s,c:s.chat.active,choice,done:false});
        setPerson(s.chat.active.npcId);
        redraw();
        return new Promise(resolve=>{resolver.current=resolve;});
      }});
      r.supplies={before:suppliesBefore,after:foodSupplies(game.current)};
      const story={...r,prose:narrateSlot(game.current,r)};
      setResult(story);setHistory(old=>[...old,story]);
      setChat(old=>old?{...old,done:true}:null);refresh(game.current);
    } catch(e) {setError(e.message);setChat(null);refresh(game.current);}
    finally {setBusy(false);resolver.current=null;}
  };
  const say=key=>{const resolve=resolver.current;if(resolve){resolver.current=null;resolve(key);}};
  const showPerson=id=>{main.current?.closest(".day-game")?.scrollTo({top:0});setPerson(id);setTab("People");setPhoneTab("People");};
  if(!menu)return <div className="day-game day-loading"><div className="day-brand">TinyKing</div><h1>A day with people</h1><p>{load?"Opening the valley and its history…":"Your story is waiting."}</p>{error&&<p role="alert">{error}</p>}{!load&&<button onClick={()=>start(seed).catch(e=>setError(e.message))}>Try again</button>}</div>;
  const s=game.current,p=places.find(g=>g.id===selected)||places[0],standing=houseStanding(s),dead=s.ecs.personable[s.ui.playerId]?.dead;
  const right=<DayReference game={chat?.game||s} places={places} tab={tab} setTab={t=>{setTab(t);setPhoneTab(t);}} person={person} onPerson={showPerson} onTravel={play} menu={menu} onPlace={g=>play(g.choices.find(c=>c.placeId===g.id&&c.activity==="visit")||g.choices.find(c=>c.activity==="visit"))} disabled={busy||!!chat} revision={revision}/>;
  return <div className="day-game">
    <header className="day-topbar"><a className="day-brand" href="/">TinyKing</a><span className="day-when">{cap(season(s.days))} · day {day_of_season(s.days)+1}</span><div className="day-pills">{["morning","afternoon","evening"].map(t=><span key={t} className={"day-pill "+(menu.slot===t?"now":"")}>{cap(t)}</span>)}</div><div className="day-house">Your house: <span>{standing.house}</span><small>{standing.standing}</small></div></header>
    <nav className="day-phone-tabs" aria-label="Day views">{["Story","Map","Family","People","Asks"].map(t=><button key={t} className={phoneTab===t?"on":""} onClick={()=>{main.current?.closest(".day-game")?.scrollTo({top:0});setPhoneTab(t);if(t!=="Story")setTab(t);}}>{t}</button>)}</nav>
    <div className="day-panes">
      <main className={"day-stage "+(phoneTab!=="Story"?"phone-hidden":"")} ref={main}>
        {error&&<p className="day-error" role="alert">{error}</p>}
        {chat?<DayConversation game={chat.game} conversation={chat.c} done={chat.done} onSay={say} onContinue={()=>{setChat(null);main.current?.closest(".day-game")?.scrollTo({top:0});}} redraw={redraw}/>:
          <>
            <div className="day-scenehead"><div className="day-label reed">{result?cap(result.slot)+" · day "+result.day:"Your mother's last wish"}</div><h1>{result?(result.road?"On the road":result.choice.personId?"Time with "+describePerson(s,result.choice.personId):"The day in the valley"):"A stranger in "+(Object.values(s.villages||{})[0]?.name||"the valley")}</h1></div>
            {!result?<div className="day-log"><p>Your mother has died. Before she died, she asked you to find her family. You have come to the valley where they live.</p><p className="day-narration">There is a camp for you here, and a village full of lives already under way. Who will you spend the morning with?</p><div className="day-learn"><span>Each part of the day</span>Choose a person or a place. Take your time when you talk. Two matching icons clear space in the row.</div></div>:
              <div className="day-log" aria-live="polite">{result.prose.filter(x=>x.kind!=="sighting").map((line,i)=><p className={"day-"+line.kind} key={i}>{line.text}</p>)}
                {result.prose.some(x=>x.kind==="sighting")&&<details className="day-sightings" open><summary>People you saw</summary>{result.prose.filter(x=>x.kind==="sighting").map((line,i)=><p key={i}>{line.text}</p>)}</details>}
                {result.conversations.map((c,i)=><details className="day-transcript" key={i}><summary>What you said with {describePerson(s,c.personId)}</summary>{c.lines.map((l,j)=><p key={j}><span>{l.speaker==="player"?"You":describePerson(s,c.personId)}:</span> {l.text}</p>)}</details>)}
              </div>}
            {busy?<p className="day-working" role="status">{menu.slot==="evening"?"The evening passes, then the valley sleeps…":"The day goes on around you…"}</p>:dead?<p>Your life here has ended. You can play this week again.</p>:<section className="day-next" aria-label="Choose how to spend the next part of the day"><div className="day-label">Spend the {menu.slot}</div><p className="day-note">{Object.keys(foodSupplies(s)).length?"Food you can offer: "+Object.entries(foodSupplies(s)).map(([type,amount])=>amount+" "+type).join(", "):"You have no food to offer yet. You can gather some nearby."}</p>
              {s.travel?.dayJourney?<><p className="day-log">The next valley lies ahead. {s.travel.dayJourney.companionId?"You have company on the road.":"You are travelling alone."}</p><Choice game={s} choice={menu.choices[0]} onPlay={play}/></>:
                <><label className="day-place-select">Where will you go?<select aria-label="Choose a place" value={p?.id||""} onChange={e=>setSelected(e.target.value)}>{places.map(g=><option key={g.id} value={g.id}>{g.name}{g.here?" · you are here":""}</option>)}</select></label>
                  {p&&<><h2>{p.name}</h2><p className="day-note">{p.here?"You are here. ":""}{p.people.length?"These people are here or on their way. Choose how to spend time with them.":"No one is here at the moment. You can spend time here, or choose another place."}</p>
                    <div className="day-person-choices">{p.people.map(n=><PersonChoices key={n.id} game={s} person={n} choices={p.choices.filter(c=>c.personId===n.id)} onPlay={play} onPerson={showPerson}/>)}</div>
                    <div className="day-place-choices">{p.choices.filter(c=>!c.personId&&c.placeId===p.id).map(c=><Choice game={s} key={c.id} choice={c} onPlay={play}/>)}</div>
                  </>}
                </>}
            </section>}
            {history.length>1&&<details className="day-history"><summary>Earlier in your story</summary>{history.slice(0,-1).map((r,i)=><details key={i}><summary>Day {r.day} · {cap(r.slot)}</summary>{r.prose.map((x,j)=><p key={j}>{x.text}</p>)}</details>)}</details>}
          </>}
      </main>
      <aside className={"day-aside "+(phoneTab==="Story"?"phone-hidden":"")}>{right}</aside>
    </div>
    <footer className="day-footer"><span>A day with people</span><label>World <select aria-label="World seed" disabled={busy||!!chat} value={seed} onChange={e=>{const n=Number(e.target.value);historyReplace(n);setSeed(n);}}><option value="13">13 · Reedbrook</option><option value="7">7 · A different valley</option></select></label><button disabled={busy||!!chat} onClick={()=>start(seed).catch(e=>setError(e.message))}>Play this week again</button><span className="day-note">Your story continues for as long as you wish.</span></footer>
  </div>;
}
function historyReplace(seed) {const url=new URL(window.location.href);url.searchParams.set("seed",seed);window.history.replaceState(null,"",url);}
function Choice({game,choice,onPlay}) {return <div className="day-choice-wrap"><button className="day-choice" data-activity={choice.activity} disabled={!choice.available} onClick={()=>onPlay(choice)}>{actionWords(game,choice)}</button><small>{choice.reason}</small></div>;}
Choice.propTypes={game:PropTypes.object,choice:PropTypes.object,onPlay:PropTypes.func};
function PersonChoices({game:s,person,choices,onPlay,onPerson}) {
  const primary=choices.find(c=>c.activity==="talk"),other=choices.filter(c=>c.activity!=="talk"&&!(c.activity==="introduce"&&!c.available));
  return <article className="day-person-card"><div className="day-person-head"><button className="day-face-button" aria-label={"About "+describePerson(s,person.id)} onClick={()=>onPerson(person.id)}><Face game={s} id={person.id}/></button><div><button className="day-person-name" onClick={()=>onPerson(person.id)}>{describePerson(s,person.id)}</button><small>{person.due?"On the way here · ":""}{doing(s,person.id)}</small></div></div>{primary&&<Choice game={s} choice={primary} onPlay={onPlay}/>}<details><summary>Offer help, food or bring people together</summary>{other.map(c=><Choice key={c.id} game={s} choice={c} onPlay={onPlay}/>)}</details></article>;
}
PersonChoices.propTypes={game:PropTypes.object,person:PropTypes.object,choices:PropTypes.array,onPlay:PropTypes.func,onPerson:PropTypes.func};
