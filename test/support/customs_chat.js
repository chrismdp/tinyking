import { openChat, chatChoices, chooseLine, closeChat } from "game/chat";
export function discussOath(s,actor,npc,leave=false) {
  return {ok:openChat(s,actor,npc,{intent:leave?"leave":"oath"})};
}
export function respond(s,choice) {
  const line=chatChoices(s).find(l=>l.effects?.some(e=>e.op=="customs_response"&&e.choice==choice));
  if(!line)return false;
  const ok=chooseLine(s,line.key);
  if(ok)closeChat(s);
  return ok;
}
