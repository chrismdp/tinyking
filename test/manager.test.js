import * as sut from "game/manager";

describe("manager", () => {
  it("pushes a job", () => {
    const ecs = {
      manager: { 1: { jobs: [] } },
      controllable: { 1: { controllerId: 1 } },
    };

    const job = { key: "foo" };

    sut.pushJob(ecs, 1, { job, targetId: 3 });
    expect(ecs.manager["1"].jobs).toEqual([{ job, targetId: 3 }]);
  });

  it("doesn't push if exists already", () => {
    const job = { key: "foo" };

    const ecs = {
      manager: { 1: { jobs: [
        { job, targetId: 2 },
        { job, targetId: 3, assignedId: 1 },
      ] } },
      controllable: { 1: { controllerId: 1 } },
    };

    sut.pushJob(ecs, 1, { job, targetId: 3 });
    expect(ecs.manager["1"].jobs).toEqual([
      { job, targetId: 2 },
      { job, targetId: 3, assignedId: 1 },
    ]);
  });

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
