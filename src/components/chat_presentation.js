import { TOPICS, MOODS, iconKey, chatPersonName } from "game/chat";
import { personLabel } from "game/knowledge";

export const iconLabel=(s,icon)=>icon.kind=="topic"?TOPICS[icon.key]:icon.kind=="mood"?MOODS[icon.key]:icon.kind=="grievance"?"Grievance":icon.personId==s.ui.playerId?"You":personLabel(s,icon.personId,id=>chatPersonName(s,id));
export function knownReaction(icon,learned={}) {
  if(icon.kind=="topic")return learned.topicTastes?.[icon.key]??null;
  if(icon.kind=="mood")return learned.moodTastes?.[icon.key]??null;
  return learned.personReactions?.[icon.personId]?.score??null;
}
export function explainIcon(s,icon,learned) {
  const label=iconLabel(s,icon),who=iconLabel(s,{kind:"person",personId:s.chat.active.npcId});
  if(icon.kind=="grievance")return "Grievance: locked. It cannot match and takes a slot until this chat ends.";
  const score=knownReaction(icon,learned),kind=icon.kind=="person"?"person":icon.kind;
  return `${label}: a ${kind}. `+(score===null?`You do not yet know how ${who} feels about this. Match a pair to find out.`:score>0?`${who} likes this. A pair raises regard.`:score<0?`${who} dislikes this. A pair lowers regard.`:`${who} feels neutral. A pair costs 0.25 regard.`);
}
export function presentChoices(s,choices,c=s.chat.active) {
  const male=s.ecs.nameable[c.npcId]?.male,pronoun=male===true?"he":male===false?"she":null;
  const ordered=choices.map(line=>({...line,title:line.text,answer:line.answers?.includes(c.expectation)?`Answers what ${pronoun||iconLabel(s,{kind:"person",personId:c.npcId})} said`:null})).sort((a,b)=>Number(!!b.answer)-Number(!!a.answer));
  const result=[];
  for(const line of ordered) {
    if(line.family!="gossip_tell"&&result.some(l=>l.text==line.text&&l.family!="gossip_tell"))continue;
    const siblings=ordered.filter(l=>l.text==line.text&&l.family=="gossip_tell");
    if(siblings.length>1) {
      const event=line.b.event,date=event.when_exact||`Day ${Math.floor(event.day)+1}`;
      const sameDate=siblings.filter(l=>(l.b.event.when_exact||`Day ${Math.floor(l.b.event.day)+1}`)==date);
      line.title+=` · ${date}`+(sameDate.length>1?` · account ${sameDate.findIndex(l=>l.key==line.key)+1} of ${sameDate.length}`:"");
    }
    result.push(line);
  }
  return result;
}

// Plays committed game results in speech order. Timers never change game state.
export function createChatPlayback(update) {
  const queue=[];let timer=null,disposed=false,lastView;
  const later=(fn,ms)=>{timer=setTimeout(()=>{if(!disposed)fn();},ms);};
  const next=()=>{
    const spoken=queue.shift();if(!spoken)return;
    const line=spoken.presentation?.icons?{...spoken,icons:spoken.presentation.icons}:spoken;
    const before=line.presentation?.before||lastView,after=line.presentation?.after||before;
    const frame=phase=>update({line,phase,view:phase=="settle"?after:before,busy:true});
    frame("stage");
    later(()=>{
      frame("drop");
      later(()=>{
        frame("pop");
        later(()=>{
          lastView=after;frame("settle");
          later(()=>{timer=null;if(queue.length)next();else update({line,phase:"idle",view:after,busy:false});},250);
        },line.pops?.length?600:200);
      },line.icons?.length?350:0);
    },line.icons?.length?1100:400);
  };
  return {
    enqueue(lines){if(disposed)return;queue.push(...lines);if(timer===null&&queue.length)next();},
    dispose(){disposed=true;clearTimeout(timer);queue.length=0;}
  };
}

export function poppingRow(line,row) {
  const result=row.map(icon=>({icon,pop:null}));
  const pending=[...(line.pops||[])];
  for(const icon of line.icons||[]) {
    const at=icon.kind=="grievance"?-1:result.findIndex(cell=>!cell.pop&&iconKey(cell.icon)==iconKey(icon));
    if(at<0)result.push({icon,pop:null});
    else result[at].pop=pending.splice(pending.findIndex(p=>iconKey(p)==iconKey(icon)),1)[0]||{...icon,amount:0};
  }
  return result;
}
