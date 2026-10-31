import { community } from "./support/travel";
import { newEntities } from "game/entities";
import { workOnShelter, STAGES, deliveryHome } from "game/construction";
import { foundHousehold, familyConversation } from "game/family";
import { householdStore } from "game/favours";
import { generateVillageLife, settlementLayoutInputs } from "game/villages";
import { settleSeason } from "game/settlement";
import { historyStep } from "game/social";
import { HOUR } from "game/time";
import { trade_work } from "game/tasks";
import { growBuildings } from "game/settlement_growth";
import { Task } from "game/htn";
import { villageArea, centreHousehold } from "game/settlement_details";

function completedHome({layoutNpc=true}={}) {
  const {s,house:other,ids:[player,neighbour]}=community();
  // INITIAL unit supplies: another family's real room store and a funded
  // final-stage construction order. No completed home or layout is injected.
  const [room,home]=newEntities(s,[
    {spatial:{...s.ecs.spatial[other]},interior:{buildingId:other},container:{capacity:200,amounts:{grain:77,wood:29}},controllable:{controllerId:other}},
    {spatial:{...s.ecs.spatial[other],x:s.ecs.spatial[other].x+200,immovable:true},shelter:{stage:"hut"},sleepable:{capacity:1,occupiers:[]},nameable:{nickname:"Hut"},controllable:{controllerId:player},container:{capacity:20,amounts:{grain:17,wood:3}}}
  ]);
  s.ecs.building[other].rooms=[room];s.ecs.building[other].entrance=0;
  s.ecs.household[other].storeId=room;
  s.ecs.construction={[home]:{id:home,stage:"house",delivered:STAGES.house.logs,work:0}};
  s.ecs.manager[player].jobs=[{targetId:home,assignedId:player}];
  s.days=1.25;
  expect(workOnShelter(s,player,s.ecs.planner[player].world,STAGES.house.hours*HOUR,true,home)).toBe(Task.FINISH);
  expect(s.ecs.building[home].rooms).toEqual([]);
  // INITIAL unit ration load after completion: 16 grain, within the real
  // expanded capacity. Native planting and summary meals spend this stock.
  s.ecs.container[home].amounts.grain+=16;
  // Establish the existing NPC estate through its native layout first.
  if(layoutNpc)generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);
  return {s,home,other,room,player,neighbour};
}

it("records the actual completion and present founding date without adding an ancient household",()=>{
  const {s,home,player}=completedHome();
  expect(s.ecs.growth[home].builtDay).toBe(1.25);
  const built=s.events.find(e=>e.type=="house_built" && e.houseId==home);
  expect(built).toMatchObject({day:1.25,people:[player],timber:20});
  s.days=1.5;
  const people=Object.keys(s.ecs.personable), homes=Object.keys(s.ecs.building);
  expect(foundHousehold(s)).toBe(true);
  const village=s.villages[s.ecs.village[home].villageId];
  expect(village.origin).toMatchObject({day:1.5,people:[player],houseId:home,centreHex:expect.any(String),reason:expect.any(String)});
  expect(village.houses).toEqual([home]);
  expect(Object.keys(s.ecs.personable)).toEqual(people);
  expect(Object.keys(s.ecs.building)).toEqual(homes);
  expect(foundHousehold(s)).toBe(false);
  expect(s.events.filter(e=>e.type=="settlement")).toHaveLength(1);
});

it("uses the completed inline store through founding, native layout, active seasons and immutable offscreen catch-up",()=>{
  const {s,home,other,room,player}=completedHome();
  const stock=s.ecs.container[home],amounts=stock.amounts,foreign=JSON.stringify(s.ecs.container[room]),owner=s.ecs.controllable[home].controllerId;
  expect(householdStore(s,home)).toBe(home);
  expect(householdStore(s,other)).toBe(room);
  expect(deliveryHome(s,player)).toBe(home);
  expect(foundHousehold(s)).toBe(true);
  const village=s.villages[s.ecs.village[home].villageId],origin=JSON.stringify(village.origin);
  s.settlement={version:1,lastSeason:0,journeys:[],appliedJourneys:{},sites:{},estatesInitialized:true,layoutDirty:true};
  generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);
  delete s.settlement.layoutDirty;
  expect(s.ecs.household[home].storeId).toBe(home);
  expect(s.ecs.container[home]).toBe(stock);expect(stock.amounts).toBe(amounts);
  const seeded=[...s.ecs.household[home].fields,...s.ecs.household[home].backyards].reduce((n,id)=>n+(s.ecs.farmable?.[id]?.slots.filter(slot=>slot.state=="sown").length || 0),0);
  expect(seeded).toBeGreaterThan(0);expect(stock.amounts.grain).toBe(33-seeded);
  expect(stock.amounts.wood).toBe(3);expect(stock.capacity).toBe(40);
  expect(JSON.stringify(s.ecs.container[room])).toBe(foreign);
  expect(s.ecs.controllable[home].controllerId).toBe(owner);
  expect(village.houses).toEqual([home]);expect(villageArea(s,village.id).length).toBeGreaterThan(0);
  expect(centreHousehold(s,village.id).ownerId).toBe(player);
  expect(JSON.stringify(village.origin)).toBe(origin);
  expect(()=>settlementLayoutInputs(s)).not.toThrow();
  s.days=3;settleSeason(s,1,false);
  expect(s.ecs.growth[home].builtDay).toBe(1.25);
  expect(s.ecs.container[home]).toBe(stock);expect(JSON.stringify(s.ecs.container[room])).toBe(foreign);
  const before=JSON.stringify(s),next=historyStep(s,2);
  expect(JSON.stringify(s)).toBe(before);
  expect(next.ecs.household[home].storeId).toBe(home);
  expect(next.ecs.container[home].capacity).toBe(40);
  expect(next.ecs.container[home].amounts.grain).toBeLessThan(stock.amounts.grain);
  expect(next.ecs.controllable[home].controllerId).toBe(owner);
  expect(next.ecs.growth[home].builtDay).toBe(1.25);
  expect(next.villages[village.id].houses).toEqual([home]);
  expect(historyStep(next,2)).toEqual(next);
});

it("adds beds to a real inline home only after supported paid growth and leaves the other estate and an unfunded workshop alone",()=>{
  const {s,home,other,room,player,neighbour}=completedHome({layoutNpc:false});
  // INITIAL unit supplies: six timber in the existing 40-place house store,
  // willing Personal friends and a weaver's station with zero production.
  s.ecs.container[home].amounts.wood=6;
  for(const [a,b]of [[player,neighbour],[neighbour,player]])s.ecs.relationships[a].known[b]={ring:"personal",goodwill:36,base:36};
  expect(foundHousehold(s)).toBe(true);
  expect(familyConversation(s,player,neighbour,"invite_home").ok).toBe(true);
  const [station,bed]=newEntities(s,[{spatial:{...s.ecs.spatial[home],x:s.ecs.spatial[home].x+150,y:s.ecs.spatial[home].y+80},workplace:{houseId:home,trade:"weaver"},controllable:{controllerId:home}},
    {spatial:{...s.ecs.spatial[other]},interior:{buildingId:other},sleepable:{capacity:6,occupiers:[]},controllable:{controllerId:other}}]);
  // INITIAL worker position at this actual station, before any output.
  Object.assign(s.ecs.spatial[neighbour],s.ecs.spatial[station],{id:neighbour});
  s.ecs.building[other].rooms.push(bed);
  s.ecs.household[home].trade="weaver";s.ecs.household[home].workplaceId=station;
  const foreign=JSON.stringify({store:s.ecs.container[room],home:s.ecs.building[other],bed:s.ecs.sleepable[bed],owner:s.ecs.controllable[other]});
  for(let season=1;season<=4;season++) {
    s.days=season*3-.5;
    expect(trade_work(s,neighbour,{ordered:false},HOUR/2,true,station)).toBe(Task.FINISH);
    s.days=season*3;growBuildings(s,season);
  }
  expect(s.ecs.growth[home].stage).toBe(1);
  expect(s.ecs.growth[home].additions[0]).toMatchObject({timber:6,storeId:home});
  expect(s.ecs.sleepable[home].capacity).toBe(8);
  expect(s.ecs.container[home]).toMatchObject({capacity:52,amounts:{wood:0,grain:33}});
  expect(s.ecs.controllable[home].controllerId).toBe(player);
  expect(s.ecs.building[home].rooms).toEqual([]);
  expect(s.ecs.growth[station].stage).toBe(0);
  expect(s.ecs.growth[station].waiting).toBe("Needs 6 stored timber");
  expect(JSON.stringify({store:s.ecs.container[room],home:s.ecs.building[other],bed:s.ecs.sleepable[bed],owner:s.ecs.controllable[other]})).toBe(foreign);
});
