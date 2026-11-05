import { community } from "./support/travel";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";
import { householdAccess } from "game/playable";
import { die, repairHouseholds } from "game/possessions";
import { advanceOffscreenNeeds } from "game/needs";
import { HOUR } from "game/time";
import { householdFood } from "game/favours";

function family() {
  const {s,house,ids:[a,b,c]}=community({player:false});
  s.ui.playerId="observer";
  // Keep this tiny fixture local. World travel is irrelevant to a meal.
  delete s.travel;
  s.residents={[a]:true,[b]:true,[c]:true};
  const [other,store]=newEntities(s,[{spatial:{...s.ecs.spatial[house]},building:{rooms:[]},household:{fields:[],backyards:[]},controllable:{controllerId:b},village:{villageId:"v"}},
    {spatial:{...s.ecs.spatial[house]},container:{capacity:100,amounts:{grain:12}},controllable:{controllerId:house},interior:{buildingId:house}}]);
  s.ecs.building[house].rooms=[store];s.ecs.household[house].storeId=store;
  s.ecs.household[b].houseId=other;s.ecs.household[c].houseId=other;
  s.ecs.controllable[house].controllerId=a;
  s.ecs.kinship[a].children=[b];s.ecs.kinship[b].parents=[a];
  for(const id of [a,b,c])s.ecs.personable[id].hunger=id==a?0:1.2;
  return {s,house,other,store,a,b,c};
}
function advance(s,hours) {
  const sim=createSimulation(s);
  for(let n=0;n<hours*60;n++)sim.tick();
}

it("lets an heir and their household eat a vacant inherited home's store without taking its fields or beds", () => {
  const {s,house,other,store,a,b,c}=family();
  die(s,a);repairHouseholds(s);
  expect(s.ecs.controllable[house].controllerId).toBe(b);
  expect(householdAccess(s.ecs,b,house)).toBe(false);
  advance(s,3);
  expect(s.ecs.personable[b].hunger).toBeLessThan(.2);
  expect(s.ecs.personable[c].hunger).toBeLessThan(.2);
  expect(s.ecs.container[store].amounts.grain).toBe(10);
  expect(s.ecs.household[b].houseId).toBe(other);
  expect(s.ecs.controllable[house].controllerId).toBe(b);
  expect(s.ecs.controllable[other].controllerId).toBe(b);
});

it("lets hungry kin take real surplus while keeping two meals for each donor resident", () => {
  const {s,store,b,c}=family();
  advance(s,3);
  expect(s.ecs.personable[b].hunger).toBeLessThan(.2);
  expect(s.ecs.personable[c].hunger).toBeLessThan(.2);
  expect(s.ecs.container[store].amounts.grain).toBe(10);
  s.ecs.container[store].amounts.grain=2;
  s.ecs.personable[b].hunger=1.2;
  advance(s,3);
  expect(s.ecs.container[store].amounts.grain).toBe(2);
  expect(s.ecs.personable[b].hunger).toBeGreaterThan(1.2);
});

it("does not grant a non-heir access to a vacant stranger's store", () => {
  const {s,store,a,b}=family();
  s.ecs.household[a].houseId=s.ecs.household[b].houseId;
  s.ecs.controllable[store].controllerId=store;
  s.ecs.controllable[s.ecs.interior[store].buildingId].controllerId=s.ecs.interior[store].buildingId;
  advance(s,3);
  expect(s.ecs.container[store].amounts.grain).toBe(12);
  expect(s.ecs.personable[b].hunger).toBeGreaterThan(1.2);
});

it("uses the same inherited-store permission for real offscreen meals", () => {
  const {s,store,a,b}=family();die(s,a);
  s.needsUpdatedAt=s.days;
  advanceOffscreenNeeds(s,s.days+HOUR);
  expect(s.ecs.personable[b].hunger).toBeLessThan(.1);
  expect(s.ecs.container[store].amounts.grain).toBe(10);
  // Stocks stay at their physical household until somebody collects a meal.
  expect(householdFood(s).get(s.ecs.interior[store].buildingId)).toBe(10);
});

it("sleeps at home on the first night and stays awake from nine to five the next day", () => {
  const {s,house,other,a,b,c}=family();
  newEntities(s,[house,other].map(home=>({spatial:{...s.ecs.spatial[home]},sleepable:{capacity:6,occupiers:[]},interior:{buildingId:home},controllable:{controllerId:home}})));
  for(const id of [a,b,c])s.ecs.personable[id].hunger=s.ecs.personable[id].tiredness=0;
  const daytimeAsleep=new Set(),nightAsleep=new Set();
  const sim=createSimulation(s,{onHour(){
    const hour=Math.round((s.days%1)*24)%24;
    for(const id of [a,b,c])if(s.ecs.planner[id].task?.[0]=="sleep") {
      if(hour==1)nightAsleep.add(id);
      if(s.days>=1 && hour>=9 && hour<17)daytimeAsleep.add(id);
    }
  }});
  for(let n=0;n<32*60;n++)sim.tick();
  expect(nightAsleep.size).toBe(3);
  expect(daytimeAsleep.size).toBe(0);
});

it("finishes a real villager meal before a new tiredness signal can apply its fed effect", () => {
  const {s,a,b,c}=family();
  s.ecs.personable[a].hunger=1.2;
  delete s.ecs.planner[b];delete s.ecs.planner[c];
  const sim=createSimulation(s);
  for(let n=0;n<30;n++)sim.tick();
  expect(s.ecs.planner[a].task?.[0]).toBe("eat");
  s.ecs.personable[a].tiredness=1;
  sim.tick();
  expect(s.ecs.planner[a].task?.[0]).toBe("eat");
  expect(s.ecs.personable[a].hunger).toBeGreaterThan(.9);
  for(let n=0;n<35;n++)sim.tick();
  expect(s.ecs.personable[a].hunger).toBeLessThan(.1);
});
