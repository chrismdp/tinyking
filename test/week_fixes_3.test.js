import { peopleWorld } from "./support/people";
import { enqueueTask, expireChatApproach, readyPlayerTasks } from "game/manager";
import { approach_chat } from "game/tasks";
import { Task } from "game/htn";

it.each(["eat", "trade_work", "walk_to"])("follows a person doing %s and waits to take their attention until they are free", activity=>{
  const {state:s,player:a,person:n,tiles}=peopleWorld();
  const target=s.ecs.planner[n],world=s.ecs.planner[a].world;
  target.task=[activity,tiles[4]];target.plan=[];
  const start={...s.ecs.spatial[a]},order=enqueueTask(s,{key:"chat"},n);
  approach_chat(s,a,world,1/1440,true,n);
  expect(s.ecs.spatial[a]).not.toEqual(start);
  expect(target.world.capturedBy).toBeFalsy();
  s.days+=3/24;expireChatApproach(s);
  expect(s.ecs.manager[a].jobs).toContain(order);
  s.ecs.spatial[a]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  expect(approach_chat(s,a,world,1/1440,false,n)).toBe(Task.CONTINUE);
  expect(target.world.capturedBy).toBeFalsy();
  target.task=null;
  expect(approach_chat(s,a,world,1/1440,false,n)).toBe(Task.FINISH);
  expect(target.world.capturedBy).toBe(a);
});
it.each(["sleep", "gone", "dead", "blocked"])("ends a queued chat when the person becomes unreachable: %s", reason=>{
  const {state:s,player:a,person:n,tiles}=peopleWorld();
  const order=enqueueTask(s,{key:"chat"},n);expireChatApproach(s);
  if(reason=="sleep")s.ecs.planner[n].task=["sleep"];
  if(reason=="gone")delete s.ecs.spatial[n];
  if(reason=="dead")s.ecs.personable[n].dead=true;
  if(reason=="blocked")for(const id of tiles)s.ecs.walkable[id].neighbours={};
  readyPlayerTasks(s);expireChatApproach(s);
  expect(s.ecs.manager[a].jobs).not.toContain(order);
  expect(s.ui.talkResult).toMatchObject({personId:n,message:expect.any(String)});
  expect(s.knowledge?.[a]?.people?.[n]?.conversation).toBeUndefined();
  expect(s.ecs.planner[n].world.capturedBy).toBeFalsy();
});
