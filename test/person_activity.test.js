jest.mock("game/name", () => ({ name: n => n.nickname }));
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
  expect(currentActivity(state.ecs, person, t)).toBeNull();
});

it("uses actual farm slot work and gives no private planner facts or stale labels to idle people", () => {
  const { state, person } = peopleWorld();
  const planner = state.ecs.planner[person];
  planner.world.label = "at_forge";
  planner.world.places.slot = { result: "harvested" };
  planner.task = ["perform_subtask_in_slot", "field", "slot"];
  expect(currentActivity(state.ecs, person, t)).toBe("Harvesting");
  planner.task = ["walk_to", "slot"];
  expect(currentActivity(state.ecs, person, t)).toBe("Harvesting");
  planner.task = ["wait_for", 1];
  expect(currentActivity(state.ecs, person, t)).toBeNull();
  planner.task = null;
  expect(currentActivity(state.ecs, person, t)).toBeNull();
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

it("shows the real chatting or courtship partner and clears it on an interrupted task", () => {
  const { state, person, sibling } = peopleWorld();
  const planner = state.ecs.planner[person];
  planner.world.social = { partnerId: sibling, courting: false };
  planner.world.label = "at_forge";
  planner.task = ["socialise", sibling];
  expect(currentActivity(state.ecs, person, t)).toBe("Chatting with Alice Miller");
  planner.world.social.courting = true;
  expect(currentActivity(state.ecs, person, t)).toBe("Courting Alice Miller");
  planner.task = ["eat", "grain"];
  expect(currentActivity(state.ecs, person, t)).toBe("Eating");
});

it("uses player knowledge for social partner names shared by world and panel labels", () => {
  const { displayName } = require("game/knowledge");
  const { state, player, person, sibling } = peopleWorld();
  state.personName = id => state.ecs.nameable[id].nickname;
  state.ecs.planner[person].world.social = { partnerId: sibling, courting: true };
  state.ecs.planner[person].task = ["socialise", sibling];
  const label = () => currentActivity(state.ecs, person, t, id => displayName(state, id));
  expect(label()).toBe("Courting an unknown person");
  state.ecs.relationships[player].known[sibling] = { ring: "public" };
  expect(label()).toBe("Courting Alice Miller");
});

it("keeps an actual world journey or arrival readable even when the walker is hungry, and still labels a real meal", () => {
  const { state, person } = peopleWorld(), p = state.ecs.planner[person];
  p.world.feeling.hungry = true; p.task = ["walk_to", "border"];
  p.world.worldJourney = { tileId: "border" };
  expect(currentActivity(state.ecs, person, t)).toBe("Travelling to another community");
  delete p.world.worldJourney; p.world.worldArrival = { tileId: "border" };
  expect(currentActivity(state.ecs, person, t)).toBe("Arriving from another community");
  p.task = ["eat", "grain"];
  expect(currentActivity(state.ecs, person, t)).toBe("Eating");
});
