import React from "react";
import PropTypes from "prop-types";
import { GameState } from "components/contexts";
import { TOPICS, chatChoices, previewLine, iconKey, chatPersonName, topicScore } from "game/chat";
import { patience } from "game/chat_patience";
import { displayName } from "game/knowledge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSitemap, faHammer, faSeedling, faUtensils, faCloudSun, faHome, faChurch, faComments, faHandsHelping, faUser } from "@fortawesome/free-solid-svg-icons";
const pictures={family:faSitemap,work:faHammer,harvest:faSeedling,food:faUtensils,season:faCloudSun,village:faHome,faith:faChurch,gossip:faComments,help:faHandsHelping};
const signed=n=>n>0?"+"+n:String(n);
function Words({text}) {return text.split(/(\*[^*]+\*)/).map((part,i)=>part.startsWith("*")?<em key={i}>{part.slice(1,-1)}</em>:part);}
Words.propTypes={text:PropTypes.string};
export function ChatIcon({icon,life,reaction,matches}) {
  const s=React.useContext(GameState),label=icon.kind=="topic"?TOPICS[icon.key]:chatPersonName(s,icon.personId);
  return <span data-matches={matches} className={"chat-icon "+(life===0?"faded":"")+(matches?" matching":"")} title={label+(matches?" · matches row":"")+(life==null?"":life==0?" · faded":" · "+life+" lines left")}><FontAwesomeIcon icon={icon.kind=="topic"?pictures[icon.key]:faUser}/><span>{label}</span>{matches&&<small>Matches row</small>}{life!=null&&<small>{life==0?"faded":life}</small>}{reaction!==undefined&&<small>{reaction===null?"?":signed(reaction)}</small>}</span>;
}
ChatIcon.propTypes={icon:PropTypes.object,life:PropTypes.number,reaction:PropTypes.number,matches:PropTypes.bool};
export function TopicTastes({personId}) {
  const s=React.useContext(GameState),known=s.knowledge?.[s.ui.playerId]?.people?.[personId]?.topicTastes||{};
  return <div className="topic-tastes" aria-label="Topic tastes">{Object.entries(TOPICS).map(([key])=><ChatIcon key={key} icon={{kind:"topic",key}} reaction={personId==s.ui.playerId?topicScore(s,personId,key):known[key]??null}/>)}</div>;
}
TopicTastes.propTypes={personId:PropTypes.string};
export function ChatPanel() {
  const s=React.useContext(GameState),c=s.chat?.active;
  const ref=React.useRef(null),[details,setDetails]=React.useState(false);
  React.useEffect(()=>{if(c)ref.current?.focus();},[c]);
  if(!c)return null;
  const p=patience(s,c.actorId,c.npcId),choices=chatChoices(s),latest=[...c.transcript].reverse().find(l=>l.speaker=="npc"&&l.family!="leave_taking"),farewell=[...c.transcript].reverse().find(l=>l.speaker=="npc"&&l.family=="leave_taking"),pops=c.lastPops||[];
  const person=displayName(s,c.npcId,id=>s.personName?.(id)||s.ecs.nameable[id]?.nickname||chatPersonName(s,id)),free=p.max-p.resting-c.row.length;
  const known=s.knowledge?.[c.actorId]?.people?.[c.npcId]?.topicTastes||{};
  return <><div className="chat-backdrop"/><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={"Conversation with "+person} className="chat-panel" onKeyDown={e=>{if(e.key=="Escape")s.ui.actions.close_chat();}}>
    <header><div><small>World paused</small><h2>{person}</h2></div><button onClick={s.ui.actions.close_chat}>End chat</button></header>
    <div className="chat-patience"><strong>Patience: {p.max} slots · {free} free</strong><small>{c.row.filter(i=>i.life>0).length} live · {c.row.filter(i=>!i.life).length} faded · {p.resting} resting</small></div>
    {p.tired&&<p>{"You're tired: short conversations"}</p>}
    {c.earlyHelpReaction&&<p role="status">{c.earlyHelpReaction}</p>}
    <div className="chat-row" aria-label="Conversation icon row">{Array.from({length:p.resting},(_,i)=><span key={"rest"+i} className="chat-cell resting">Resting</span>)}{c.row.map((i,n)=><ChatIcon key={n} icon={i} life={i.life}/>)}{Array.from({length:free},(_,i)=><span key={"free"+i} className="chat-cell">Free</span>)}</div>
    <p className="chat-rule">Match two icons to discover a taste. Green raises {person.split(" ")[0]}’s regard for you; red lowers it. Icons fade after three lines.</p>
    <div className="chat-reactions" aria-live="polite">{pops.map((i,n)=><span key={n} className={i.score>0?"positive":i.score<0?"negative":"neutral"}>{i.kind=="topic"?TOPICS[i.key]:chatPersonName(s,i.personId)} matched · {i.listenerId==c.actorId?"Your":person.split(" ")[0]+"’s"} regard {signed(i.amount)}</span>)}</div>
    {!!c.lastFades?.length&&<small>{c.lastFades.length} unmatched {c.lastFades.length==1?"icon faded":"icons faded"} out of the row.</small>}
    {latest?.family=="favour_ask" && c.transcript.filter(l=>l.family=="maternal_recognition").map(l=><p className="family-welcome" key={l.id}>{l.text}</p>)}
    {latest&&<p className="chat-speech" data-line-id={latest.id}><Words text={latest.text}/></p>}
    {farewell&&<p data-line-id={farewell.id}><Words text={farewell.text}/></p>}
    <p className="chat-next" role="status">{c.endReason?"Choose End chat to return to the village.":"Choose a line below."}</p>
    <div className="chat-scroll">{c.endReason?<p role="status">{c.endReason=="tired"?"You're tired. Choose Rest before a longer conversation.":c.endReason=="row_full"?"Their row is full. Let them rest before another chat.":c.endReason=="all_faded"?"The conversation has faded. Time to let them go.":"There is no more news on this subject."}</p>:<div className="chat-choices">{choices.map(l=>{const preview=previewLine(s,l);return <button key={l.key} data-line-id={l.id} data-family={l.family} disabled={!preview.fits} onClick={()=>s.ui.actions.choose_chat_line(l.key)}><Words text={l.text}/><span className="choice-icons">{l.icons.map(i=><ChatIcon key={iconKey(i)} icon={i} matches={preview.matchingKeys.includes(iconKey(i))} reaction={i.kind=="topic"?known[i.key]??null:undefined}/>)}</span><small>{l.icons.length} icons · {preview.matches} {preview.matches==1?"match":"matches"}{!preview.fits?" · not enough room":""}{l.resolve?" · queues real work and delivery":""}</small></button>;})}</div>}
      <details><summary>Other subjects</summary><div className="chat-subjects">{Object.entries({family:"Family",work:"Work",news:"News",help:"Help",village:"Village",season:"Season"}).map(([key,label])=><button key={key} onClick={()=>s.ui.actions.chat_focus(key)}>{label}</button>)}</div><label>Ask about <select value={c.subjectId||""} onChange={e=>s.ui.actions.chat_subject(e.target.value)}><option value="">The village</option>{Object.keys(s.knowledge?.[c.actorId]?.people||{}).filter(id=>id!=c.actorId&&id!=c.npcId&&s.ecs.personable[id]).map(id=><option key={id} value={id}>{displayName(s,id,id=>s.personName?.(id)||s.ecs.nameable[id]?.nickname||chatPersonName(s,id))}</option>)}</select></label></details>
      <button className="chat-details" onClick={()=>setDetails(!details)}>{details?"Back to choices":"Known tastes and spoken lines"}</button>
      {details&&<><p>{person}’s discovered tastes</p><TopicTastes personId={c.npcId}/><ol className="chat-transcript">{c.transcript.map(l=><li key={l.id} data-line-id={l.id}><small>{l.speaker=="player"?"You":person}</small><Words text={l.text}/></li>)}</ol></>}
    </div>
  </section></>;
}
