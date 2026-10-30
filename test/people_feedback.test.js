import React from "react";
import { I18n } from "react-polyglot";
import { renderToStaticMarkup } from "react-dom/server";
import messages from "../src/data/messages.json";
import { GameState } from "../src/components/contexts";
import { PersonPanel } from "../src/components/person_panel";
import { peopleWorld } from "./support/people";
import { askAbout, beginInteraction, feelingHint } from "game/people";
import { talk } from "game/tasks";
import { Task } from "game/htn";
import { learnEvent, recordEvent } from "game/events";
import { createPossession, transferPossession } from "game/possessions";
import { currentActivity } from "game/person_activity";
import { enqueueTask } from "game/manager";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));
const panel = (s, id) => renderToStaticMarkup(<I18n locale="en" messages={messages}><GameState.Provider value={s}><PersonPanel entityId={id}/></GameState.Provider></I18n>);
const t = k => k.split(".").pop();

it("requires this actor's completed physical talk, never selection, gossip, introduction or another actor's talk", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  s.ecs.relationships[person].known[player] = { ring: "personal", goodwill: 36 };
  expect(panel(s, person)).toContain("You have not spoken together yet");
  expect(panel(s, person)).not.toMatch(/seems polite|trusts you|Goodwill with/);
  beginInteraction(s, player, person);
  s.ecs.relationships[sibling].known[player] = { ring: "social", goodwill: 16 };
  s.ecs.relationships[sibling].known[person] = { ring: "personal", goodwill: 36 };
  askAbout(s, player, sibling, person);
  expect(feelingHint(s, person, player)).toEqual({});
  const w = s.ecs.planner[sibling].world;
  expect(talk(s, sibling, w, 1 / 24, true, person, "chat")).toBe(Task.FINISH);
  expect(feelingHint(s, person, player)).toEqual({});
  const pw = s.ecs.planner[player].world;
  // Walking has not happened: a distant aborted talk grants nothing.
  expect(talk(s, player, pw, 1 / 24, true, person, "chat")).toBe(Task.ABORT);
  expect(feelingHint(s, person, player)).toEqual({});
  Object.assign(s.ecs.spatial[player], s.ecs.spatial[person]);
  expect(talk(s, player, pw, 1 / 1440, true, person, "chat")).toBe(Task.CONTINUE);
  expect(feelingHint(s, person, player)).toEqual({});
  talk(s, player, pw, 1 / 24, false, person, "chat");
  expect(feelingHint(s, person, player).ring).toBe("personal");
  expect(panel(s, person)).toContain("considers you a friend");
  s.ecs.personable[person].dead = true;
  expect(panel(s, person)).not.toMatch(/seems |trusts you|can help|shares her family/);
});

it("states disclosed asymmetric friendship in the speaker's direction and never invents romance", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  s.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  s.ecs.relationships[person].known[sibling] = { ring: "personal", goodwill: 36 };
  s.ecs.relationships[sibling].known[person] = { ring: "public", goodwill: 0 };
  askAbout(s, player, person, sibling);
  s.ecs.relationships[person].known[sibling].ring = "intimate";
  let html = panel(s, person);
  expect(html).toContain("Agnes Miller considers Alice Miller a friend.");
  expect(html).not.toMatch(/Alice Miller considers Agnes|Personal ring|lover/);
  askAbout(s, player, person, sibling);
  html = panel(s, person);
  expect(html).toContain("Agnes Miller considers Alice Miller one of her closest friends.");
});

it("builds a concise disclosed life from real events and item provenance, including remote/dead kin, with an honest unknown state", () => {
  const { state: s, player, person, parent, sibling } = peopleWorld();
  const item = createPossession(s, parent, "Edith's hammer", "tool");
  transferPossession(s, item, person, "inheritance");
  const death = recordEvent(s, "death", [parent]);
  recordEvent(s, "quarrel", [person, sibling]);
  s.knowledge[player] = { people: {}, feelings: {}, events: [] };
  expect(panel(s, person)).toContain("Their story is not yet known");
  expect(panel(s, person)).not.toContain("Edith&#x27;s hammer");
  s.ecs.relationships[person].known[player] = { ring: "personal", goodwill: 36 };
  s.knowledge[player] = { people: {}, feelings: {}, events: [] };
  // Knowing a death does not prove that Agnes raised anybody.
  learnEvent(s, player, death);
  beginInteraction(s, player, person);
  Object.assign(s.ecs.spatial[player], s.ecs.spatial[person]);
  talk(s, player, s.ecs.planner[player].world, 1 / 24, true, person, "chat");
  s.ecs.personable[parent].dead = true;
  s.residents = { [player]: true, [person]: true, [sibling]: true };
  const html = panel(s, person);
  expect(html).toContain("Still carries Edith&#x27;s hammer, inherited from Edith Miller");
  expect(html).not.toMatch(/raised|looked after|brought up/);
  const before = JSON.stringify(s);
  expect(panel(s, person)).toBe(html);
  expect(JSON.stringify(s)).toBe(before);
  s.ecs.personable[person].dead = true;
  expect(panel(s, person)).not.toContain("Still carries");
});

it("hides generic planner states while preserving purpose during movement and diagnostic detail", () => {
  const { state: s, person, sibling } = peopleWorld(), p = s.ecs.planner[person];
  for (const task of [null, ["wait_for", 1], ["walk_to", "meet"]]) {
    p.task = task;
    expect(currentActivity(s.ecs, person, t)).toBeNull();
    expect(currentActivity(s.ecs, person, t, undefined, true)).toBeTruthy();
  }
  p.task = ["walk_to", sibling];
  p.world.social = { partnerId: sibling, stage: "outbound" };
  expect(currentActivity(s.ecs, person, t)).toMatch(/visit/i);
  delete p.world.social;
  s.ecs.manager[person].jobs.push({ assignedId: person, targetId: sibling, job: { key: "chat" } });
  expect(currentActivity(s.ecs, person, t)).toMatch(/talk/i);
});

it("keeps a fed rested uncommanded player exactly where left while nearby NPCs move, and still runs explicit orders", () => {
  const { state: s, player, person, tiles, step } = peopleWorld();
  s.ecs.spatial[person] = { ...s.ecs.spatial[player], x: s.ecs.spatial[player].x + 1 };
  const start = { ...s.ecs.spatial[player] };
  const npcStart = { ...s.ecs.spatial[person] };
  s.ecs.manager[person].jobs.push({ job: { key: "move_to_here" }, targetId: tiles[1], assignedId: null });
  step(8);
  expect(s.ecs.spatial[person]).not.toEqual(npcStart);
  expect(s.ecs.spatial[player]).toEqual(start);
  expect(s.ecs.personable[player].hunger).toBeGreaterThan(0.3);
  enqueueTask(s, { key: "move_to_here" }, tiles[2]);
  step(1);
  expect(s.ecs.spatial[player]).not.toEqual(start);
});

it("shows real food-seeking and sleep walks while a timber order is interrupted", () => {
  const { state: s, player, person } = peopleWorld(), p = s.ecs.planner[player];
  s.ecs.manager[player].jobs.push({ assignedId: player, targetId: person, job: { key: "cut_tree_down" } });
  p.world.feeling.hungry = true; p.task = ["walk_to", "food"];
  expect(currentActivity(s.ecs, player, t)).toBe("Getting food");
  p.world.feeling.hungry = false; p.task = ["walk_to", "sleep"];
  expect(currentActivity(s.ecs, player, t)).toBe("Going to sleep");
});

it("does not relocate an uncommanded hungry tired player for remote food or a bed; needs and supplies stay real", () => {
  const { state: s, player, tiles, step } = peopleWorld();
  const { newEntities } = require("game/entities");
  const [store] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]] }, container: { capacity: 10, amounts: { grain: 2 } }, controllable: { controllerId: player } }]);
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]] }, sleepable: { capacity: 1, occupiers: [] }, controllable: { controllerId: player } }]);
  s.ecs.personable[player].hunger = 1.2; s.ecs.personable[player].tiredness = 1.2;
  const start = { ...s.ecs.spatial[player] };
  step(8);
  expect(s.ecs.spatial[player]).toEqual(start);
  expect(s.ecs.personable[player].hunger).toBeGreaterThan(1.5);
  expect(s.ecs.personable[player].tiredness).toBeGreaterThan(1.5);
  expect(s.ecs.container[store].amounts.grain).toBe(2);
  expect(s.ecs.manager[player].jobs).toHaveLength(0);
});

it("eats a real owned meal within reach and rests by a reachable bed without changing idle position", () => {
  const { state: s, player, step } = peopleWorld();
  const { newEntities } = require("game/entities");
  const [store] = newEntities(s, [{ spatial: { ...s.ecs.spatial[player] }, container: { capacity: 10, amounts: { grain: 1 } }, controllable: { controllerId: player } }]);
  newEntities(s, [{ spatial: { ...s.ecs.spatial[player] }, sleepable: { capacity: 1, occupiers: [] }, controllable: { controllerId: player } }]);
  s.villages.village.sharedPlaces = [];
  s.days = 19 / 24; s.ecs.planner[player].world.days = s.days;
  s.ecs.personable[player].hunger = 1.2; s.ecs.personable[player].tiredness = 1.2;
  const start = { ...s.ecs.spatial[player] };
  step(12);
  expect(s.ecs.spatial[player]).toEqual(start);
  expect(s.ecs.container[store].amounts.grain).toBe(0);
  expect(s.ecs.personable[player].hunger).toBeLessThan(.6);
  expect(s.ecs.personable[player].tiredness).toBeLessThan(.3);
});

it("explicit food and rest orders allow physical self-care and complete without discarding other work", () => {
  const { state: s, player, tiles, step } = peopleWorld();
  const { newEntities } = require("game/entities");
  const [store] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[2]] }, container: { capacity: 10, amounts: { grain: 2 } }, controllable: { controllerId: player } }]);
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[2]] }, sleepable: { capacity: 1, occupiers: [] }, controllable: { controllerId: player } }]);
  s.villages.village.sharedPlaces = [];
  s.ecs.personable[player].hunger = 1.2;
  const food = enqueueTask(s, { key: "find_food" }, player);
  const move = enqueueTask(s, { key: "move_to_here" }, tiles[4]);
  step(5);
  expect(s.ecs.container[store].amounts.grain).toBe(1);
  expect(food.progress).toBe(1); expect(move.progress).toBe(1);
  s.ecs.personable[player].tiredness = 1.2;
  const rest = enqueueTask(s, { key: "rest" }, player);
  step(12);
  expect(rest.progress).toBe(1);
  expect(s.ecs.personable[player].tiredness).toBeLessThan(.6);
});

it("an idle player cannot eat a nearby stranger's stores", () => {
  const { state: s, player, person, step } = peopleWorld();
  const { newEntities } = require("game/entities");
  const [store] = newEntities(s, [{ spatial: { ...s.ecs.spatial[player] }, container: { capacity: 10, amounts: { grain: 1 } }, controllable: { controllerId: person } }]);
  s.ecs.personable[player].hunger = 1.2;
  step(2);
  expect(s.ecs.container[store].amounts.grain).toBe(1);
  expect(s.ecs.personable[player].hunger).toBeGreaterThan(1.2);
});

it("cancelling the only explicit order also stops its automatic food trip, leaving the player where cancelled", () => {
  const { state: s, player, tiles, step } = peopleWorld();
  const { newEntities } = require("game/entities"), { cancelTask } = require("game/manager");
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[5]] }, container: { capacity: 10, amounts: { grain: 1 } }, controllable: { controllerId: player } }]);
  s.ecs.personable[player].hunger = 1.2;
  const order = enqueueTask(s, { key: "move_to_here" }, tiles[4]);
  step(.1);
  cancelTask(s, order.id);
  const at = { ...s.ecs.spatial[player] };
  step(2);
  expect(s.ecs.spatial[player]).toEqual(at);
  expect(s.ecs.manager[player].jobs).toHaveLength(0);
  expect(s.ecs.personable[player].hunger).toBeGreaterThan(1.2);
});

it("explains unmet idle needs and offers explicit care without claiming an eating interruption", () => {
  const { state: s, player } = peopleWorld();
  const { TaskPanel } = require("../src/components/task_panel");
  s.ecs.personable[player].hunger = 1.2; s.ecs.personable[player].tiredness = 1.2;
  s.ecs.planner[player].world.feeling.hungry = true;
  const html = renderToStaticMarkup(<GameState.Provider value={s}><TaskPanel/></GameState.Provider>);
  expect(html).toContain("You stay here. Choose Find food");
  expect(html).toContain(">Find food</button>"); expect(html).toContain(">Rest</button>");
  expect(html).not.toContain("Stopped to eat");
});
