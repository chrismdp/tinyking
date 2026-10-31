/* eslint-disable no-undef */
// Labelled INITIAL setup only, using a real generated village, tree and adult.
// No outcomes, goodwill, knowledge, membership, favours or rewards are granted.
// Acceptance: await require('./scripts/customs-fixture').customsFixture(page).
async function customsFixture(page) {
  return page.evaluate(() => {
    const s=window.tinyking,c=window.tinykingCustoms,g=window.tinykingGeography,e=s.ecs;
    s.ui.actions.set_speed("paused");
    const candidates=Object.keys(e.tree || {}).filter(id=>e.good[id] && c.resourcePermission(s,s.ui.playerId,id).kind=="common");
    const pair=candidates.flatMap(tree=>{
      const v=c.resourcePermission(s,s.ui.playerId,tree).villageId,elder=c.villageElder(s,v);
      return Object.keys(e.personable).filter(id=>id!=elder && !e.playable?.[id] && !e.personable[id].dead && e.personable[id].age>=18 &&
        e.village[id]?.villageId==v && e.planner[id] && e.spatial[id]).map(person=>({tree,person,elder,v,
        distance:Math.hypot(e.spatial[tree].x-e.spatial[person].x,e.spatial[tree].y-e.spatial[person].y)}));
    }).sort((a,b)=>a.distance-b.distance)[0];
    if(!pair)throw Error("No actual common tree/adult pair in this initial map");
    const point=e.spatial[pair.tree];
    // A visitor at the woodland edge, and a local pausing nearby before work.
    Object.assign(e.spatial[s.ui.playerId],{x:point.x,y:point.y});
    const treeTile=(s.space[g.Hex().fromPoint(point)] || []).find(id=>e.walkable[id]);
    const neighbour=Object.values(e.walkable[treeTile].neighbours).find(id=>!e.mappable[id]?.cropPlot);
    if(!neighbour)throw Error("Fixture tree has no free adjoining path");
    Object.assign(e.spatial[pair.person],{x:e.spatial[neighbour].x,y:e.spatial[neighbour].y});
    delete e.interior?.[pair.person];
    const p=e.planner[pair.person];
    p.world.currentJob=null;p.world.claimedFarmable=null;p.world.social=null;p.world.helpingFriend=null;
    p.world.feeling={};p.task=["wait_for",1/24];p.plan=[];
    e.personable[pair.person].hunger=0;e.personable[pair.person].tiredness=0;
    // Reveal only local visible ground, as an initial fixture, to inspect rights.
    for(const tile of Object.keys(e.walkable))if(Math.hypot(e.spatial[tile].x-point.x,e.spatial[tile].y-point.y)<550) {
      const hex=g.Hex().fromPoint(e.spatial[tile]);
      if(!e.playable[s.ui.playerId].known.some(h=>h.x==hex.x&&h.y==hex.y))e.playable[s.ui.playerId].known.push(hex);
    }
    s.redraws.push(s.ui.playerId,pair.person);
    s.renderer.focusOn(point,900);
    s.ui.actions.select_entity(pair.tree,false);
    return {...pair,initialPositions:Object.fromEntries(Object.keys(e.personable).filter(id=>e.spatial[id]).map(id=>[id,{x:e.spatial[id].x,y:e.spatial[id].y}])),treeAmount:e.good[pair.tree].amount,playerId:s.ui.playerId,village:s.villages[pair.v].name,
      initial:"Generated people/plots/tree; visitor placed at tree; actual local adult rests on an adjoining walkable tile. No earned outcomes supplied."};
  });
}
module.exports={customsFixture};
