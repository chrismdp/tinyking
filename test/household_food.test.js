import { community } from "./support/travel";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";
import { householdAccess } from "game/playable";
import { die, repairHouseholds } from "game/possessions";
import { advanceOffscreenNeeds } from "game/needs";
import { HOUR } from "game/time";
import { householdFood } from "game/favours";
import { mealAccess } from "game/household_food";

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

it("lets an heir's close kin share the inherited surplus while preserving the heir household's meals", () => {
  const {s,house,store,a,b,c}=family();
  const [cottage]=newEntities(s,[{spatial:{...s.ecs.spatial[house]},building:{rooms:[store]},household:{storeId:store},controllable:{controllerId:a}}]);
  s.ecs.interior[store].buildingId=cottage;s.ecs.controllable[store].controllerId=cottage;
  delete s.ecs.household[house].storeId;
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

it("does not treat homeless people as the beneficiaries of an ownerless cottage", () => {
  const {s,house,store,a,b}=family();
  s.ecs.household[a].houseId=undefined;
  s.ecs.household[house]={storeId:store};
  s.ecs.controllable[house].controllerId=house;
  expect(mealAccess(s,b,store)).toBe(false);
});

it("lets local kin collect from an absent heir's real local store while protecting the heir's household", () => {
  const {s,house,store,a,b}=family();
  s.ecs.household[a].houseId="remote-home";
  s.residents[a]=false;
  s.travel={maps:{remote:{ecs:{personable:{[a]:s.ecs.personable[a]},household:{[a]:{houseId:"remote-home"}},controllable:{"remote-home":{controllerId:a}}},residents:{[a]:true}}}};
  expect(mealAccess(s,b,store)).toBe(true);
  s.ecs.container[store].amounts.grain=2;
  expect(mealAccess(s,b,store)).toBe(false);
  expect(s.ecs.controllable[house].controllerId).toBe(a);
});

it("recognises cousins through the existing kin rule when sharing food", () => {
  const {s,store,a,b}=family();
  s.ecs.kinship[a]={parents:["parent-a"],children:[],spouse:null};
  s.ecs.kinship[b]={parents:["parent-b"],children:[],spouse:null};
  s.ecs.kinship["parent-a"]={parents:["grandparent"],children:[a],spouse:null};
  s.ecs.kinship["parent-b"]={parents:["grandparent"],children:[b],spouse:null};
  expect(mealAccess(s,b,store)).toBe(true);
});

it("brings a spare real portion home from kin so that another housemate can eat", () => {
  const {s,other,store,a,b,c}=family();
  delete s.ecs.planner[c];
  const [pantry]=newEntities(s,[{spatial:{...s.ecs.spatial[other]},interior:{buildingId:other},container:{capacity:20,amounts:{}},controllable:{controllerId:other}}]);
  s.ecs.household[other].storeId=pantry;
  advance(s,3);
  expect(s.ecs.personable[b].hunger).toBeLessThan(.2);
  expect(s.ecs.container[store].amounts.grain).toBe(10);
  expect(s.ecs.container[pantry].amounts.grain).toBe(1);
  expect(s.ecs.holder[b].held).toEqual([]);
  expect(s.ecs.personable[a].hunger).toBeLessThan(.9);
});

it("restocks a low household from reachable kin before its residents are hungry", () => {
  const {s,other,store,b,c}=family();
  s.ui.playerId=c;s.ecs.playable[c]={known:[]};s.ecs.planner[c].world.ordered=true;s.ecs.manager[c].ordered=true;
  s.ecs.personable[b].hunger=s.ecs.personable[c].hunger=0;
  const [pantry]=newEntities(s,[{spatial:{...s.ecs.spatial[other]},interior:{buildingId:other},container:{capacity:20,amounts:{}},controllable:{controllerId:other}}]);
  s.ecs.household[other].storeId=pantry;
  advance(s,4);
  expect(s.ecs.container[pantry].amounts.grain).toBe(6);
  expect(s.ecs.container[store].amounts.grain).toBe(6);
  expect(s.ecs.holder[b].held).toEqual([]);
});

it("passes real surplus through a kin household instead of stranding it behind that household's reserve", () => {
  const {s,house,other,store,a,b,c}=family();
  s.ui.playerId=a;s.ecs.playable[a]={known:[]};s.ecs.planner[a].world.ordered=true;s.ecs.manager[a].ordered=true;
  for(const id of [b,c])s.ecs.personable[id].hunger=0;
  s.ecs.container[store].amounts.grain=20;
  const [third]=newEntities(s,[{spatial:{...s.ecs.spatial[house]},building:{rooms:[]},household:{},controllable:{controllerId:c},village:{villageId:"v"}}]);
  const [pantry,nextPantry]=newEntities(s,[other,third].map(home=>({spatial:{...s.ecs.spatial[home]},interior:{buildingId:home},container:{capacity:30,amounts:{}},controllable:{controllerId:home}})));
  s.ecs.household[other].storeId=pantry;s.ecs.household[third].storeId=nextPantry;s.ecs.household[c].houseId=third;
  s.ecs.kinship[b].spouse=c;s.ecs.kinship[c].spouse=b;
  expect(mealAccess(s,c,store)).toBe(false);
  advance(s,4);
  expect(s.ecs.container[nextPantry].amounts.grain).toBeGreaterThanOrEqual(2);
  expect(s.ecs.container[pantry].amounts.grain).toBeGreaterThanOrEqual(2);
  expect(Object.values(s.ecs.container).reduce((n,box)=>n+(box.amounts.grain || 0),0)).toBe(20);
});
