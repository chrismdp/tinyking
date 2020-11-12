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

  it("run sub tasks more than once for method conditions that return arrays", () => {
    const rep = {
      places: {},
      no_place_for: {},
      holding: { "wood": false, "grain": true }
    };

    const [plan, world] = sut.solve(rep, [], [["store_held"]]);
    expect(plan).toEqual([
      ["find_place", "slot", "stockpile_open_slot", "grain"],
      ["walk_to", "slot"],
      ["drop_entity_into_stockpile_slot", "grain"],
      ["forget_place", "slot"]
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
  });
});
