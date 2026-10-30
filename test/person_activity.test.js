import { currentActivity } from "game/person_activity";
import { peopleWorld } from "./support/people";
import messages from "../src/data/messages.json";
import { TRADES } from "game/villages";

const t = key => key.split(".").reduce((value, part) => value?.[part], messages) || key;

it.each(TRADES)("reads %s work from the current task and profession, ignoring stale labels", trade => {
  const { state, person } = peopleWorld();
  state.ecs.profession = { [person]: { trade } };
  const planner = state.ecs.planner[person];
  planner.world.label = "sleeping";
  planner.task = ["trade_work", "workplace"];
  expect(currentActivity(state.ecs, person, t)).toBe(({ smith: "At the forge", carpenter: "Carpentry", weaver: "Weaving", baker: "Baking", tanner: "Tanning hides", miller: "Milling grain" })[trade]);
  planner.task = ["eat", "grain"];
  expect(currentActivity(state.ecs, person, t)).toBe("Eating");
  planner.task = ["walk_to", "workplace"];
  expect(currentActivity(state.ecs, person, t)).toBe("Walking");
});

it("uses actual farm slot work and gives no private planner facts or stale labels to idle people", () => {
  const { state, person } = peopleWorld();
  const planner = state.ecs.planner[person];
  planner.world.label = "at_forge";
  planner.world.places.slot = { result: "harvested" };
  planner.task = ["perform_subtask_in_slot", "field", "slot"];
  expect(currentActivity(state.ecs, person, t)).toBe("Harvesting");
  planner.task = ["walk_to", "slot"];
  expect(currentActivity(state.ecs, person, t)).toBe("Walking");
  planner.task = ["wait_for", 1];
  expect(currentActivity(state.ecs, person, t)).toBe("Idle");
  planner.task = null;
  expect(currentActivity(state.ecs, person, t)).toBe("Idle");
  state.ecs.personable[person].dead = true;
  planner.task = ["eat", "grain"];
  expect(currentActivity(state.ecs, person, t)).toBe("Dead");
});

it("shares current timber phases but shows actual meals and sleep during interruptions", () => {
  const { state, player } = peopleWorld();
  const planner = state.ecs.planner[player];
  const job = { job: { key: "cut_tree_down" }, assignedId: player, gatheredDone: true, gathered: ["log"] };
  state.ecs.manager[player].jobs.push(job);
  state.ecs.holder[player].held.push("log");
  planner.task = ["carry_home"];
  expect(currentActivity(state.ecs, player, t)).toBe("Carrying wood home");
  state.ecs.holder[player].held = [];
  expect(currentActivity(state.ecs, player, t)).toBe("Collecting wood");
  job.gatheredDone = false;
  planner.task = ["chop_tree", "tree"];
  expect(currentActivity(state.ecs, player, t)).toBe("Chopping");
  planner.task = ["walk_to", "tree"];
  expect(currentActivity(state.ecs, player, t)).toBe("Walking to tree");
  planner.task = ["eat", "grain"];
  expect(currentActivity(state.ecs, player, t)).toBe("Eating");
  planner.task = ["sleep"];
  expect(currentActivity(state.ecs, player, t)).toBe("Sleeping");
});
