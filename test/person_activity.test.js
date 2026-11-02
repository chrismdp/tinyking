import { currentActivity } from "game/person_activity";
import { peopleWorld } from "./support/people";
const t = key => key.split(".").pop();

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
