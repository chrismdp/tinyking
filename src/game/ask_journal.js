import { askNextStep } from "game/ask_steps";
import { name } from "game/name";
import { displayName } from "game/knowledge";
import { personComponent } from "game/residents";
import { knownEvents, eventText } from "game/events";
import { visibleFavours, favourTitle } from "game/favours";

const personName = (s,id) => {
  const record=personComponent(s,"nameable",id);
  return record ? name(record) : "someone";
};
export function describePerson(s,id) {
  if(id===s.ui.playerId)return "you";
  const named=displayName(s,id,x=>personName(s,x));
  if(named && named!=="an unknown person")return named;
  const p=personComponent(s,"personable",id),n=personComponent(s,"nameable",id);
  if(!p || p.unrevealed)return "someone";
  const a=p.age,m=n?.male;
  if(a<13)return m===true?"a boy":m===false?"a girl":"a child";
  if(a<20)return m===true?"a young man":m===false?"a young woman":"a young person";
  return (m===true?"a man in his ":m===false?"a woman in her ":"a person in their ")+(a<30?"twenties":a<40?"thirties":a<50?"forties":a<60?"fifties":a<70?"sixties":"old age");
}
// A name heard in a story belongs in the journal even when the player would
// not yet recognise that person's face in the lane.
export function knownPersonName(s,id) {
  if(id===s.ui.playerId)return "You";
  if(s.knowledge?.[s.ui.playerId]?.people?.[id]?.nameOnly)return personName(s,id);
  const named=displayName(s,id,x=>personName(s,x));
  return named==="an unknown person"?"Unknown":named;
}
export function asksJournal(s, requests=visibleFavours(s)) {
  return requests.map(r=>{
    const remembered=s.dayBook?.askWords?.[r.id];
    const related=knownEvents(s,s.ui.playerId).filter(e=>e.id===r.eventId || ((e.people?.includes(r.targetId)||e.people?.includes(r.giverId)) && e.day>= (r.createdDay??0)));
    const completed={peace:"You kept your promise. They made peace.",word:"You kept your promise. The news reached them.",visit:"You kept your promise. You spent time together.",find:"You kept your promise. You found news of them."}[r.kind]||"You kept your promise. The household received your help.";
    return {id:r.id,giverId:remembered?.speakerId||r.giverId,targetId:r.targetId,targetName:remembered?.targetName||describePerson(s,r.targetId),title:favourTitle(r),status:r.status,
      words:remembered?.text||null,context:r.reason,nextStep:askNextStep(s,r),
      learned:related.map(e=>eventText(s,e,id=>describePerson(s,id))),
      outcome:r.status==="completed"?completed:r.status==="accepted"?(r.progress>0?"You have delivered some of what they asked for. Your promise is still open.":"You promised to help."):r.status==="offered"?"They are waiting for your answer.":r.outcome?.split(" · ")[0]||"The ask has come to an end."};
  });
}
