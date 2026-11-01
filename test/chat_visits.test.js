import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { enqueueTask } from "game/manager";
import { startVillagerChat, closeChat, chatChoices, chooseLine } from "game/chat";
import { doorstep } from "game/conversation";
function indoor({asleep=false,unfriendly=false}={}) {
  const w=peopleWorld(),s=w.state;
  const [home]=newEntities(s,[{spatial:{...s.ecs.spatial[w.tiles[3]]},building:{entrance:3},household:{},controllable:{controllerId:w.person}}]);
  s.ecs.household[w.person].houseId=home;s.ecs.spatial[w.person]={...s.ecs.spatial[home]};
  s.ecs.interior={[w.person]:{buildingId:home}};
  s.ecs.planner[w.person].task=[asleep?"sleep":"home_downtime",1];s.ecs.planner[w.person].plan=[];
  if(asleep){s.days=1/24;s.ecs.personable[w.person].tiredness=1.5;s.ecs.planner[w.person].world.feeling.tired=true;}
  if(unfriendly)s.ecs.relationships[w.person].known[w.player]={ring:"public",goodwill:-3,base:0};
  return {...w,home};
}
const until=(w,f)=>{for(let i=0;i<2500&&!f();i++)w.step(.005);expect(f()).toBeTruthy();};
it("walks to the actual door, knocks and brings an awake resident outside before opening chat",()=>{
  const w=indoor(),s=w.state,initial={...s.ecs.spatial[w.player]};
  enqueueTask(s,{key:"chat"},w.person);
  until(w,()=>s.ui.talkResult?.message.includes("Knock"));
  expect(s.ecs.spatial[w.player]).not.toEqual(initial);
  expect(Math.hypot(s.ecs.spatial[w.player].x-doorstep(s,w.home).x,s.ecs.spatial[w.player].y-doorstep(s,w.home).y)).toBeLessThan(10);
  until(w,()=>!!s.chat?.active);
  expect(s.ecs.interior[w.person]).toBeUndefined();expect(s.game_speed).toBe("paused");
  expect(Math.hypot(s.ecs.spatial[w.player].x-s.ecs.spatial[w.person].x,s.ecs.spatial[w.player].y-s.ecs.spatial[w.person].y)).toBeLessThanOrEqual(70);
  expect(s.knowledge[w.player].people[w.person].conversation).toBeUndefined();
  chooseLine(s,chatChoices(s)[0].key);closeChat(s);
  expect(s.ecs.planner[w.person].world.capturedBy).toBeFalsy();
});
it("knocks at a sleeping resident's door at night, gets no answer and grants no contact",()=>{
  const w=indoor({asleep:true}),s=w.state;
  const job=enqueueTask(s,{key:"chat"},w.person);
  until(w,()=>s.ui.talkResult?.message.includes("No answer"));
  expect(s.ui.talkResult.message).toMatch(/morning|6am/);expect(s.ecs.manager[w.player].jobs).not.toContain(job);
  expect(s.ecs.interior[w.person]).toBeDefined();expect(s.chat?.active).toBeUndefined();
  expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
});
it.each(["regard","disposition"])("refuses an unfriendly visit before setting off: %s",kind=>{
  const w=indoor({unfriendly:kind=="regard"}),s=w.state;
  if(kind=="disposition")s.opinionThresholds={hate:10000,love:20000};
  const before={...s.ecs.spatial[w.player]},job=enqueueTask(s,{key:"chat"},w.person);
  expect(s.ecs.manager[w.player].jobs).not.toContain(job);expect(s.ecs.spatial[w.player]).toEqual(before);
  expect(s.ui.talkResult.message).toMatch(/will not come out/);expect(s.ui.talkResult.message).toMatch(/gift|favour/i);
  if(kind=="disposition")expect(s.ui.talkResult.message).toMatch(/tastes|disposition/);
});
it("lets a villager navigate to the player and open a reusable paused conversation with seeded icons",()=>{
  const w=peopleWorld(),s=w.state;
  const before={...s.ecs.spatial[w.person]};
  expect(startVillagerChat(s,w.person)).toBe(true);expect(s.chat?.active).toBeUndefined();
  expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
  until(w,()=>!!s.chat?.active);
  expect(s.ecs.spatial[w.person]).not.toEqual(before);expect(s.chat.active.initiatedBy).toBe(w.person);
  expect(s.chat.active.row.length).toBeGreaterThanOrEqual(2);expect(s.game_speed).toBe("paused");
  chooseLine(s,chatChoices(s)[0].key);closeChat(s);expect(s.game_speed).toBe("fast");
  expect(s.ecs.planner[w.person].world.chatVisit).toBeUndefined();
});
it("does not open a villager-started chat through a blocked route or leave a completed contact",()=>{
  const w=peopleWorld(),s=w.state;for(const t of w.tiles)s.ecs.walkable[t].neighbours={};
  expect(startVillagerChat(s,w.person)).toBe(true);w.step(.1);
  expect(s.chat?.active).toBeUndefined();expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
});
it("releases the answering resident if the player cancels while they come outside",()=>{
  const w=indoor(),s=w.state,job=enqueueTask(s,{key:"chat"},w.person);
  until(w,()=>s.ui.talkResult?.message.includes("coming to the door"));
  expect(s.ecs.planner[w.person].world.capturedBy).toBe(w.player);
  require("game/manager").cancelTask(s,job.id);
  expect(s.ecs.planner[w.person].world.capturedBy).toBeFalsy();
});
it("keeps outdoor attention while the player walks over, without recording early contact",()=>{
  const w=peopleWorld(),s=w.state;
  expect(Math.hypot(s.ecs.spatial[w.player].x-s.ecs.spatial[w.person].x,s.ecs.spatial[w.player].y-s.ecs.spatial[w.person].y)).toBeGreaterThan(70);
  enqueueTask(s,{key:"chat"},w.person);w.step(.005);
  expect(s.ecs.planner[w.person].world.capturedBy).toBe(w.player);
  expect(s.knowledge?.[w.player]?.people?.[w.person]?.conversation).toBeUndefined();
  until(w,()=>!!s.chat?.active);
  expect(s.chat.active.npcId).toBe(w.person);
});
