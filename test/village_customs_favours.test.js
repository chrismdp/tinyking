import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { updateFavours, acceptFavour, canRequestForHousehold } from "game/favours";
import { enqueueTask } from "game/manager";
import { addGoodwill } from "game/people";

function householdNeed() {
  const w=peopleWorld(),s=w.state;
  const [house,store,workplace,camp]=newEntities(s,[
    {spatial:{...s.ecs.spatial[w.tiles[3]]},building:{},household:{fields:[]},controllable:{controllerId:w.parent}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},container:{amounts:{grain:30},capacity:100},controllable:{controllerId:w.parent}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},workplace:{trade:"baker"},controllable:{controllerId:w.parent}},
    {spatial:{...s.ecs.spatial[w.tiles[0]]},container:{amounts:{wood:1,grain:5},capacity:20},camp:{},controllable:{controllerId:w.player}}
  ]);
  Object.assign(s.ecs.household[house],{storeId:store,workplaceId:workplace});s.ecs.workplace[workplace].houseId=house;
  for(const id of [w.person,w.parent,w.sibling])s.ecs.household[id].houseId=house;
  s.ecs.household[w.player].houseId=null;
  s.ecs.spatial[w.player]={...s.ecs.spatial[w.tiles[2]]};
  s.ecs.playable[w.player].known=w.tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  updateFavours(s);
  return {...w,house,store,camp,request:Object.values(s.favours.requests).find(r=>r.kind=="wood")};
}
function until(w,fn){for(let i=0;i<1000&&!fn();i++)w.step(.01);expect(fn()).toBeTruthy();}
it("lets a met adult ask for a real shared household need, with the normal reward only after delivery",()=>{
  const w=householdNeed(),s=w.state,r=w.request;
  expect(r.giverId).toBe(w.parent);
  expect(canRequestForHousehold(s,r,w.person)).toBe(false);
  enqueueTask(s,{key:"chat"},w.person);until(w,()=>!!s.knowledge?.[w.player]?.people?.[w.person]?.conversation);
  // A real prior directional loss, repaired by real fuel delivery.
  addGoodwill(s,w.player,w.person,-3);
  const before=s.ecs.relationships[w.person].known[w.player].goodwill;
  const task=acceptFavour(s,r.id,w.person);
  expect(task.forId).toBe(w.person);
  expect(s.ecs.container[w.camp].amounts.wood).toBe(1);
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBe(before);
  until(w,()=>r.status=="completed");
  expect(s.ecs.container[w.store].amounts.wood).toBe(1);
  expect(s.ecs.container[w.camp].amounts.wood).toBe(0);
  expect(s.ecs.relationships[w.person].known[w.player].goodwill).toBeGreaterThan(before+11.8);
  expect(s.ecs.relationships[w.parent].known[w.player]).toBeUndefined();
});
it("rejects a child, stranger, remote reference or unrelated household as the requester",()=>{
  const w=householdNeed(),s=w.state,r=w.request;
  expect(acceptFavour(s,r.id,w.person)).toBe(null);
  s.knowledge[w.player].people[w.person]={conversation:{day:s.days}};
  s.ecs.personable[w.person].age=12;
  expect(acceptFavour(s,r.id,w.person)).toBe(null);
  s.ecs.personable[w.person].age=30;s.residents={[w.player]:true,[w.parent]:true};
  expect(acceptFavour(s,r.id,w.person)).toBe(null);
  delete s.residents;s.ecs.household[w.person].houseId=null;
  expect(acceptFavour(s,r.id,w.person)).toBe(null);
  expect(r.status).toBe("offered");
});
