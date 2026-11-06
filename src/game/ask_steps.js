import { peaceUnavailable } from "game/social_interventions";
import { displayName } from "game/knowledge";

// Conversation and journal read the same live conditions. A promise is not a job.
export function askNextStep(s, r) {
  if (r.status != "accepted") return null;
  const who = id => displayName(s,id);
  if (r.kind == "peace") {
    const reason = peaceUnavailable(s,r.actorId,r.giverId,r.targetId,{whenFree:true});
    return {ready:!reason,text:reason || `Ask ${who(r.giverId)} or ${who(r.targetId)} to come and talk together under Help or Family.`};
  }
  if (r.kind == "word") return {ready:true,text:`Talk to ${who(r.targetId)}. Choose Tell to pass on the news for ${who(r.giverId)}.`};
  if (r.kind == "visit") return {ready:true,text:`Find ${who(r.targetId)} and spend a conversation with them.`};
  if (r.kind == "find") return {ready:true,text:`Ask about ${who(r.targetId)}, or find them and talk. You need news since they left.`};
  return null;
}
