jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
jest.mock("render/labels", () => ({ label: jest.fn(() => new (require("three").Group)()) }));
import { person } from "render/models";
import { label } from "render/labels";

it("shows the same real wood phase above the person as in the queue", () => {
  const planner = { task: ["carry_home"], world: { label: "cut_tree_down" } };
  const job = { job: { key: "cut_tree_down" }, assignedId: "p", gatheredDone: true, gathered: ["log"] };
  const state = { ui: { playerId: "p" }, ecs: { planner: { p: planner }, good: { log: { type: "wood" } },
    holder: { p: { held: ["log"] } }, manager: { p: { jobs: [job] } } } };
  const e = { id: "p", personable: { size: 20, body: 0x4E3F30, hair: 0 }, holder: state.ecs.holder.p, planner };
  person(state, e, key => key, { realm: 0xFFFFFF });
  expect(label).toHaveBeenLastCalledWith("Carrying wood home");
  e.holder.held = [];
  person(state, e, key => key, { realm: 0xFFFFFF });
  expect(label).toHaveBeenLastCalledWith("Collecting wood");
  job.gatheredDone = false;
  planner.task = ["chop_tree", "tree"];
  person(state, e, key => key, { realm: 0xFFFFFF });
  expect(label).toHaveBeenLastCalledWith("Chopping");
  job.assignedId = null;
  planner.task = ["forage", "food"];
  planner.world.label = "foraging";
  person(state, e, key => key, { realm: 0xFFFFFF });
  expect(label).toHaveBeenLastCalledWith("tasks.foraging");
});
