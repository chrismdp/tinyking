import { playerCourtship } from "game/player_courtship";
import WORDS from "data/courtship_lines.json";
import { RINGS, relationshipCap, goodwillTowards } from "game/people";
import { chatRecord } from "game/chat_patience";
import { eventText } from "game/events";
import { knownEvents } from "game/events";
import { personLabel } from "game/knowledge";
import { marriageTasteReason, marriageReason } from "game/family";

const rank=(s,a,b)=>Math.max(0,RINGS.indexOf(s.ecs.relationships?.[a]?.known[b]?.ring));

// These are the player's discoveries, never the villager's undisclosed records.
export function courtingExchanges(s,c) {
  const a=c.actorId,b=c.npcId,stage=playerCourtship(s,a,b).stage;
  const k=s.knowledge?.[a]||{},learned=k.people?.[b]||{},memories=[];
  const bind=(text,facts)=>text.replace(/\{(\w+)\}/g,(_,key)=>facts[key]);
  const memory=(kind,factId,facts)=>memories.push({memory:kind,factId,
    line:bind(WORDS.memories[stage][kind],facts),reply:bind(WORDS[stage].memoryReplies[kind],facts),refusal:bind(WORDS[stage].memoryRefusals[kind],facts)});
  for(const link of Object.values(k.kinLinks||{}))if(link.speaker_id==b)
    memory("family",link.relative_id,{name:personLabel(s,link.relative_id)});
  for(const trait of learned.traits||[])memory("trait",trait,{trait,trait_reply:WORDS.traitReplies[trait]||`You have noticed my ${trait} ways.`});
  if(learned.trade)memory("work",learned.trade,{trade:learned.trade});
  for(const event of knownEvents(s,a))if(k.spokenSources?.[event.id]?.speakerId==b && event.people?.length)
    memory("news",event.id,{name:personLabel(s,event.people[0]),news:eventText(s,event,id=>personLabel(s,id),"chat").replace(/[.!]$/,"")});
  const lines=[...memories,...WORDS[stage].lines];
  const used=s.chat?.pairs?.[a+":"+b]?.courtingReplies?.[stage]||[];
  return lines.map((line,index)=>({...line,stage,id:stage+":"+index})).filter(line=>!used.includes(line.reply));
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
  else if(!playerCourtship(s,a,b).ready)barrier="courtship_time";
  reason ||= barrier=="courtship_time"?marriageReason(s,a,b):WORDS.barriers[barrier]||null;
  const answer=result.ok?exchange?.reply:exchange?.refusal;
  return {barrier,reason,listenerRing,reply:[answer,reason].filter(Boolean).join(" ")};
}

export function rememberCourtingReply(s,c) {
  const exchange=c.romanceExchange;if(!exchange)return;
  const pair=chatRecord(s,c.actorId,c.npcId);
  const used=(pair.courtingReplies ||= {})[exchange.stage] ||= [];
  if(!used.includes(exchange.reply))used.push(exchange.reply);
}
