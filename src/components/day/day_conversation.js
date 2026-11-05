import React from "react";
import PropTypes from "prop-types";
import { chatChoices, previewLine, iconKey, patience } from "game/chat";
import { describePerson } from "game/day_view";
import { createChatPlayback, presentChoices, iconLabel, knownReaction, explainIcon, poppingRow } from "../chat_presentation";
import { Face } from "./day_reference";

function usePlayback(c) {
  const [frame,setFrame]=React.useState(null),play=React.useRef(null),seen=React.useRef(0);
  const key=c.actorId+":"+c.npcId+":"+c.encounter,count=c.transcript.length;
  React.useEffect(()=>{seen.current=0;play.current=createChatPlayback(f=>setFrame({...f,key}));return ()=>play.current.dispose();},[key]);
  React.useEffect(()=>{play.current.enqueue(c.transcript.slice(seen.current));seen.current=count;},[key,count,c]);
  return frame?.key===key?frame:null;
}
export function DayConversation({game,conversation:c,done,onSay,onContinue,redraw}) {
  // The last conversation object stays on screen while its final real lines
  // finish playing, even after playSlot has closed it and passed the time.
  const s={...game,chat:{...game.chat,active:c}},frame=usePlayback(c),[info,setInfo]=React.useState(""),[selected,setSelected]=React.useState(null),sent=React.useRef(false),count=c.transcript.length;
  React.useEffect(()=>{sent.current=false;setSelected(null);},[count,done]);
  const npc=describePerson(s,c.npcId),p=patience(s,c.actorId,c.npcId),learned=frame?.view?.learned||s.knowledge?.[c.actorId]?.people?.[c.npcId]||{},row=frame?.view?.row||c.row;
  const busy=!!frame?.busy,free=p.max-p.resting-row.length,choices=done?[]:presentChoices(s,chatChoices(s));
  const cells=frame?.phase==="pop"?poppingRow(frame.line,row):row.map(icon=>({icon}));
  const explain=icon=>setInfo(explainIcon(s,icon,learned));
  const speak=key=>{if(sent.current||busy)return;sent.current=true;onSay(key);};
  const currentIndex=frame?c.transcript.indexOf(frame.line):-1;
  // Playback may decorate a line. Use the id and last visible index instead.
  const showThrough=busy?Math.max(0,currentIndex>=0?currentIndex:c.transcript.findIndex(l=>l.id===frame.line.id)):c.transcript.length-1;
  const topics=[[null,"This moment"],["family","Family"],["work","Work"],["news","News"],["help","Help"],["village","Village"],["season","Season"],["mood","Moods"],["tell","Tell"]];
  return <section className="day-conversation" aria-label={"Conversation with "+npc}>
    <div className="day-scenehead"><div className="day-label reed">Time spent together</div><div className="day-talking-head"><Face game={s} id={c.npcId}/><h1>Talking with {npc}</h1></div></div>
    <div className="day-chat-log day-log" aria-live="polite">{c.transcript.slice(0,showThrough+1).map((l,i)=><p key={i} className={l.speaker==="player"?"day-player-speech":""}><span>{l.speaker==="player"?"You":npc}:</span> {l.text}</p>)}</div>
    <div className="day-boardhead"><span className="day-label">What has been said</span><span>{free<=0?"Their row is full":free<=2?"They will not listen for much longer":"They will listen a while yet"}</span></div>
    <div className={"day-incoming "+(frame?.phase==="drop"?"dropping":"")} aria-label="Icons about to land">{busy&&["stage","drop"].includes(frame.phase)?<><small>{frame.line.speaker==="player"?"Your words":"Their words"}</small>{frame.line.icons.map((icon,i)=><Icon key={i} game={s} icon={icon} learned={learned} onExplain={explain}/>)}</>:<small>Two of the same clear space. A full row brings the talk to an end.</small>}</div>
    <div className="day-row" style={{"--slots":p.max}} aria-label="Conversation icon row" data-phase={frame?.phase||"idle"}>{cells.map(({icon,pop},i)=><div key={i} className={"day-sock "+(pop?"day-pop "+(pop.score>0?"good":pop.score<0?"bad":"neutral"):"")}><Icon game={s} icon={icon} learned={learned} onExplain={explain}/></div>)}{Array.from({length:Math.max(0,p.max-cells.length)},(_,i)=><div key={"empty"+i} className={"day-sock "+(i<p.resting?"resting":"")}>{i<p.resting?"Rest":""}</div>)}</div>
    {frame?.phase==="pop"&&frame.line.pops?.map((pop,i)=><p key={i} className={"day-reaction "+(pop.score>0?"good":pop.score<0?"bad":"neutral")}>{npc}{pop.score>0?" warms to ":pop.score<0?" cools at ":" has no strong feelings about "}{iconLabel(s,pop)}.</p>)}
    {info&&<p className="day-icon-info" role="status">{info}</p>}
    {done?<><p className="day-note">{c.endReason==="row_full"?"The row is full. You leave them to the rest of their day.":"The talk comes to an end. The day goes on."}</p><button className="day-gold" disabled={busy} onClick={onContinue}>Continue the day</button></>:
      <><div className="day-label">What do you say?</div><nav className="day-topics" aria-label="Conversation subjects">{topics.map(([value,label])=><button key={label} disabled={busy} className={c.focus===value?"on":""} onClick={()=>{c.focus=value;setSelected(null);redraw();}}>{label}</button>)}</nav>
        {!busy&&<div className="day-replies">{choices.map(l=>{const preview=previewLine(s,l);return <div className={"day-reply "+(selected===l.key?"selected":"")} key={l.key}><button className="day-reply-text" disabled={!preview.fits} onClick={()=>setSelected(l.key)}>{l.title}</button><div className="day-reply-icons">{l.icons.map((icon,i)=><Icon key={i} game={s} icon={icon} learned={learned} matches={preview.matchingKeys.includes(iconKey(icon))} onExplain={explain}/>)}</div>{l.answer&&<small className="reed">{l.answer}</small>}{l.risk&&<small className="day-risk">{l.risk.message}</small>}{!preview.fits&&<small>There is no room for these words.</small>}{selected===l.key&&<button className="day-gold" onClick={()=>speak(l.key)}>Say this</button>}</div>;})}{!choices.length&&<p className="day-note">There is nothing more to say on this subject. Choose another subject.</p>}</div>}
        <button className="day-text-button" disabled={busy||!!c.expectation||!!c.closingReply} onClick={()=>speak(null)}>{c.expectation?"They are waiting for your answer":"Leave the conversation"}</button>
      </>}
  </section>;
}
DayConversation.propTypes={game:PropTypes.object,conversation:PropTypes.object,done:PropTypes.bool,onSay:PropTypes.func,onContinue:PropTypes.func,redraw:PropTypes.func};
function Icon({game:s,icon,learned,matches,onExplain}) {
  const label=iconLabel(s,icon)||icon.key||"Grievance",reaction=knownReaction(icon,learned);
  return <button className={"day-icon "+icon.kind+(matches?" matching":"")} title={label} onClick={()=>onExplain(icon)}>{icon.kind==="person"&&<Face game={s} id={icon.personId}/>}<span>{label}</span><small>{icon.kind==="grievance"?"!":reaction===null?"?":reaction>0?"♥":reaction<0?"×":"·"}{matches?" ◆":""}</small></button>;
}
Icon.propTypes={game:PropTypes.object,icon:PropTypes.object,learned:PropTypes.object,matches:PropTypes.bool,onExplain:PropTypes.func};
