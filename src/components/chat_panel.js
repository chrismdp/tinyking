import { lifeStageLabel } from "game/life_stages";
import { warningConsequences, villageElder } from "game/village_customs";
import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { TOPICS, chatChoices, previewLine, iconKey, chatPersonName, topicScore, MOODS, moodScore } from "game/chat";
import { patience } from "game/chat_patience";
import { personLabel, displayName } from "game/knowledge";
import { createChatPlayback, presentChoices, iconLabel, knownReaction, explainIcon, poppingRow } from "./chat_presentation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSitemap, faHammer, faSeedling, faUtensils, faCloudSun, faHome, faChurch, faComments, faHandsHelping, faLock, faTree, faUserShield, faFrown, faSmile, faLaugh } from "@fortawesome/free-solid-svg-icons";
const pictures={woodland:faTree,family:faSitemap,work:faHammer,harvest:faSeedling,food:faUtensils,season:faCloudSun,village:faHome,faith:faChurch,gossip:faComments,help:faHandsHelping};
const moodPictures={guarded:faUserShield,grumbling:faFrown,cheerful:faSmile,joking:faLaugh};
const signed=n=>n>0?"+"+n:String(n);
function Words({text}) {return text.split(/(\*[^*]+\*)/).map((part,i)=>part.startsWith("*")?<em key={i}>{part.slice(1,-1)}</em>:part);}
Words.propTypes={text:PropTypes.string};
export function ChatIcon({icon,reaction,matches,onExplain,large=false}) {
  const s=React.useContext(GameState),label=iconLabel(s,icon),grievance=icon.kind=="grievance";
  const content=<>{icon.kind=="person"?<span className="chat-face" aria-hidden="true">{label.replace(/^a |^an /,"")[0].toUpperCase()}</span>:<FontAwesomeIcon icon={grievance?faLock:icon.kind=="topic"?pictures[icon.key]:moodPictures[icon.key]}/>}<span className="chat-icon-name">{label}</span>{matches&&!grievance&&<small className="match-tag" aria-label="Matches row">◆<span className="sr-only">Matches row</span></small>}{reaction!==undefined&&!grievance&&<small className={"taste-tag "+(reaction>0?"like":reaction<0?"dislike":"unknown")} aria-label={reaction===null?"Taste unknown":reaction>0?"Known like":reaction<0?"Known dislike":"Known neutral"}>{reaction===null?"?":reaction>0?"♥":reaction<0?"✕":"·"}</small>}</>;
  const props={"data-matches":!!matches,className:`chat-icon ${icon.kind}${large?" large":""}${matches&&!grievance?" matching":""}`,title:label+(grievance?" · cannot be matched; stays until this chat ends":matches?" · matches row":"")};
  return onExplain?<button type="button" {...props} onClick={e=>{e.stopPropagation();onExplain(icon);}}>{content}</button>:<span {...props}>{content}</span>;
}
ChatIcon.propTypes={icon:PropTypes.object,reaction:PropTypes.number,matches:PropTypes.bool,onExplain:PropTypes.func,large:PropTypes.bool};
export function TopicTastes({personId,onExplain}) {
  const s=React.useContext(GameState),known=s.knowledge?.[s.ui.playerId]?.people?.[personId]?.topicTastes||{},moods=s.knowledge?.[s.ui.playerId]?.people?.[personId]?.moodTastes||{};
  return <><div className="topic-tastes" aria-label="Topic tastes">{Object.entries(TOPICS).map(([key])=><ChatIcon key={key} onExplain={onExplain} icon={{kind:"topic",key}} reaction={personId==s.ui.playerId?topicScore(s,personId,key):known[key]??null}/>)}</div><div className="topic-tastes" aria-label="Mood tastes">{Object.entries(MOODS).map(([key])=><ChatIcon key={key} onExplain={onExplain} icon={{kind:"mood",key}} reaction={personId==s.ui.playerId?moodScore(s,personId,key):moods[key]??null}/>)}</div></>;
}
TopicTastes.propTypes={personId:PropTypes.string,onExplain:PropTypes.func};
export function ChatChoice({line,preview,selected,onSelect,onSpeak,onExplain,onPreview,reaction}) {
  const l=line;
  return <article className={"chat-choice"+(selected?" selected":"")} data-line-id={l.id} data-family={l.family} data-risk={!!l.risk} aria-disabled={!preview.fits}
    onMouseEnter={()=>onPreview(l.icons)} onMouseLeave={()=>onPreview(null)} onFocusCapture={()=>onPreview(l.icons)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))onPreview(null);}}
    onClick={e=>{if(!preview.fits)return;if(["touch","pen"].includes(e.nativeEvent.pointerType))onSelect(l.key);else onSpeak(l.key);}}>
    <button type="button" className="chat-choice-text" disabled={!preview.fits} aria-pressed={!!selected}>{l.family=="gossip_tell"&&"Tell: "}<Words text={l.title}/></button>
    <div className="choice-icons">{l.icons.map((i,n)=><ChatIcon key={iconKey(i)+n} icon={i} reaction={reaction(i)} matches={preview.matchingKeys.includes(iconKey(i))} onExplain={icon=>{onSelect(l.key);onExplain(icon);}}/>)}</div>
    {l.answer&&<small className="chat-answer">{l.answer}</small>}
    {l.risk&&<strong className="chat-risk">⚠ Risk: {l.risk.message} · rebuff and lost regard{l.risk.grievance?"; grievance":""}</strong>}
    {l.evasive&&<small>Avoiding the question costs 1 regard.</small>}
    {l.source&&<small>{l.source}</small>}
    <small>{l.icons.length} {l.icons.length==1?"icon":"icons"} · {preview.matches} {preview.matches==1?"match":"matches"}{!preview.fits?" · not enough room":""}{l.resolve?" · queues real work and delivery":""}</small>
    {selected&&<button type="button" className="chat-say" disabled={!preview.fits} onClick={e=>{e.stopPropagation();onSpeak(l.key);}}>Say this</button>}
  </article>;
}
ChatChoice.propTypes={line:PropTypes.object,preview:PropTypes.object,selected:PropTypes.bool,onSelect:PropTypes.func,onSpeak:PropTypes.func,onExplain:PropTypes.func,onPreview:PropTypes.func,reaction:PropTypes.func};
function usePlayback(c) {
  const [frame,setFrame]=React.useState(null),play=React.useRef(null),seen=React.useRef(0);
  const key=c?`${c.actorId}:${c.npcId}:${c.encounter}`:null,count=c?.transcript.length||0;
  React.useEffect(()=>{
    seen.current=0;
    play.current=createChatPlayback(f=>setFrame({...f,key}));
    return ()=>play.current.dispose();
  },[key]);
  React.useEffect(()=>{if(c){play.current.enqueue(c.transcript.slice(seen.current));seen.current=count;}},[key,count,c]);
  return frame?.key==key?frame:null;
}
export function ChatPanel() {
  const s=React.useContext(GameState),c=s.chat?.active,frame=usePlayback(c);
  const ref=React.useRef(null),[details,setDetails]=React.useState(false),[selected,setSelected]=React.useState(null),[hover,setHover]=React.useState(null),[info,setInfo]=React.useState("");
  const sending=React.useRef(false),key=c?`${c.actorId}:${c.npcId}:${c.encounter}`:null;
  React.useEffect(()=>{if(key){ref.current?.focus();setSelected(null);setHover(null);setInfo("");setDetails(false);}},[key]);
  React.useEffect(()=>{sending.current=!!frame?.busy;},[frame]);
  if(!c)return null;
  const p=patience(s,c.actorId,c.npcId),busy=!!frame?.busy,view=frame?.view;
  const learned=view?.learned||s.knowledge?.[c.actorId]?.people?.[c.npcId]||{},row=view?.row||c.row;
  const regard=view?.regard??(s.ecs.relationships[c.npcId]?.known[c.actorId]?.goodwill||0);
  const person=personLabel(s,c.npcId,id=>s.personName?.(id)||s.ecs.nameable[id]?.nickname||chatPersonName(s,id)),first=/^an? /.test(person)?person:person.split(" ")[0];
  const choices=presentChoices(s,chatChoices(s)).map(l=>({...l,source:l.family=="gossip_tell"?(s.knowledge?.[c.actorId]?.spokenSources?.[l.b.event.id]?"Heard from "+iconLabel(s,{kind:"person",personId:s.knowledge[c.actorId].spokenSources[l.b.event.id].speakerId}):l.b.event.people.includes(c.actorId)?"You were involved":"Your news"):null}));
  const previewIcons=busy&&["stage","drop"].includes(frame.phase)?frame.line.icons:hover||choices.find(l=>l.key==selected)?.icons||[];
  const latest=frame?.line||c.transcript.at(-1),pops=frame?.phase=="pop"?frame.line.pops:busy?[]:c.lastPops||[];
  const cells=frame?.phase=="pop"?poppingRow(frame.line,row):row.map(icon=>({icon}));
  const free=Math.max(0,p.max-p.resting-row.length),knownTastes=[...Object.entries(learned.topicTastes||{}).map(([key])=>({kind:"topic",key})),...Object.entries(learned.moodTastes||{}).map(([key])=>({kind:"mood",key}))];
  const incident=c.context?.kind=="warning"&&s.customs?.incidents.find(i=>i.id==c.context.incidentId),losses=incident&&warningConsequences(s,incident),elderWitness=incident&&villageElder(s,c.context.villageId)==c.npcId;
  const explain=icon=>setInfo(explainIcon(s,icon,learned));
  const speak=choice=>{if(busy||sending.current)return;sending.current=true;setSelected(null);setHover(null);setInfo("");s.ui.actions.choose_chat_line(choice);};
  const identity=displayName(s,c.npcId)!="an unknown person",village=s.villages?.[s.ecs.village[c.npcId]?.villageId]?.name;
  const description=[identity?lifeStageLabel(s.ecs.personable[c.npcId]?.age):"You have not been introduced",identity&&village, ...(learned.traits||[]).slice(0,2)].filter(Boolean).join(" · ");
  const focusKey=e=>{
    if(e.key=="Escape"){e.stopPropagation();s.ui.actions.close_chat();}
    if(e.key=="Tab") {
      const items=[...ref.current.querySelectorAll("button:not(:disabled), select, summary")].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);
      if(e.shiftKey&&(document.activeElement==first||document.activeElement==ref.current)){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement==last){e.preventDefault();first?.focus();}
    }
  };
  return <><div className="chat-backdrop"/><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={"Conversation with "+person} className="chat-panel" onKeyDown={focusKey}>
    <header className="chat-who"><div className="chat-portrait" aria-hidden="true">{/^an? /.test(first)?"?":first[0].toUpperCase()}</div><div><small>World paused</small><h2>{person}</h2><div className="chat-description">{description}</div></div><div className="chat-regard"><span>Regard</span><div className="chat-regard-bar" role="meter" aria-label={person+"’s regard for you"} aria-valuenow={regard} aria-valuemin={Math.min(0,regard)} aria-valuemax={Math.max(100,regard)}><div style={{width:Math.max(0,Math.min(100,regard))+"%"}}/></div><b>{Number(regard.toFixed(2))}</b></div></header>
    <div className="chat-known"><span>What you know:</span>{knownTastes.length?knownTastes.map(i=><ChatIcon key={iconKey(i)} icon={i} reaction={knownReaction(i,learned)} onExplain={explain}/>):<span>nothing yet</span>}</div>
    {latest&&<div className="chat-speech" data-line-id={latest.id} aria-live="polite"><span className="chat-by">{latest.speaker=="player"?"You":person}</span><Words text={latest.text}/></div>}
    <div className={"chat-incoming"+(frame?.phase=="drop"?" dropping":"")} aria-live="polite">{busy&&["stage","drop"].includes(frame.phase)&&frame.line.icons.length?<><span>{frame.line.speaker=="player"?"You add":first+" adds"}</span>{frame.line.icons.map((icon,n)=><ChatIcon key={n} icon={icon} large onExplain={explain}/>)}</>:<span className="chat-incoming-empty">Icons spoken appear here, then drop into the row.</span>}</div>
    <div className="chat-board"><div className="chat-boardhead"><span><b>The row</b> · match two of the same to clear them</span><span><b>{free}</b> of {p.max} slots free</span></div>
      <div className="chat-row" style={{"--slots":p.max}} aria-label="Conversation icon row">{cells.map(({icon,pop},n)=><div key={n} className={"chat-cell"+(pop?" popping":"")}><ChatIcon icon={icon} large reaction={knownReaction(icon,learned)} matches={icon.kind!="grievance"&&previewIcons.some(i=>iconKey(i)==iconKey(icon))} onExplain={explain}/>{pop&&<span className={"chat-burst "+(pop.amount>0?"positive":pop.amount<0?"negative":"neutral")}>{pop.amount>0?"+♥":pop.amount<0?"−♥":"·"}</span>}</div>)}{Array.from({length:p.resting},(_,i)=><span key={"rest"+i} className="chat-cell resting">Resting</span>)}{Array.from({length:Math.max(0,p.max-p.resting-cells.length)},(_,i)=><span key={"free"+i} className="chat-cell" aria-label="Free slot"/>)}</div>
    </div>
    {info&&<div className="chat-info" role="status">{info}</div>}
    <div className="chat-reactions" aria-live="polite">{pops.map((i,n)=><span key={n} className={i.amount>0?"positive":i.amount<0?"negative":"neutral"}>{iconLabel(s,i)} matched · {first}’s regard {signed(i.amount)}</span>)}</div>
    {!busy&&<>{c.lastSetback&&<p className="chat-setback" role="status">{c.lastSetback.message} −{c.lastSetback.cost} regard.</p>}{p.tired&&<p className="chat-notice">{"You're tired: short conversations"}</p>}
      {losses&&!c.context.resolved&&<p className="chat-notice">Goodwill −{losses.witness} with {elderWitness?"the elder, who saw you cutting":"this villager"}{!elderWitness&&<>; −{losses.elder} with the elder when told</>}. Cutting again after a warning costs more. Your cutting has stopped. Unclaimed woodland is free to use.</p>}
      {c.endReason?<p role="status" className="chat-notice">{c.endReason=="tired"?"You are tired. Choose Rest before a longer conversation.":c.endReason=="row_full"?"Their row filled. Let them rest before another chat.":c.endReason=="exchange_complete"?"You have finished this exchange. Let them go for now.":"There is no more news on this subject."} Choose End chat to return to the village.</p>:<div className="chat-choices">{choices.map(l=><ChatChoice key={l.key} line={l} preview={previewLine(s,l)} selected={selected==l.key} onSelect={setSelected} onSpeak={speak} onExplain={explain} onPreview={setHover} reaction={icon=>knownReaction(icon,learned)}/>)}</div>}
    </>}
    <footer className="chat-footer"><button disabled={c.expectation=="warning"} onClick={s.ui.actions.close_chat}>End chat</button><small>{row.length} occupied · {p.resting} resting · {p.max} patience slots</small></footer>
    <details className="chat-extras"><summary>Other subjects</summary><div className="chat-subjects">{Object.entries({family:"Family",work:"Work",news:"News",tell:"Tell",mood:"Moods",help:"Help",village:"Village",season:"Season"}).map(([key,label])=><button disabled={busy} key={key} onClick={()=>{setSelected(null);setHover(null);s.ui.actions.chat_focus(key);}}>{label}</button>)}</div><label>Ask about <select disabled={busy} value={c.subjectId||""} onChange={e=>{setSelected(null);setHover(null);s.ui.actions.chat_subject(e.target.value);}}><option value="">The village</option>{Object.keys(s.knowledge?.[c.actorId]?.people||{}).filter(id=>id!=c.actorId&&id!=c.npcId&&s.ecs.personable[id]).map(id=><option key={id} value={id}>{personLabel(s,id,id=>s.personName?.(id)||chatPersonName(s,id))}</option>)}</select></label></details>
    <button className="chat-details" onClick={()=>setDetails(!details)}>{details?"Hide tastes and spoken lines":"Known tastes and spoken lines"}</button>
    {details&&<div><p>{person}’s discovered tastes</p><TopicTastes personId={c.npcId} onExplain={explain}/><ol className="chat-transcript">{c.transcript.map((l,n)=><li key={l.id+n} data-line-id={l.id}><small>{l.speaker=="player"?"You":person}</small><Words text={l.text}/></li>)}</ol></div>}
  </section></>;
}
