import { community } from "./support/travel";
import { newEntities } from "game/entities";
import { createSimulation } from "game/simulation";
import { advanceSeason } from "game/social";
import { resolveSuccession } from "game/succession";
import { enqueueTask } from "game/manager";
import { resourcePermission, membership, answerCustoms, villageElder } from "game/village_customs";
import { Hex } from "game/hex";

function fixture() {
  const {s,ids:[a,b,c],house,tiles}=community();
  s.ecs.playable[a].arrivedAt=s.days;
  s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;
  const site=tiles.find(id=>Hex().fromPoint(s.ecs.spatial[id]).distance(Hex().fromPoint(s.ecs.spatial[house]))>=5);
  const [ownHome]=newEntities(s,[{spatial:{...s.ecs.spatial[site],immovable:true},building:{rooms:[]},household:{fields:[],backyards:[]},village:{villageId:"own"},controllable:{controllerId:b}}]);
  s.villages.own={id:"own",name:"Own village",centre:{x:Hex().fromPoint(s.ecs.spatial[site]).x,y:Hex().fromPoint(s.ecs.spatial[site]).y},houses:[ownHome],sharedPlaces:[]};
  s.ecs.household[b].houseId=ownHome;s.ecs.village[b]={...s.ecs.village[b],villageId:"own",memberships:{own:{day:s.days,elderId:c}}};
  s.ecs.village[a]={...s.ecs.village[a],villageId:null,memberships:{earlier:{day:0,elderId:c}}};s.ecs.household[a].houseId=null;
  s.ecs.spatial[b]={...s.ecs.spatial[site],id:b};
  const near=tiles.find(id=>Hex().fromPoint(s.ecs.spatial[id]).distance(Hex().fromPoint(s.ecs.spatial[house]))==1);
  const ownNear=tiles.find(id=>Hex().fromPoint(s.ecs.spatial[id]).distance(Hex().fromPoint(s.ecs.spatial[site]))==1 && Hex().fromPoint(s.ecs.spatial[id]).distance(Hex().fromPoint(s.ecs.spatial[house]))>2);
  const [tree,ownTree]=newEntities(s,[near,ownNear].map(id=>({spatial:{...s.ecs.spatial[id],immovable:true},tree:{},good:{type:"wood",amount:10}})));
  s.ecs.spatial[a]={...s.ecs.spatial[near],id:a};
  const sim=createSimulation(s);
  const until=predicate=>{for(let n=0;n<1200&&!predicate();n++)sim.step(1);expect(predicate()).toBeTruthy();};
  const succeed=async()=>{s.game_speed="paused";s.days=3;Object.assign(s.ecs.personable[a],{age:87,lifeYears:36.75});advanceSeason(s,1);await resolveSuccession(s);};
  return {s,a,b,c,tree,ownTree,until,succeed};
}
it("keeps the heir's actual oath and rejects the dead actor's oath under real membership and resource permission rules",async()=>{
  const {s,a,b,tree,ownTree,succeed}=fixture();
  s.ecs.village[a].memberships.v={day:0,elderId:villageElder(s,"v")};
  expect(resourcePermission(s,a,tree)).toMatchObject({kind:"common",villageId:"v",permitted:true});
  expect(resourcePermission(s,b,tree).permitted).toBe(false);
  await succeed();
  expect(s.ui.playerId).toBe(b);expect(membership(s,b,"earlier")).toBeNull();expect(membership(s,b,"v")).toBeNull();
  expect(membership(s,b,"own")).toBe("oath");expect(resourcePermission(s,b,ownTree).permitted).toBe(true);expect(resourcePermission(s,b,tree).permitted).toBe(false);
  expect(s.ecs.village[a].memberships.v).toBeDefined();
});
it.each(["warning","oath"])("releases an actual held %s encounter before a paused handover and prevents answering for the dead actor",async kind=>{
  const {s,a,b,c,tree,until,succeed}=fixture();
  if(kind=="warning")enqueueTask(s,{key:"cut_tree_down"},tree);
  else {
    enqueueTask(s,{key:"chat"},c);until(()=>!!s.knowledge?.[a]?.people?.[c]?.conversation);
    enqueueTask(s,{key:"village_oath"},c);
  }
  until(()=>s.customs?.dialogue?.kind==kind);
  const speaker=s.customs.dialogue.speakerId;expect(s.ecs.planner[speaker].world.customsHold).toBe(true);
  s.ui.resourceOrder={job:{key:"cut_tree_down"},targetId:tree,villageId:"v"};s.ui.customsResult={speakerId:speaker,message:"Old actor"};
  await succeed();
  expect(s.ui.playerId).toBe(b);expect(s.game_speed).toBe("paused");expect(s.customs.dialogue).toBeUndefined();
  expect(s.ecs.planner[speaker].world.customsHold).toBeUndefined();expect(s.ecs.planner[speaker].world.customsVisit).toBeUndefined();
  expect(s.ui.resourceOrder).toBeNull();expect(s.ui.customsResult).toBeNull();expect(answerCustoms(s,"accept")).toBe(false);
  expect(membership(s,b,"v")).toBeNull();expect(membership(s,b,"own")).toBe("oath");
  expect(s.ecs.manager[a].jobs).toEqual([]);
  if(kind=="warning")expect(s.customs.incidents.every(i=>i.actorId!=a || i.status=="done")).toBe(true);
});
