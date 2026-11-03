import * as sut from "game/manager";

describe("manager", () => {
  it("removes on request", () => {
    const ecs = {
      manager: { 1: { jobs: [
        { job: { key: "foo" }, targetId: 2, assignedId: 3 },
      ] } },
    };
    expect(sut.removeJob(ecs, 1, "bar", 2)).toBeNull();
    expect(sut.removeJob(ecs, 1, "foo", 3)).toBeNull();
    expect(sut.removeJob(ecs, 1, "foo", 2)).toEqual(3);
    expect(ecs.manager["1"].jobs).toEqual([]);
  });
});

it.each(["forage","cut_tree_down","favour","chat","rest","find_food","harvest_field","build_shelter","move_to_here","create_field"])("explains a deferred %s task with a concrete next step",key=>{
  const {state:s,player:p,person:n,tiles}=require("./support/people").peopleWorld();
  s.ecs.forageable ||= {};s.ecs.good ||= {};
  if(key=="forage")s.ecs.forageable[n]={kind:"roots",amount:1,growth:0};
  if(key=="cut_tree_down")s.ecs.good[n]={type:"wood",amount:1};
  const target=["move_to_here","create_field"].includes(key)?tiles[1]:n;
  const task={id:"waiting",job:{key},targetId:target,assignedId:p};s.ecs.manager[p].jobs=[task];
  sut.deferPlayerTask(s);
  expect(task.waiting).toBeTruthy();
});
