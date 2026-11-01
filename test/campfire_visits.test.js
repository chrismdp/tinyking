import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { socialHour } from "game/social_visits";
import { closeChat, startVillagerChat } from "game/chat";
import { hashUnit } from "game/math";

function setup({journey=false}={}) {
  const w=peopleWorld(),{state:s,player:p,person:n,tiles}=w;
  const [fire]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},camp:{journey},sleepable:{capacity:1,occupiers:[]},controllable:{controllerId:p}}]);
  s.ecs.household[p].houseId=fire;s.ecs.spatial[p]={...s.ecs.spatial[fire]};
  if(journey)s.travel={season:0,transit:[],journey:{actorId:p,campId:fire,paused:true}};
  // Deterministic opportunity; availability and navigation remain real.
  const day=Array.from({length:10},(_,i)=>i).find(d=>hashUnit(s.peopleSeed+":campfire:"+p+":"+d)<.45);
  s.days=day+18/24;
  for(const id of [n,w.parent,w.sibling]) {
    const plan=s.ecs.planner[id];plan.task=["wait_for",1];plan.plan=[];
    plan.world.nightHome=null;plan.world.days=s.days;
  }
  s.ecs.planner[p].world.returnedNight=Math.floor(s.days-6/24);
  return {...w,fire};
}
const visitor=s=>Object.keys(s.ecs.planner).filter(id=>s.ecs.planner[id].world.chatVisit?.context?.campfire);
it.each([false,true])("walks one evening visitor to the player's fire and opens villager-started chat (journey %s)",journey=>{
  const w=setup({journey}),{state:s}=w;
  socialHour(s);expect(visitor(s)).toHaveLength(1);
  const [npc]=visitor(s),before={...s.ecs.spatial[npc]};
  socialHour(s);expect(visitor(s)).toEqual([npc]);
  for(let i=0;i<2200&&!s.chat?.active;i++)w.step(.005);
  expect(s.ecs.spatial[npc]).not.toEqual(before);
  expect(s.chat.active).toMatchObject({npcId:npc,initiatedBy:npc});
  expect(s.chat.active.transcript[0].family).toBe("campfire");
  expect(s.game_speed).toBe("paused");
  closeChat(s);socialHour(s);expect(visitor(s)).toHaveLength(0);
});
it.each(["sleep","daytime","away","busy","unfriendly","disconnected"])("does not send a visitor when %s",kind=>{
  const {state:s,player:p,tiles}=setup();
  if(kind=="sleep")s.ecs.planner[p].task=["sleep"];
  if(kind=="daytime")s.days=Math.floor(s.days)+12/24;
  if(kind=="away")s.ecs.spatial[p].x+=600;
  if(kind=="busy")for(const id of Object.keys(s.ecs.planner).filter(id=>id!=p))s.ecs.planner[id].world.currentJob="work";
  if(kind=="unfriendly")for(const id of Object.keys(s.ecs.planner).filter(id=>id!=p))s.ecs.relationships[id].known[p]={ring:"public",goodwill:-3};
  if(kind=="disconnected")for(const t of tiles)s.ecs.walkable[t].neighbours={};
  socialHour(s);expect(visitor(s)).toHaveLength(0);
});
it("cancels a visitor on the approach if the player goes to sleep",()=>{
  const w=setup(),s=w.state;socialHour(s);const [npc]=visitor(s);expect(npc).toBeDefined();
  s.ecs.planner[w.player].task=["sleep",1];s.ecs.planner[w.player].plan=[];
  w.step(.005);
  expect(s.ecs.planner[npc].world.chatVisit).toBeUndefined();expect(s.chat?.active).toBeUndefined();
});
it("welcomes an existing homeless traveller with no acquaintances at a journey camp",()=>{
  const {state:s,person:n,parent,sibling}=setup({journey:true});
  s.ecs.household[n].houseId=null;s.ecs.relationships[n].known={};
  s.ecs.guest={[n]:{homeWorld:"elsewhere"}};
  s.opinionThresholds={hate:10000,love:20000};
  for(const id of [parent,sibling])s.ecs.planner[id].world.ordered=true;
  socialHour(s);expect(visitor(s)).toEqual([n]);
});
it("treats an away-family reference as someone elsewhere, not a local acquaintance",()=>{
  const {state:s,player:p,person:n,parent,sibling}=setup({journey:true});
  s.ecs.household[n].houseId=null;
  s.ecs.relationships[n].known={[parent]:{ring:"public",goodwill:0}};
  s.residents={[p]:true,[n]:true,[sibling]:true};
  delete s.ecs.planner[parent];s.ecs.planner[sibling].world.ordered=true;
  s.opinionThresholds={hate:10000,love:20000};
  socialHour(s);expect(visitor(s)).toEqual([n]);
});
it("can call at the player's house fire and gives an available friend priority",()=>{
  const {state:s,player:p,person:n,fire}=setup();
  delete s.ecs.camp[fire];(s.ecs.building ||= {})[fire]={entrance:1,rooms:[]};
  s.ecs.relationships[n].known[p]={ring:"personal",goodwill:40};
  socialHour(s);expect(visitor(s)).toEqual([n]);
});
it("does not queue a fire caller while another villager is already coming to talk",()=>{
  const {state:s,person:n}=setup();
  expect(startVillagerChat(s,n)).toBe(true);
  socialHour(s);expect(visitor(s)).toHaveLength(0);
});
