import { community as initialCommunity, attach } from "./support/travel";
import { peopleWorld } from "./support/people";
import { canMarryPlayer } from "game/family";
import { resolveSuccession } from "game/succession";
import { generateHistory } from "game/history";
import { advanceSeason, historyStep, canCourt } from "game/social";
import { heirFor, die, createPossession } from "game/possessions";
import { topController } from "game/playable";
import { enqueueTask } from "game/manager";
import { createSimulation } from "game/simulation";
import { talk } from "game/tasks";
import { Task } from "game/htn";
import { skipIntro } from "game/intro";

const community = (...args) => {
  const f=initialCommunity(...args);
  if(f.s.ui.playerId)f.s.ecs.playable[f.s.ui.playerId].arrivedAt=f.s.days;
  return f;
};

const intimate = (s,a,b) => { for (const [x,y] of [[a,b],[b,a]]) s.ecs.relationships[x].known[y]={ring:"intimate",goodwill:66,base:66}; };
const weddingWorld = () => { const f=peopleWorld(); f.state.ecs.playable[f.player].arrivedAt=f.state.days; f.state.opinionThresholds={hate:-100,love:-99}; f.state.ecs.building={[f.tiles[3]]:{rooms:[]}}; return f; };

it("requires mutual adult consent for deliberate marriage, while NPC matchmaking excludes the player", () => {
  const {state:s,player:a,person:b,parent}=weddingWorld();
  intimate(s,a,b);
  expect(canMarryPlayer(s,a,b)).toBe(true);
  expect(canCourt(s,a,b)).toBe(false);
  s.ecs.relationships[a].known[b].ring="personal";
  expect(canMarryPlayer(s,a,b)).toBe(false);
  intimate(s,a,b); s.ecs.personable[a].age=12;
  expect(canMarryPlayer(s,a,b)).toBe(false);
  s.ecs.personable[a].age=24; s.ecs.kinship[a].parents=[parent];
  expect(canMarryPlayer(s,a,b)).toBe(false);
});

it("courts through a real queued walk and timed conversation, growing both directional bonds", () => {
  const {state:s,player,person,step}=weddingWorld();
  const job=enqueueTask(s,{key:"court"},person);
  expect(s.knowledge?.[player]?.people?.[person]?.conversation).toBeUndefined();
  step(.05); expect(job.progress).toBeLessThan(1);
  step(2);
  expect(job.progress).toBe(1);
  for (const [a,b] of [[player,person],[person,player]]) expect(s.ecs.relationships[a].known[b].goodwill).toBeGreaterThan(16);
  expect(s.knowledge[player].people[person].conversation).toBeDefined();
  expect(s.ecs.kinship[player].spouse).toBeNull();
});

it.each(["consent","age","married","death"])("revalidates %s after a marriage visit was queued", reason => {
  const {state:s,player,person,sibling,step}=weddingWorld(); intimate(s,player,person);
  enqueueTask(s,{key:"marry"},person);
  if(reason=="consent")s.ecs.relationships[person].known[player].ring="personal";
  if(reason=="age")s.ecs.personable[player].age=12;
  if(reason=="married"){s.ecs.kinship[person].spouse=sibling;s.ecs.kinship[sibling].spouse=person;}
  if(reason=="death")s.ecs.personable[person].dead=true;
  step(2);
  expect(s.ecs.kinship[player].spouse).toBeNull();
  expect((s.events||[]).some(e=>e.type=="marriage")).toBe(false);
  expect(s.knowledge?.[player]?.people?.[person]?.conversation).toBeUndefined();
});

it("marries through the planner, retains the living householder, possessions and tastes, and limits in-law regard", () => {
  const {state:s,player,person,parent,sibling,tiles,step}=weddingWorld(); intimate(s,player,person);
  const item=createPossession(s,person,"Family ring");
  s.ecs.personality[parent].opinionThresholds={hate:100,love:101}; const before=JSON.stringify(s.ecs.personality);
  const job=enqueueTask(s,{key:"marry"},person); step(.05);expect(job.progress).toBeLessThan(1);step(2);
  expect(s.ecs.kinship[player].spouse).toBe(person);expect(s.ecs.kinship[person].spouse).toBe(player);
  expect(s.ecs.household[player].houseId).toBe(tiles[3]);expect(s.ecs.controllable[tiles[3]].controllerId).toBe(parent);
  expect(heirFor(s,parent)).toBe(person);expect(s.ecs.possession[item].ownerId).toBe(person);
  expect(JSON.stringify(s.ecs.personality)).toBe(before); // snapshot below excludes the intentional fixture taste override
  expect(s.ecs.relationships[parent].known[player].ring).toBe("public");
  expect(s.ecs.relationships[sibling].known[player].goodwill).toBeGreaterThan(0);
  expect(s.knowledge[player].people[person].conversation).toBeDefined();
  expect(s.events.filter(e=>e.type=="marriage")).toHaveLength(1);
  expect(s.social.contacts[[player,person].sort().join(":")]).toBeDefined();
  for(const id of [player,person,parent,sibling])expect(()=>topController(s.ecs,id)).not.toThrow();
});

it("does not let a deceased actor finish a timed gift or marriage", () => {
  const {state:s,player,person}=weddingWorld();intimate(s,player,person);die(s,player);
  expect(talk(s,player,s.ecs.planner[player].world,1,false,person,"marry")).toBe(Task.ABORT);
  expect(talk(s,player,s.ecs.planner[player].world,1,false,person,"give_gift")).toBe(Task.ABORT);
});

it("keeps the new stranger entirely outside initial forty-five-year history", () => {
  const {s,ids:[player]}=community();const identity={...s.ecs.personable[player]};
  generateHistory(s,13);
  expect(s.ecs.personable[player]).toEqual(identity);
  expect(s.events.some(e=>e.people.includes(player))).toBe(false);
  expect(Object.entries(s.ecs.relationships).some(([id,r])=>id!=player&&r.known[player])).toBe(false);
});

it("ages the player during live and offscreen seasons without automatic marriage", () => {
  const {s,ids:[player,partner]}=community();intimate(s,player,partner);
  const age=s.ecs.personable[player].lifeYears;
  advanceSeason(s,1);expect(s.ecs.personable[player].lifeYears).toBe(age+.25);
  const next=historyStep(s,2);expect(next.ecs.personable[player].lifeYears).toBe(age+.5);
  expect(next.ecs.kinship[player].spouse).toBeNull();
});

it("allows a genuine player marriage to produce reciprocal children on actual seasons with cooldown", () => {
  const {state:s,player,person,step}=weddingWorld();intimate(s,player,person);enqueueTask(s,{key:"marry"},person);step(2);
  for(let season=1;season<=4 && !s.ecs.kinship[player].children.length;season++){s.days=season*3;advanceSeason(s,season);}
  const children=s.ecs.kinship[player].children;expect(children.length).toBeGreaterThan(0);
  const child=children[0];expect(s.ecs.kinship[child].parents).toEqual(expect.arrayContaining([player,person]));
  expect(s.ecs.kinship[person].children).toContain(child);
  const count=children.length;advanceSeason(s,Math.floor(s.days/3)+1);expect(s.ecs.kinship[player].children).toHaveLength(count);
});

it.each(["spouse","minor"])("continues after a shared lifecycle death as the actual %s with their own identity and estate provenance", async kind => {
  const {s,ids:[player,heir,other],house}=community();
  if(kind=="spouse"){s.ecs.kinship[player].spouse=heir;s.ecs.kinship[heir].spouse=player;}
  else{s.ecs.kinship[player].children=[heir];s.ecs.kinship[heir].parents=[player];Object.assign(s.ecs.personable[heir],{age:7,lifeYears:.8,size:12});}
  s.ecs.controllable[house].controllerId=player;
  const item=createPossession(s,player,"Founder ring");const traits=JSON.stringify(s.ecs.personality[heir]);
  s.ecs.relationships[other].known[player]={ring:"intimate",goodwill:95,base:16};
  s.ecs.relationships[other].known[heir]={ring:"public",goodwill:-2,base:0};
  s.ecs.planner[heir].task=["walk_to",house];s.ecs.planner[heir].world.social={partnerId:other};
  const point={...s.ecs.spatial[heir]};s.days=2.999;if(kind=="spouse")Object.assign(s.ecs.personable[player],{age:87,lifeYears:36.75});else s.ecs.personable[player].hunger=6;
  const sim=createSimulation(s);await sim.step(60);if(sim.pending)await sim.pending;
  expect(s.ecs.personable[player]).toMatchObject({dead:true,deathCause:kind=="spouse"?"old age":"starvation",heirId:heir});
  expect(s.ui.playerId).toBe(heir);expect(s.ecs.controllable[house].controllerId).toBe(heir);
  expect(s.ecs.possession[item].owners.map(o=>o.personId)).toEqual([player,heir]);
  expect(s.ecs.relationships[other].known[heir].goodwill).toBeLessThan(0);
  expect(JSON.stringify(s.ecs.personality[heir])).toBe(traits);expect(s.ecs.spatial[heir]).toEqual(point);
  expect(s.ecs.planner[heir].task).toBeNull();expect(s.ecs.planner[heir].world.social).toBeUndefined();
  expect(s.events.some(e=>e.type=="succession"&&e.people[1]==heir)).toBe(true);
});

it("activates a remote heir in place without adding a journey season or copying knowledge", async () => {
  const {s,ids:[player],house}=community();const remote=community({namespace:"remote-",key:"6,5",player:false});const heir=remote.ids[0];
  s.ecs.kinship[player].children=[heir];remote.s.ecs.kinship[heir].parents=[player];attach(s,remote.s);
  s.ecs.controllable[house].controllerId=player;const position={...remote.s.ecs.spatial[heir]};
  s.knowledge[player]={people:{secret:{conversation:{day:0}}},events:[],feelings:{}};
  die(s,player);const before=s.days;await resolveSuccession(s);
  expect(s.ui.playerId).toBe(heir);expect(s.travel.active).toBe("6,5");expect(s.days).toBe(before);
  expect(s.ecs.spatial[heir]).toEqual(position);expect(s.knowledge[heir]?.people?.secret).toBeUndefined();
  expect(s.travel.maps["5,5"].ecs.controllable[house].controllerId).toBe(heir);
});

it("restarts deterministically in the same persistent world, with no old assets and safe camp skipping, across repeat deaths", async () => {
  const run=async()=>{const {s,ids:[player],house}=community();s.ecs.controllable[house].controllerId=player;const item=createPossession(s,player,"Unclaimed ring");
    const oldWorld=s.world,oldEvents=s.events;die(s,player);await resolveSuccession(s);const next=s.ui.playerId;
    expect(next).not.toBe(player);expect(s.world).toEqual(oldWorld);expect(s.events).toBe(oldEvents);
    expect(s.ecs.controllable[house].controllerId).not.toBe(next);expect(s.ecs.possession[item].ownerId).toBeNull();
    expect(s.ecs.personality[next]).toBeDefined();expect(s.ecs.kinship[next]).toMatchObject({parents:[],children:[],spouse:null});
    expect(s.intro.active).toBe(true);skipIntro(s);const camp=s.intro.campId;skipIntro(s);expect(s.intro.campId).toBe(camp);
    expect(s.ecs.controllable[camp].controllerId).toBe(next);die(s,next);await resolveSuccession(s);expect(s.ui.playerId).not.toBe(next);
    return {id:next,identity:s.ecs.nameable[next],personality:s.ecs.personality[next]};};
  expect(await run()).toEqual(await run());
});

it("finishes the real wedding order when joining a different household resets the player's planner", () => {
  const {state:s,player,person,tiles,step}=weddingWorld();intimate(s,player,person);
  s.ecs.household[player].houseId=tiles[0];
  const job=enqueueTask(s,{key:"marry"},person);
  expect(()=>step(2)).not.toThrow();expect(job.progress).toBe(1);
  expect(s.ecs.household[player].houseId).toBe(tiles[3]);
});

it("admits births in a player-owned family home before it belongs to a village", () => {
  const {state:s,player,person,tiles,step}=weddingWorld();intimate(s,player,person);enqueueTask(s,{key:"marry"},person);step(2);
  s.ecs.village[player].villageId=null;s.ecs.village[person].villageId=null;s.ecs.village[tiles[3]]={villageId:null};
  for(let season=1;season<=4&&!s.ecs.kinship[player].children.length;season++){s.days=season*3;advanceSeason(s,season);}
  expect(s.ecs.kinship[player].children.length).toBeGreaterThan(0);
});
