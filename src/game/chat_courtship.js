import WORDS from "data/courtship_lines.json";
import { RINGS, relationshipCap, goodwillTowards } from "game/people";
import { knownEvents } from "game/events";
import { personLabel } from "game/knowledge";
import { marriageTasteReason, canMarryPlayer } from "game/family";

const rank=(s,a,b)=>Math.max(0,RINGS.indexOf(s.ecs.relationships?.[a]?.known[b]?.ring));

// These are the player's discoveries, never the villager's undisclosed records.
export function courtingExchanges(s,c) {
  const a=c.actorId,b=c.npcId,stage=RINGS[Math.min(rank(s,a,b),rank(s,b,a))];
  const k=s.knowledge?.[a]||{},learned=k.people?.[b]||{},memories=[];
  for(const link of Object.values(k.kinLinks||{}))if(link.speaker_id==b) {
    memories.push({memory:"family",factId:link.relative_id,line:WORDS.memories[stage].family.replace("{name}",personLabel(s,link.relative_id))});
  }
  for(const trait of learned.traits||[])memories.push({memory:"trait",factId:trait,line:WORDS.memories[stage].trait.replace("{trait}",trait)});
  if(learned.trade)memories.push({memory:"work",factId:learned.trade,line:WORDS.memories[stage].work.replace("{trade}",learned.trade)});
  for(const event of knownEvents(s,a))if(k.spokenSources?.[event.id]?.speakerId==b && event.people?.length) {
    memories.push({memory:"news",factId:event.id,line:WORDS.memories[stage].news.replace("{name}",personLabel(s,event.people[0]))});
  }
  const lines=[...memories,...WORDS[stage].lines.map(line=>({line}))];
  return lines.map((line,index)=>({...line,stage,id:stage+":"+index}));
}

// Take the reply's feelings after the exchange, including a newly reached ring.
// The pair's used keys preserve the spoken line across saves and later visits.
export function courtingResult(s,c,exchange,result) {
  const a=c.actorId,b=c.npcId,listenerRing=RINGS[rank(s,b,a)];
  let barrier=null,reason=null;
  if(!result.ok) {
    barrier=relationshipCap(s,b,a)<2?"listener_taste":relationshipCap(s,a,b)<2?"player_taste":"eligibility";
    reason=marriageTasteReason(s,a,b)||result.message;
  } else if(goodwillTowards(s,a,b)<0||goodwillTowards(s,b,a)<0)barrier="ill_will";
  else if(rank(s,b,a)<2)barrier="listener_closeness";
  else if(rank(s,a,b)<2)barrier="player_closeness";
  else if(!canMarryPlayer(s,a,b))barrier="eligibility";
  reason ||= WORDS.barriers[barrier]||null;
  const replies=WORDS[listenerRing].replies,index=Number(exchange?.id.split(":").at(-1))||0;
  const answer=result.ok?replies[index%replies.length]:"";
  return {barrier,reason,listenerRing,reply:[answer,reason].filter(Boolean).join(" ")};
}
