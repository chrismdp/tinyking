import { woodTask } from "game/wood_task";
import { taskPlace } from "game/task_places";
import { peopleWorld } from "./support/people";
import { acceptTravel, completeTravel, departNpc } from "game/travel";
import { neighbours, worldKey } from "game/travel_geometry";
import { skipIntro } from "game/intro";
import { community as initialCommunity, attach } from "./support/travel";
import { newEntities } from "game/entities";
import { enqueueTask, readyPlayerTasks } from "game/manager";
import { die, createPossession } from "game/possessions";
import { resolveSuccession } from "game/succession";
import { advanceSeason } from "game/social";
import { topController } from "game/playable";
import { canPlaceShelter, workOnShelter } from "game/construction";
import { Hex } from "game/hex";

const community = (...args) => {
  const f=initialCommunity(...args);
  if(f.s.ui.playerId)f.s.ecs.playable[f.s.ui.playerId].arrivedAt=f.s.days;
  return f;
};

it("lets an inherited child move, talk and play explicitly while refusing adult work and courtship", () => {
  const {state:s,player,person,tiles,step}=peopleWorld();s.ecs.personable[player].age=10;s.ecs.personable[person].age=11;
  const move=enqueueTask(s,{key:"move_to_here"},tiles[1]);step(1);expect(move.progress).toBe(1);
  const position={...s.ecs.spatial[player]};step(1);expect(s.ecs.spatial[player]).toEqual(position);
  const chat=enqueueTask(s,{key:"chat"},person);step(2);expect(chat.progress).toBe(1);
  const play=enqueueTask(s,{key:"play"},person);step(2);expect(play.progress).toBe(1);
  for(const key of ["cut_tree_down","build_shelter","create_field","court","marry"])expect(enqueueTask(s,{key},person)).toBeNull();
  expect(enqueueTask(s,{key:"find_food"},player)).not.toBeNull();expect(enqueueTask(s,{key:"rest"},player)).not.toBeNull();
});
it("cancels dead actor promises without rewards, releases attention and keeps heir commitments and custody", async () => {
  const {s,ids:[player,heir,giver]}=community();s.ecs.kinship[player].spouse=heir;s.ecs.kinship[heir].spouse=player;
  s.favours={requests:{promise:{id:"promise",kind:"wood",status:"accepted",actorId:player,progress:0,cargo:[],giverId:giver}}};
  enqueueTask(s,{key:"give_gift"},giver,{gift:{type:"wood",sourceId:"missing"}});
  const [cargo]=newEntities(s,[{spatial:{...s.ecs.spatial[heir]},good:{type:"grain",amount:1},haulable:{heldBy:heir},controllable:{controllerId:giver}}]);
  s.ecs.holder[heir].held=[cargo];s.ecs.manager[heir].jobs=[{id:"own-commitment",job:{key:"move_to_here"},targetId:s.map.entrances[0].tileIds[2]}];
  s.ecs.planner[giver].world.capturedBy=player;die(s,player);await resolveSuccession(s);
  expect(s.favours.requests.promise.status).toBe("cancelled");expect(s.events.some(e=>e.type=="favour")).toBe(false);
  expect(s.ecs.manager[player].jobs).toEqual([]);expect(s.ecs.planner[giver].world.capturedBy).toBeNull();
  expect(s.ecs.manager[heir].jobs[0].id).toBe("own-commitment");expect(s.ecs.holder[heir].held).toEqual([cargo]);expect(s.ecs.controllable[cargo].controllerId).toBe(giver);
});
it("keeps the same assets through two natural seasonal deaths without controller cycles", async () => {
  const {s,ids:[a,b,c],house}=community();s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;s.ecs.kinship[b].children=[c];s.ecs.kinship[c].parents=[a,b];s.ecs.kinship[a].children=[c];
  s.ecs.controllable[house].controllerId=a;Object.assign(s.ecs.personable[a],{age:60,lifeYears:23});Object.assign(s.ecs.personable[b],{age:58,lifeYears:22});const item=createPossession(s,a,"Founder ring");
  for(const [season,dead,heir]of [[1,a,b],[2,b,c]]){
    s.days=season*3;Object.assign(s.ecs.personable[dead],{age:87,lifeYears:36.75});advanceSeason(s,season);await resolveSuccession(s);
    expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);expect(topController(s.ecs,heir)).toBe(heir);
  }
  expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([a,b,c]);
});
it("scopes shelter placement and camp bed replacement to the actual owner", () => {
  const {s,ids:[player,old],tiles}=community();const point=s.ecs.spatial[tiles[2]];
  const [oldCamp,camp,oldShelter]=newEntities(s,[{spatial:{...point,immovable:true},camp:{},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:old}},
    {spatial:{...s.ecs.spatial[tiles[3]],immovable:true},camp:{},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:player}},
    {spatial:{...s.ecs.spatial[tiles[1]],immovable:true},shelter:{stage:"hut"},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:old}}]);
  const target=tiles.find(id=>Hex().fromPoint(s.ecs.spatial[id]).distance(Hex().fromPoint(s.ecs.spatial[camp]))==2 && canPlaceShelter(s,id));
  expect(target).toBeDefined();
  const [site]=newEntities(s,[{spatial:{...s.ecs.spatial[target],immovable:true},shelter:{stage:null},nameable:{nickname:"Frame"},controllable:{controllerId:player}}]);
  s.ecs.container={};
  s.ecs.construction={[site]:{stage:"lean-to",delivered:4,work:1.99}};
  workOnShelter(s,player,s.ecs.planner[player].world,.01,false,site);
  expect(s.ecs.sleepable[oldCamp].capacity).toBe(1);expect(s.ecs.sleepable[camp].capacity).toBe(0);expect(s.ecs.shelter[oldShelter].stage).toBe("hut");
  expect(readyPlayerTasks(s)).toEqual([]);
});
it("reports a new stranger truthfully when the recorded heir also died before handover", async () => {
  const {s,ids:[a,b],house}=community();s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;s.ecs.controllable[house].controllerId=a;
  const ring=createPossession(s,a,"Extinct family's ring");die(s,a);die(s,b);await resolveSuccession(s);
  expect(s.ui.playerId).not.toBe(a);expect(s.ui.playerId).not.toBe(b);
  expect(s.events.filter(e=>e.type=="succession").at(-1).newStranger).toBe(true);
  expect(s.ui.successionMessage).toContain("A new stranger arrives");expect(s.ecs.possession[ring].ownerId).toBeNull();
  expect(s.ecs.controllable[house].controllerId).not.toBe(s.ui.playerId);
});
it("never gives a stranger the former player's remembered home when returning to another visited map", async () => {
  const {s,ids:[a],house}=community();s.ecs.controllable[house].controllerId=a;
  const other=community({namespace:"away-",key:worldKey(neighbours(s.world.home)[0]),player:false});attach(s,other.s);
  const trip=async side=>{expect(acceptTravel(s,s.map.entrances[side].tileIds[0])).toBe(true);await completeTravel(s,s.ecs.manager[s.ui.playerId].jobs[0]);skipIntro(s);};
  const life=s.ecs.personable[a].lifeYears;await trip(0);expect(s.ecs.personable[a].lifeYears).toBe(life+.25);die(s,a);await resolveSuccession(s);skipIntro(s);const stranger=s.ui.playerId;
  await trip(3);
  expect(s.ecs.household[stranger].houseId).not.toBe(house);
  expect(s.ecs.camp[s.ecs.household[stranger].houseId]).toBeDefined();
  expect(s.ecs.controllable[s.ecs.household[stranger].houseId].controllerId).toBe(stranger);
  expect(s.ecs.controllable[house].controllerId).not.toBe(stranger);
});
it("keeps each person's own membership record and clears pending decisions on a paused control transfer", async () => {
  const {s,ids:[a,b]}=community();s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;
  s.ecs.village[a].memberships={old:{day:0,elderId:"old-elder"}};
  s.ecs.village[b].memberships={own:{day:1,elderId:"own-elder"}};
  s.ui.resourceOrder={job:{key:"cut_tree_down"},targetId:"old-tree",villageId:"old"};s.ui.customsResult={speakerId:"old-elder",message:"Old decision"};
  die(s,a);await resolveSuccession(s);
  expect(s.ecs.village[b].memberships).toEqual({own:{day:1,elderId:"own-elder"}});
  expect(s.ecs.village[a].memberships).toEqual({old:{day:0,elderId:"old-elder"}});
  expect(s.ui.resourceOrder).toBeNull();expect(s.ui.customsResult).toBeNull();
});
it("uses the new actor's home for delivery ETA and geographic labels while an older estate remains", () => {
  const {state:s,player,person,tiles}=peopleWorld();
  const [oldCamp,camp,oldHouse,log]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},camp:{},controllable:{controllerId:person}},
    {spatial:{...s.ecs.spatial[tiles[5]]},camp:{},controllable:{controllerId:player}},
    {spatial:{...s.ecs.spatial[tiles[0]]},shelter:{stage:"house"},controllable:{controllerId:person}},
    {spatial:{...s.ecs.spatial[tiles[5]]},good:{type:"wood",amount:1},haulable:{heldBy:player},controllable:{controllerId:player}}]);
  s.ecs.household[player].houseId=camp;s.ecs.spatial[player]={...s.ecs.spatial[camp]};s.ecs.holder[player].held=[log];
  const job={job:{key:"cut_tree_down"},gatheredDone:true,gathered:[log],gatheredTotal:1};
  expect(woodTask(s,job,true).time).toBe("~1m to home");expect(taskPlace(s,camp)).toBe("at camp");
  expect(s.ecs.controllable[oldCamp].controllerId).toBe(person);expect(s.ecs.shelter[oldHouse].stage).toBe("house");
});
it("keeps an in-transit heir's recorded position and custody and pauses their real journey without adding time", async () => {
  const {s,ids:[a,b,c]}=community(),other=community({namespace:"road-",key:worldKey(neighbours(s.world.home)[0]),player:false});attach(s,other.s);
  s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;
  const [cargo]=newEntities(s,[{spatial:{...s.ecs.spatial[b]},good:{type:"grain",amount:1},haulable:{heldBy:b},controllable:{controllerId:c}}]);s.ecs.holder[b].held=[cargo];
  const point={...s.ecs.spatial[b]},day=s.days;departNpc(s,b,{to:other.s.map.worldKey,side:0});die(s,a);await resolveSuccession(s);
  expect(s.ui.playerId).toBe(b);expect(s.days).toBe(day);expect(s.ecs.spatial[b]).toEqual(point);
  expect(s.ecs.holder[b].held).toEqual([cargo]);expect(s.ecs.controllable[cargo].controllerId).toBe(c);
  expect(s.ecs.personable[b].pendingJourney).toMatchObject({to:other.s.map.worldKey,due:day+3});
  expect(s.travel.transit.some(t=>t.bundle.id==b)).toBe(false);
});
