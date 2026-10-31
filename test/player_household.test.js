import { newEntities } from "game/entities";
import { community } from "./support/travel";
import { foundHousehold, familyConversation } from "game/family";
import { topController } from "game/playable";
import { createPossession } from "game/possessions";

it("founds a local village only from the player's own completed house, then accepts a willing friend without taking their old estate", () => {
  const {s,house,ids:[player,friend]}=community();
  expect(foundHousehold(s)).toBe(false);
  s.ecs.shelter={[house]:{stage:"house"}};s.ecs.controllable[house].controllerId=player;s.ecs.village[house].villageId=null;s.ecs.sleepable={[house]:{capacity:6,occupiers:[]}};
  const [oldHome]=newEntities(s,[{spatial:{...s.ecs.spatial[friend],immovable:true},building:{rooms:[]},controllable:{controllerId:friend},village:{villageId:"v"}}]);
  s.ecs.household[friend].houseId=oldHome;
  const item=createPossession(s,friend,"Friend's tool");
  s.ecs.village[player].memberships={earlier:{day:0,elderId:friend}};
  expect(foundHousehold(s)).toBe(true);
  expect(s.ecs.village[player].memberships).toEqual({earlier:{day:0,elderId:friend}});const village=s.ecs.village[house].villageId;
  expect(s.villages[village].houses).toEqual([house]);expect(s.ecs.village[player].villageId).toBe(village);
  expect(foundHousehold(s)).toBe(false);
  expect(familyConversation(s,player,friend,"invite_home").ok).toBe(false);
  for(const [a,b]of [[player,friend],[friend,player]])s.ecs.relationships[a].known[b]={ring:"personal",goodwill:36,base:36};
  expect(familyConversation(s,player,friend,"invite_home").ok).toBe(true);
  expect(s.ecs.household[friend].houseId).toBe(house);expect(s.ecs.possession[item].ownerId).toBe(friend);
  expect(s.ecs.controllable[oldHome].controllerId).toBe(friend);
  expect(topController(s.ecs,player)).toBe(player);expect(s.events.some(e=>e.type=="settlement")).toBe(true);
});
it("uses actual beds in an inherited home, counts local residents only, and refuses a genuinely full home", () => {
  const {s,house,ids:[a,b]}=community();s.ecs.controllable[house].controllerId=a;
  const [oldHome,bed]=newEntities(s,[{spatial:{...s.ecs.spatial[b]},building:{rooms:[]},controllable:{controllerId:b},village:{villageId:"v"}},
    {spatial:{...s.ecs.spatial[house]},sleepable:{capacity:6,occupiers:[]},interior:{buildingId:house},controllable:{controllerId:house}}]);
  s.ecs.building[house].rooms=[bed];s.ecs.household[b].houseId=oldHome;
  for(const [x,y]of [[a,b],[b,a]])s.ecs.relationships[x].known[y]={ring:"personal",goodwill:36,base:36};
  const occupants=newEntities(s,Array.from({length:4},()=>({personable:{age:20},household:{houseId:house},controllable:{}})));
  for(const id of occupants){s.residents[id]=true;s.ecs.controllable[id].controllerId=id;}
  expect(familyConversation(s,a,b,"invite_home").ok).toBe(false);
  const [reference]=newEntities(s,[{personable:{age:20},household:{houseId:house},controllable:{}}]);s.residents[reference]=false;
  s.ecs.sleepable[bed].capacity=7;
  expect(familyConversation(s,a,b,"invite_home").ok).toBe(true);
  expect(s.ecs.household[b].houseId).toBe(house);expect(s.ecs.controllable[oldHome].controllerId).toBe(b);
});
