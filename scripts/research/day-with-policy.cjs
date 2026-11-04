/* eslint-disable no-undef */
function policy(s,menu,helpful,memory,state) {
  const available=menu.choices.filter(c=>c.available);
  const intervention=available.find(c=>["make_peace","introduce"].includes(c.activity) && !state.completedPairs?.has(key(c.personId,c.otherId)));
  if(helpful&&intervention)return intervention;
  const work=available.find(c=>c.activity=="work");if(work)return work;
  const canTry=id=>!menu.choices.some(c=>c.personId==id && c.activity=="talk" && c.reason.includes("tastes and disposition"));
  const candidates=menu.choices.filter(c=>["make_peace","introduce"].includes(c.activity) && canTry(c.personId) && canTry(c.otherId));
  const chooseTargets=()=>{
    const rejected=state.rejectedPairs || new Set();
    const pair=candidates.find(c=>!rejected.has(key(c.personId,c.otherId)));
    return pair ? [pair.personId,pair.otherId] : [];
  };
  if(helpful && !state.targets?.length) {
    const remembered=(memory?.targets || []).filter(canTry);
    state.targets=remembered.length>=2 ? remembered.slice(0,2) : chooseTargets();
  }
  const current=candidates.find(c=>state.targets?.includes(c.personId)&&state.targets?.includes(c.otherId));
  if(current && ["They must be unrelated single adults free to court","They are not willing, compatible partners"].includes(current.reason)) {
    (state.rejectedPairs ||= new Set()).add(key(current.personId,current.otherId));state.targets=chooseTargets();
  }
  const targets=state.targets || [];
  // Memory names people learned in the first game. Trust still has to be
  // earned in this game, with real gifts, offers and conversation matches.
  const hungry=new Set(Object.values(memory?.needs || s.knowledge?.[s.ui.playerId]?.heardNeeds || {}).filter(n=>n.kind=="food").map(n=>n.askerId));
  const priority=id=>targets.includes(id)?50-targets.indexOf(id):0;
  const visits=available.filter(c=>["give_food","ask_favour","talk"].includes(c.activity));
  const rank=c=>{
    const id=c.personId,b=s.ecs.relationships[id]?.known[s.ui.playerId],n=state.visits[id]||0;
    const trust=b?.ring=="personal"||b?.ring=="intimate";
    return (helpful?priority(id):0)+(helpful&&c.activity=="give_food"&&!trust?8+(hungry.has(id)?6:0):0)+(helpful&&c.activity=="ask_favour"?3:0)-n*(helpful&&priority(id)?1:8)
      -(trust&&helpful?15:0)-(c.activity=="give_food"&&!helpful?100:0);
  };
  visits.sort((a,b)=>rank(b)-rank(a)||a.id.localeCompare(b.id));
  const point=s.ecs.spatial[s.ui.playerId];
  const ground=available.filter(c=>c.activity=="visit").sort((a,b)=>{
    const distance=c=>(s.ecs.spatial[c.placeId].x-point.x)**2+(s.ecs.spatial[c.placeId].y-point.y)**2;
    return distance(b)-distance(a);
  });
  return visits[0] || ground[0] || available[0];
}
module.exports={policy};
