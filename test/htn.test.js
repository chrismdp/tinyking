import * as sut from "game/htn";

describe("HTN planning", () => {
  it("allows primitive tasks", () => {
    const rep = {
      id: 1,
      places: {},
      no_place_for: {},
      feeling: {},
      loc: {
        1: { x: 2, y: 3 },
        2: { x: 2, y: 3 },
      },
    };

    const [plan, world] = sut.solve(rep, [], [ ["chop_tree", 2] ]);
    expect(plan).toEqual([ [ "chop_tree", 2] ]);
  });

  it("allows compound tasks", () => {
    const rep = {
      id: 1,
      places: {},
      no_place_for: {},
      feeling: {},
      loc: {
        1: { x: 2, y: 3 },
        2: { x: 40, y: 60 },
      },
    };

    const [plan, world] = sut.solve(rep, [], [ ["move_to_place", "type", "filter", "param" ] ]);
    expect(plan).toEqual([
      ["find_place", "type", "filter", "param"],
      ["walk_to", "type"]
    ]);
  });

  it("allows multiple compounds", () => {
    const rep = {
      id: 1,
      places: {},
      no_place_for: {},
      feeling: {},
      loc: {
        1: { x: 2, y: 3 },
        2: { x: 40, y: 60 },
      },
    };

    const [plan, world] = sut.solve(rep, [], [
      ["move_to_place", "type", "filter", "param" ],
      ["move_to_place", "type", "filter", "param" ]
    ]);

    expect(plan).toEqual([
      ["find_place", "type", "filter", "param"],
      ["walk_to", "type" ],
      ["walk_to", "type" ]
    ]);
  });

  it("accepts a job queue", () => {
    const jobs = [ { job: { key: "move_to_here" }, targetId: "2" } ];
    const rep = {
      places: {},
      no_place_for: {},
      holding: {}
    };
    const [plan, world] = sut.solve(rep, jobs, [["check_jobs"]]);
    expect(plan).toEqual([
      ["take_job", "move_to_here"],
      ["walk_to", "2"],
      ["complete_job", "move_to_here"],
    ]);
  });

  it("allows planned world to persist after descent into compound task", () => {
    const rep = {
      places: { grain: 1 },
      no_place_for: {},
      feeling: {hungry:true},
      holding: {}
    };

    const [plan, world] = sut.solve(rep, [], [["find_food"]]);

    // The planned meal from recovery must persist into the eating primitive.
    expect(plan).toEqual([
      ["set_label", "eating"],
      ["recover_meal"],
      ["eat", "meal"]
    ]);
    expect(world.holding.meal).toEqual(false);
    expect(world.feeling.hungry).toEqual(false);
    expect(rep.holding).toEqual({});
  });

  it("plans a separate slot for each subtask it creates", () => {
    const rep = {
      places: {},
      no_place_for: {},
      feeling: {},
      holding: {}
    };

    const [, world] = sut.solve(rep, [], [["create_subtasks", "7", "ploughed"]]);

    expect(world.subtasks).toEqual([
      { x: 0, y: 0, result: "ploughed", id: "7" },
      { x: 1, y: 1, result: "ploughed", id: "7" },
      { x: 2, y: 2, result: "ploughed", id: "7" },
    ]);
  });
});
