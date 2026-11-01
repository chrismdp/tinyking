// Recovery is integrated before each relationship drift interval, including
// offscreen seasons. Fractional credit is measured in cells, not clock hours.
export const MIN_CHAT_SLOTS=3;
export function slotRate(s, actor, npc) {
  const b=s.ecs.relationships?.[npc]?.known[actor], g=b?.goodwill || 0;
  switch(b?.ring) {
  case "intimate": return g>=90 ? [12,.5] : g>=75 ? [11,.75] : [10,1];
  case "personal": return g>=45 ? [9,1.5] : [8,2];
  case "social": return g>=20 ? [8,3] : [7,4];
  default: return g>=5 ? [6,5] : [6,6];
  }
}
export function chatRecord(s,actor,npc) {
  s.chat ||= {version:1,pairs:{}};
  return s.chat.pairs[actor+":"+npc] ||= {actorId:actor,npcId:npc,resting:0,credit:0,encounters:0,used:{},last:{}};
}
export function patience(s,actor,npc) {
  const [usualMax,hours]=slotRate(s,actor,npc), r=s.chat?.pairs?.[actor+":"+npc];
  const tiredness=s.ecs.personable?.[actor]?.tiredness || 0;
  const max=tiredness>1.8?2:tiredness>1.2?Math.max(2,Math.floor(usualMax/2)):usualMax;
  const minimum=Math.min(MIN_CHAT_SLOTS,max);
  const reserve=s.chat?.active?.required&&s.chat.active.actorId==actor&&s.chat.active.npcId==npc?2:0;
  const resting=Math.min(Math.max(0,max-reserve),r?.resting || 0),free=max-resting;
  return {max,minimum,hours,resting,free,tired:tiredness>1.2,readyIn:Math.max(0,minimum-free-(r?.credit||0))*hours};
}
export function recoverSlots(s,hours) {
  if(hours<=0 || s.chat?.active)return;
  for(const r of Object.values(s.chat?.pairs || {})) {
    const [max,rate]=slotRate(s,r.actorId,r.npcId);
    r.resting=Math.min(max,r.resting);
    if(!r.resting){r.credit=0;continue;}
    r.credit+=hours/rate;
    const n=Math.min(r.resting,Math.floor(r.credit+1e-9));
    r.resting-=n;r.credit=r.resting ? Math.max(0,r.credit-n) : 0;
  }
}
