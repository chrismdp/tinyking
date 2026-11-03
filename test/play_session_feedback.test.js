import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { Task } from "game/htn";
import { walk_to } from "game/tasks";
import { fenceFootprints, fenceRoute, fenceSegments } from "game/fences";
import { occupiedHomes } from "game/home";
import { openingGuidance, dismissGuidance } from "game/guidance";

it.each([0.5,1,2])("moves player and NPC at exactly 0.8 of the old physical rate on terrain %s", terrain => {
  const {state:s,player,person:a,tiles}=peopleWorld();
  for(const nav of Object.values(s.ecs.walkable))nav.speed=terrain;
  for(const id of [player,a]) {
    Object.assign(s.ecs.spatial[id],s.ecs.spatial[tiles[0]]);
    const before={...s.ecs.spatial[id]},dt=1/86400;
    walk_to(s,id,s.ecs.planner[id].world,dt,true,tiles[5]);
    expect(Math.hypot(s.ecs.spatial[id].x-before.x,s.ecs.spatial[id].y-before.y)).toBeCloseTo(dt*24*20*60*terrain*.8,8);
  }
});

it("detours around an enclosure and enters/leaves only by the shared visible gate", () => {
  const {state:s,tiles}=peopleWorld();
  const [pen]=newEntities(s,[{spatial:{x:180,y:100},pasture:{halfWidth:39,halfDepth:34}}]);
  const fences=fenceFootprints(s), f=fences.find(f=>f.id==pen);
  const outside={x:120,y:100},across={x:240,y:100};
  const route=fenceRoute(s,outside,across);
  expect(route.length).toBeGreaterThan(1);
  expect(route.some(p=>Math.abs(p.y-100)>34)).toBe(true);
  const enter=fenceRoute(s,outside,{x:180,y:100});
  expect(enter.some(p=>p.y>134 && Math.abs(p.x-180)<1)).toBe(true);
  expect(fenceSegments(f).some(([a,b])=>a.y==134&&b.y==134&&a.x<180&&b.x>180)).toBe(false);
  s.ecs.pasture[pen].halfWidth=48;
  expect(fenceFootprints(s).find(f=>f.id==pen).halfWidth).toBe(48);
  expect(tiles.length).toBe(6);
});

it("walks home physically at night, hides only after arrival and lights actual occupancy; player stays put", () => {
  const {state:s,person:a,player,tiles,step}=peopleWorld();
  const [home]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[4]]},building:{entrance:1,rooms:[]}}]);
  s.ecs.household[a].houseId=home;s.days=21.1/24;
  for(const p of Object.values(s.ecs.planner))p.world.days=s.days;
  Object.assign(s.ecs.spatial[a],s.ecs.spatial[tiles[0]]);
  const start={...s.ecs.spatial[a]},playerStart={...s.ecs.spatial[player]};
  // Check the actual home walker, then let the ordinary planner finish arrival.
  require("game/tasks").home_downtime(s,a,s.ecs.planner[a].world,1/1440,true,home);
  expect(s.ecs.spatial[a]).not.toEqual(start);
  expect(s.ecs.interior?.[a]).toBeUndefined();
  expect(occupiedHomes(s).has(home)).toBe(false);
  step(2);
  expect(Math.hypot(s.ecs.spatial[a].x-s.ecs.spatial[home].x,s.ecs.spatial[a].y-s.ecs.spatial[home].y)).toBeLessThan(10);
  expect(s.ecs.interior[a].buildingId).toBe(home);
  expect(occupiedHomes(s).has(home)).toBe(true);
  expect(s.ecs.spatial[player]).toEqual(playerStart);
  s.days=12/24;expect(occupiedHomes(s).size).toBe(0);
  s.days=23/24;s.ecs.personable[a].dead=true;expect(occupiedHomes(s).has(home)).toBe(false);
});

it("replans cached physical routes when fence dimensions change, with real gate arrival", () => {
  const {state:s,player,tiles}=peopleWorld();
  const centre=s.ecs.spatial[tiles[2]];
  const [pen]=newEntities(s,[{spatial:{...centre},pasture:{halfWidth:30,halfDepth:25}}]);
  const w=s.ecs.planner[player].world;
  walk_to(s,player,w,1/86400,true,pen);
  const revision=w.routeFences;
  s.ecs.pasture[pen].halfWidth=40;
  walk_to(s,player,w,1/86400,false,pen);
  expect(w.routeFences).not.toBe(revision);
  let result;
  for(let i=0;i<2000&&result!=Task.FINISH;i++)result=walk_to(s,player,w,1/86400,false,pen);
  expect(result).toBe(Task.FINISH);
  expect(Math.hypot(s.ecs.spatial[player].x-centre.x,s.ecs.spatial[player].y-centre.y)).toBeLessThan(10);
});

it("keeps concrete actor-specific guidance after conversations and dismissal", () => {
  const {state:s,player,person:a,tiles}=peopleWorld();
  s.intro={active:false};
  s.ecs.playable[player].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  expect(openingGuidance(s).key).toBe("chat");
  s.knowledge={[player]:{people:{[a]:{conversation:{day:s.days}}}}};
  expect(openingGuidance(s).key).toBe("chat");
  const house=s.ecs.household[a].houseId;
  s.ecs.container ||= {};s.ecs.container[house]={amounts:{},capacity:20};s.ecs.household[house]={storeId:house,fields:[]};
  require("game/favours").updateFavours(s);
  const r=Object.values(s.favours.requests).find(r=>r.kind=="food");
  s.knowledge[player].heardNeeds={[r.id]:{requestId:r.id,askerId:r.giverId}};
  expect(openingGuidance(s)).toMatchObject({key:"help_lead",targetId:r.giverId});
  dismissGuidance(s);
  expect(openingGuidance(s)).toMatchObject({key:"help_lead",targetId:r.giverId});
  s.ui.playerId=a;
  expect(openingGuidance(s).actorId).toBe(a);
});

it("keeps paused player speech physically separated and still requires genuine near contact", () => {
  const {state:s,player,person:a,step}=peopleWorld();
  const {enqueueTask}=require("game/manager");
  enqueueTask(s,{key:"chat"},a);
  let speech;
  for(let minute=0;minute<120&&!speech;minute++) {
    step(1/60);
    if(s.chat?.active)speech=Math.hypot(s.ecs.spatial[player].x-s.ecs.spatial[a].x,s.ecs.spatial[player].y-s.ecs.spatial[a].y);
  }
  expect(speech).toBeGreaterThan(30);expect(speech).toBeLessThanOrEqual(70);
  const {chatChoices,chooseLine,closeChat}=require("game/chat");
  expect(s.knowledge[player].people[a].conversation).toBeUndefined();
  const beforeTime=s.days;step(.5);expect(s.days).toBe(beforeTime);
  chooseLine(s,chatChoices(s)[0].key);closeChat(s);step(.5);
  expect(s.knowledge[player].people[a].conversation).toBeDefined();
  const before=s.ecs.relationships[a].known[player].goodwill;
  s.ecs.spatial[player]={...s.ecs.spatial[a],x:s.ecs.spatial[a].x+200};
  expect(Math.hypot(s.ecs.spatial[player].x-s.ecs.spatial[a].x,s.ecs.spatial[player].y-s.ecs.spatial[a].y)).toBe(200);
  expect(require("game/tasks").talk(s,player,s.ecs.planner[player].world,1/24,true,a,"chat")).toBe(Task.ABORT);
  expect(s.ecs.relationships[a].known[player].goodwill).toBe(before);
});

it("separates NPC conversation positions and requires real arrival/contact and goodwill", () => {
  const {state:s,person:a,sibling:b,step}=peopleWorld();
  s.days=17/24;s.villages.village.sharedPlaces=[];s.ecs.meetingPlace={};
  for(const id of [a,b]) {s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];}
  require("game/social_visits").socialHour(s);
  const p=s.ecs.planner[a].world.places.socialDestination,q=s.ecs.planner[b].world.places.socialDestination;
  expect(Math.hypot(p.x-q.x,p.y-q.y)).toBe(60);
  const before=s.ecs.relationships[a].known[b].goodwill;
  step(2);
  expect(s.social.contacts[[a,b].sort().join(":")]).toBeGreaterThan(17/24);
  expect(s.ecs.relationships[a].known[b].goodwill).toBeGreaterThan(before);
});

it("keeps clock and production effort unchanged while slowing only locomotion", () => {
  const {state:s,player,step}=peopleWorld();
  for(const p of Object.values(s.ecs.planner)){p.task=["wait_for",1];p.plan=[];}
  const before=s.days;step(1);expect(s.days-before).toBeCloseTo(1/24,8);
  const {forage}=require("game/tasks"),w=s.ecs.planner[player].world;
  const [plant]=newEntities(s,[{spatial:{...s.ecs.spatial[player]},forageable:{kind:"berries",amount:1}}]);
  s.ecs.forageable[plant].ripe=true;
  expect(forage(s,player,w,1/96,true,plant)).toBe(Task.CONTINUE);
  expect(w.workRemaining).toBeCloseTo(1/96,8);
});

it("invalidates actual occupancy when a home moves, disappears, or a resident leaves", () => {
  const {state:s,person:a,tiles}=peopleWorld();
  const {enterHome,validateHome}=require("game/home");
  const [home]=newEntities(s,[{spatial:{...s.ecs.spatial[a]},building:{rooms:[]}}]);
  s.ecs.household[a].houseId=home;
  expect(enterHome(s,a,home)).toBe(true);
  s.ecs.spatial[home].x+=100;validateHome(s,a);expect(s.ecs.interior[a]).toBeUndefined();
  s.ecs.spatial[home].x-=100;enterHome(s,a,home);
  s.ecs.household[a].houseId=tiles[2];validateHome(s,a);expect(s.ecs.interior[a]).toBeUndefined();
  s.ecs.household[a].houseId=home;enterHome(s,a,home);s.residents={};validateHome(s,a);expect(s.ecs.interior[a]).toBeUndefined();
});

it("walks ordinary transit around boards and reaches real fenced work without changing cargo ownership", () => {
  const {state:s,player,tiles}=peopleWorld();
  const centre=s.ecs.spatial[tiles[2]];
  const [pen,cargo]=newEntities(s,[{spatial:{...centre},pasture:{halfWidth:30,halfDepth:25},backyard:{kind:"vegetable"}},
    {spatial:{...s.ecs.spatial[player]},good:{type:"grain",amount:1},haulable:{},controllable:{controllerId:player}}]);
  require("game/holder").give(s.ecs,cargo,player);
  const w=s.ecs.planner[player].world;
  let result;const samples=[];
  for(let i=0;i<3000&&result!=Task.FINISH;i++) {
    result=walk_to(s,player,w,1/86400,i==0,tiles[4]);samples.push({...s.ecs.spatial[player]});
  }
  expect(result).toBe(Task.FINISH);
  expect(samples.every(p=>Math.abs(p.x-centre.x)>=30||Math.abs(p.y-centre.y)>=25)).toBe(true);
  expect(samples.some(p=>Math.abs(p.x-centre.x)<40&&Math.abs(p.y-centre.y)>25)).toBe(true);
  s.ecs.farmable ||= {};
  s.ecs.farmable[pen]={houseId:s.ecs.household[player].houseId,slots:[{state:"sown",content:"grain",growth:0}]};
  result=null;let gate=false;
  for(let i=0;i<3000&&result!=Task.FINISH;i++) {
    result=walk_to(s,player,w,1/86400,i==0,pen);
    const p=s.ecs.spatial[player];if(Math.abs(p.x-centre.x)<8&&Math.abs(p.y-centre.y-25)<3)gate=true;
  }
  expect(result).toBe(Task.FINISH);expect(gate).toBe(true);
  w.gardenHelp=pen;
  expect(require("game/tasks").tend_garden(s,player,w,1/96,true,pen)).toBe(Task.FINISH);
  expect(s.ecs.farmable[pen].slots[0].growth).toBeGreaterThan(0);
  expect(s.ecs.haulable[cargo].heldBy).toBe(player);
  expect(s.ecs.controllable[cargo].controllerId).toBe(player);
});

it("does not complete speech through a home roof/wall or reveal private contact", () => {
  const {state:s,player,person:a}=peopleWorld();
  Object.assign(s.ecs.spatial[player],{...s.ecs.spatial[a],x:s.ecs.spatial[a].x-45});
  s.ecs.interior={[a]:{buildingId:s.ecs.household[a].houseId}};
  expect(require("game/tasks").talk(s,player,s.ecs.planner[player].world,1/24,true,a,"chat")).toBe(Task.ABORT);
  expect(s.knowledge?.[player]?.people?.[a]?.conversation).toBeUndefined();
});
