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
      feeling: {},
      holding: {}
    };

    const [plan, world] = sut.solve(rep, [], [["find_food"]]);

    // NOTE: picking up stored gruel happens inside the first find_food descent;
    // the second find_food must see that held gruel and eat it at the pickup place.
    expect(plan).toEqual([
      ["find_place", "container_with gruel", "container_with", "gruel"],
      ["walk_to", "container_with gruel"],
      ["pick_up_from_container", "container_with gruel", "gruel"],
      ["forget_place", "container_with gruel"],
      ["set_label"],
      ["set_label", "eating"],
      ["eat", "gruel"]
    ]);
    expect(world.holding.gruel).toEqual(false);
    expect(world.feeling.hungry).toEqual(false);
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
