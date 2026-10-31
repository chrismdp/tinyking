jest.mock("../scripts/game-register",()=>({}));
import { discoverTimber, waitForOathReadiness } from "../scripts/acceptance-selection";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { resourcePermission, oathEligibility } from "game/village_customs";
import { community } from "./support/travel";
import { peopleWorld } from "./support/people";
import { enqueueTask } from "game/manager";
import { newEntities } from "game/entities";

function view() {
  const {s,ids:[player,neighbour],tiles}=community();
  newEntities(s,[{spatial:{...s.ecs.spatial[player]},camp:{},controllable:{controllerId:player}}]);
  s.villages={};
  const at=Hex().fromPoint(s.ecs.spatial[player]);
  s.ecs.playable[player].known=[{x:at.x,y:at.y},{x:at.x-1,y:at.y}];
  const [tree]=newEntities(s,[{spatial:{...Hex(at.x-1,at.y).toPoint()},tree:{},good:{type:"wood",amount:5}}]);
  const g={Hex,path};
  global.window={tinyking:s,tinykingGeography:g,tinykingCustoms:{resourcePermission}};
  const page={evaluate:async(fn,arg)=>fn(arg)};
  return {s,player,neighbour,tiles,tree,page,at};
}
afterEach(()=>{delete global.window;});

it("chooses a reachable known frontier outside the old eastern strip without looking at hidden trees",async()=>{
  const {s,tree,page,at}=view();
  // INITIAL map facts: the only legal wood is still hidden. This test observes
  // the selected move, not a fabricated exploration outcome.
  s.ecs.spatial[tree]={...Hex(at.x-3,at.y).toPoint()};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("observed first frontier order");})).rejects.toThrow("observed first frontier order");
  expect(moves).toHaveLength(1);
  expect(s.ecs.playable[s.ui.playerId].known.map(h=>String(Hex(h)))).toContain(String(Hex().fromPoint(s.ecs.spatial[moves[0]])));
  expect(s.ecs.spatial[moves[0]].x).toBeLessThanOrEqual(s.ecs.spatial[s.ui.playerId].x);
});

it("counts only discovered permitted reachable timber and does not edit discovery or stock",async()=>{
  const {s,tree,page,neighbour}=view(),known=JSON.stringify(s.ecs.playable[s.ui.playerId].known),goods=JSON.stringify(s.ecs.good);
  const steps=await discoverTimber(page,5);
  expect(steps[0].trees).toEqual([tree]);expect(steps[0].logs).toBe(5);
  expect(JSON.stringify(s.ecs.playable[s.ui.playerId].known)).toBe(known);expect(JSON.stringify(s.ecs.good)).toBe(goods);
  s.ecs.controllable[tree]={id:tree,controllerId:neighbour};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("private wood excluded");})).rejects.toThrow("private wood excluded");
  expect(moves).toHaveLength(1);
});

it("does not count known timber across a disconnected route",async()=>{
  const {s,tree,page}=view();
  const tile=(s.space[Hex().fromPoint(s.ecs.spatial[tree])] || []).find(id=>s.ecs.mappable[id]);
  for(const id of Object.keys(s.ecs.walkable))for(const [side,to]of Object.entries(s.ecs.walkable[id].neighbours))if(to==tile)delete s.ecs.walkable[id].neighbours[side];
  await expect(discoverTimber(page,5)).rejects.toThrow(/"logs":0/);
});

it("prefers an already known unclaimed frontier to exploring further into private land",async()=>{
  const {s,player,page,at}=view();
  s.ecs.playable[player].known.push({x:at.x+1,y:at.y},{x:at.x+2,y:at.y});
  s.ecs.household[player]={id:player}; // INITIAL stranger at the camp, outside that household.
  const home=Object.keys(s.ecs.building)[0];
  s.ecs.household[home].plot={hexes:[String(Hex(at.x-1,at.y)),String(Hex(at.x+1,at.y))]};
  const tree=Object.keys(s.ecs.tree)[0];s.ecs.spatial[tree]={...Hex(at.x-3,at.y).toPoint()};
  const moves=[];
  await expect(discoverTimber(page,5,async id=>{moves.push(id);throw new Error("frontier selected");})).rejects.toThrow("frontier selected");
  expect(resourcePermission(s,player,moves[0])).toMatchObject({kind:"unclaimed",permitted:true});
});

it("discovers native starting wood that has a standing wood good without a growth-stage tree component",async()=>{
  const {s,page,tree}=view();
  // INITIAL representation used by generateMap's existing arrival guarantee:
  // standing wood has good/spatial, while only ecological trees have tree.
  s.ecs.tree={};
  const steps=await discoverTimber(page,5);
  expect(steps[0].trees).toEqual([tree]);expect(steps[0].logs).toBe(5);
});

function oathCareWorld(unready) {
  const w=peopleWorld(),s=w.state,actor=w.player,elder=w.parent;
  // INITIAL night, real beds and a carried meal. Trust/contact are old fixture
  // facts; only native orders and NPC planning may produce recovery below.
  s.days=.9;
  const [house,playerBed,elderBed,meal]=newEntities(s,[
    {spatial:{...s.ecs.spatial[elder]},building:{rooms:[]},household:{},village:{villageId:"village"},controllable:{controllerId:elder}},
    {spatial:{...s.ecs.spatial[actor]},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:actor}},
    {spatial:{...s.ecs.spatial[elder]},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:elder}},
    {spatial:{...s.ecs.spatial[actor]},good:{type:"forage",amount:1},haulable:{heldBy:actor},controllable:{controllerId:actor}}
  ]);
  Object.assign(s.villages.village,{id:"village",houses:[house],sharedPlaces:[]});
  for(const id of [w.person,elder,w.sibling])s.ecs.household[id].houseId=house;
  s.ecs.household[actor]={houseId:null};s.ecs.village[actor]={villageId:null};
  s.ecs.holder[actor].held=[meal];
  s.ecs.planner[actor].world.places.sleep=playerBed;
  s.ecs.planner[elder].world.places.sleep=elderBed;
  for(const id of [actor,w.person,elder,w.sibling]) {
    s.ecs.planner[id].world.days=s.days;
    s.ecs.planner[id].world.feeling={hungry:unready && id==actor,tired:unready && [actor,elder].includes(id)};
    s.ecs.personable[id].hunger=unready && id==actor?1:0;
    s.ecs.personable[id].tiredness=unready && [actor,elder].includes(id)?1:0;
    if(![actor,elder].includes(id)){s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];}
  }
  s.ecs.relationships[elder].known[actor]={ring:"social",goodwill:12};
  s.knowledge={[actor]:{people:{[elder]:{traits:[],conversation:{day:-1}}},feelings:{}}};
  s.game_speed="paused";
  const orders=[];
  s.ui.actions={choose_job:(id,job,target)=>{expect(id).toBe(actor);orders.push(job.key);enqueueTask(s,job,target);},set_speed:speed=>{s.game_speed=speed;}};
  global.window={tinyking:s,tinykingCustoms:{oathEligibility}};
  const page={
    evaluate:async(fn,arg)=>JSON.parse(JSON.stringify(fn(arg) ?? null)),
    waitForFunction:async(fn,arg)=>{
      for(let minute=0;minute<24*60;minute++) {
        if(fn(arg))return;
        w.step(1/60);
      }
      throw new Error("Native care did not make both parties ready within the fixture night");
    }
  };
  return {s,actor,elder,meal,orders,page};
}

it("lets actual NPC sleep and ordinary player food/rest recover oath readiness without granting contact or rights",async()=>{
  const {s,actor,elder,meal,orders,page}=oathCareWorld(true);
  const before=JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events});
  const result=await waitForOathReadiness(page,elder,"village");
  expect(result.initial.readiness.ok).toBe(false);expect(result.after.readiness.ok).toBe(true);
  expect(orders).toEqual(["find_food","rest"]);
  expect(s.ecs.good[meal]).toBeUndefined();
  expect(s.ecs.personable[elder].tiredness).toBeLessThan(.2);
  expect(s.ecs.personable[actor].tiredness).toBeLessThan(.2);
  expect(s.ecs.planner[elder].world.feeling.tired).toBe(false);
  expect(s.game_speed).toBe("paused");expect(s.ecs.manager[actor].jobs).toEqual([]);
  expect(JSON.stringify({knowledge:s.knowledge,rights:s.ecs.village,events:s.events})).toBe(before);
});

it("leaves ready parties and their supplies alone before the real oath request",async()=>{
  const {s,elder,orders,page}=oathCareWorld(false),before=JSON.stringify(s);
  expect((await waitForOathReadiness(page,elder,"village")).orders).toEqual([]);
  expect(orders).toEqual([]);expect(JSON.stringify(s)).toBe(before);
});
