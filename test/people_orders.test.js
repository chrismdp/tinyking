import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { peopleWorld } from "./support/people";
import { enqueueTask, cancelTask } from "game/manager";
import { newEntities } from "game/entities";
import { giftChoices } from "game/gift_choices";
import { give } from "game/holder";
import { TaskPanel } from "../src/components/task_panel";
import { GameState } from "../src/components/contexts";
import * as compound from "game/compound";
import * as primitive from "game/primitive";
import * as tasks from "game/tasks";
import rules from "../src/data/jobs.json";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));

it("walks to chat, takes time and meets only through interaction, never changing control", () => {
  const { state, player, person, step } = peopleWorld();
  const task = enqueueTask(state, { key: "chat" }, person);
  expect(state.ecs.relationships[player].known).toEqual({});
  step(0.1);
  expect(task.progress).toBeLessThan(1);
  step(2);
  expect(state.ecs.manager[player].jobs).toEqual([]);
  expect(state.ecs.relationships[person].known[player].goodwill).toBeGreaterThan(1);
  expect(state.ecs.relationships[player].known[person]).toBeDefined();
  expect(state.ecs.controllable[person].controllerId).toBe(person);
  expect(state.ecs.planner[person].world.capturedBy).toBeFalsy();
});

it("carries a real gift from a store, transfers one item and earns goodwill on completion", () => {
  const { state, player, person, tiles, step } = peopleWorld();
  const [store] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[1]], immovable: true }, container: { capacity: 10, amounts: { wood: 2 } }, controllable: { controllerId: player } }]);
  const task = enqueueTask(state, { key: "give_gift" }, person, { gift: { sourceId: store, type: "wood" } });
  step(0.05);
  expect(state.ecs.container[store].amounts.wood).toBe(2);
  expect(state.ecs.relationships[person].known[player]).toBeUndefined();
  step(3);
  expect(task.progress).toBe(1);
  expect(state.ecs.container[store].amounts.wood).toBe(1);
  expect(state.ecs.relationships[person].known[player].goodwill).toBeGreaterThan(2);
  expect(Object.keys(state.ecs.good).some(id => state.ecs.good[id].type == "wood" && state.ecs.controllable[id].controllerId == person)).toBe(true);
});

it("rechecks trust on arrival for ask about, and reports the refusal while advancing", () => {
  const { state, player, person, sibling, step } = peopleWorld();
  const task = enqueueTask(state, { key: "ask_about" }, person, { aboutId: sibling });
  step(2);
  expect(task.progress).toBe(1);
  expect(state.ui.talkResult.message).toContain("trust you");
  expect(state.knowledge?.[player]?.feelings[person]).toBeUndefined();
});

it("learns gossip and family names only after completing a queued visit", () => {
  const { state, player, person, parent, sibling, step } = peopleWorld();
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16, base: 16 };
  enqueueTask(state, { key: "ask_about" }, person, { aboutId: sibling });
  expect(state.knowledge).toBeUndefined();
  step(0.05);
  expect(state.knowledge).toBeUndefined();
  step(2);
  expect(state.ecs.manager[player].jobs).toEqual([]);
  expect(state.knowledge[player].feelings[person][sibling]).toBe("social");
  expect(state.knowledge[player].people[parent]).toBeDefined();
  expect(state.ecs.relationships[player].known[parent]).toBeUndefined();
});

it("feeds the player automatically, displays an interruption and resumes partially finished queued work", () => {
  const { state, player, tiles, step } = peopleWorld();
  const task = enqueueTask(state, { key: "create_field" }, tiles[0]);
  enqueueTask(state, { key: "move_to_here" }, tiles[5]);
  step(0.05);
  expect(task.progress).toBeGreaterThan(0);
  state.ecs.personable[player].hunger = 1.2;
  newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[1]], immovable: true }, forageable: { kind: "roots", biome: "grassland", amount: 2, growth: 0 } }]);
  step(0.1);
  const html = renderToStaticMarkup(<GameState.Provider value={state}><TaskPanel/></GameState.Provider>);
  expect(html).toContain("Stopped to eat");
  expect(state.ecs.manager[player].jobs.map(j => j.job.key)).toEqual(["create_field", "move_to_here"]);
  step(4);
  expect(state.ecs.personable[player].hunger).toBeLessThan(0.5);
  expect(task.progress).toBe(1);
  expect(state.ecs.manager[player].jobs).toEqual([]);
});

it("releases a conversation partner when the task is cancelled", () => {
  const { state, player, person, step } = peopleWorld();
  const task = enqueueTask(state, { key: "chat" }, person);
  step(0.05);
  cancelTask(state, task.id);
  expect(state.ecs.planner[person].world.capturedBy).toBeFalsy();
  step(1);
  expect(state.ecs.relationships[person].known[player]?.goodwill || 0).toBe(0);
});

it("has no Recruit job, planner method or control-changing primitive", () => {
  expect(JSON.stringify(rules).toLowerCase()).not.toContain("recruit");
  expect(compound.recruit).toBeUndefined();
  expect(compound.check_jobs().some(m => m[0]({}, [{ job: { key: "recruit" } }]))).toBe(false);
  expect(primitive.set_controller_to_me).toBeUndefined();
  expect(tasks.set_controller_to_me).toBeUndefined();
});

it("can give a held item after walking away from where it was picked up", () => {
  const { state, player, person, tiles, step } = peopleWorld();
  const [item] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]] }, good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: player } }]);
  require("game/holder").give(state.ecs, item, player);
  state.ecs.spatial[player] = { ...state.ecs.spatial[tiles[5]] };
  const task = enqueueTask(state, { key: "give_gift" }, person, { gift: { sourceId: item, type: "wood" } });
  // Collecting something already in your hand does not require walking back.
  task.assignedId = player;
  expect(tasks.collect_gift(state, player, state.ecs.planner[player].world, 0, true, item, "wood")).toBe(require("game/htn").Task.FINISH);
  task.assignedId = null;
  step(2);
  expect(task.progress).toBe(1);
});

it("keeps a gift in hand through a meal interruption and resumes its delivery", () => {
  const { state, player, person, tiles, step } = peopleWorld();
  const [item, food] = newEntities(state, ["wood", "forage"].map(type => ({ spatial: { ...state.ecs.spatial[tiles[0]] }, good: { type, amount: 1 }, haulable: {}, controllable: { controllerId: player } })));
  require("game/holder").give(state.ecs, food, player);
  state.ecs.planner[player].world.holding.forage = true;
  const task = enqueueTask(state, { key: "give_gift" }, person, { gift: { sourceId: item, type: "wood" } });
  step(0.02);
  expect(task.giftItem).toBe(item);
  state.ecs.personable[player].hunger = 1.2;
  step(3);
  expect(task.progress).toBe(1);
  expect(state.ecs.controllable[item].controllerId).toBe(person);
  expect(state.ecs.personable[player].hunger).toBeLessThan(0.5);
});

it("delivers an already held gift when its old ground position is unreachable", () => {
  const { state, player, person, tiles, step } = peopleWorld();
  const [item] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]] }, good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: player } }]);
  require("game/holder").give(state.ecs, item, player);
  state.ecs.planner[player].world.holding.wood = true;
  state.ecs.spatial[player] = { ...state.ecs.spatial[tiles[5]] };
  for (const side of Object.keys(state.ecs.walkable[tiles[0]].neighbours)) {
    require("game/pathfinding").removeBidirectionalLink(state.ecs, tiles[0], +side);
  }
  const task = enqueueTask(state, { key: "give_gift" }, person, { gift: { sourceId: item, type: "wood" } });
  step(2);
  expect(task.progress).toBe(1);
  expect(state.ecs.controllable[item].controllerId).toBe(person);
  expect(state.ecs.relationships[player].known[person]).toBeDefined();
  expect(state.ecs.relationships[person].known[player]).toBeDefined();
});


it.each(["held", "loose", "container", "stockpile"])("delivers exactly one real portion selected from %s choices with total ownership conserved", source => {
  const { state, player, person, tiles, step } = peopleWorld();
  state.ecs.interior ||= {};
  const [supply, stockpile, foreign] = newEntities(state, [
    { spatial: { ...state.ecs.spatial[tiles[0]] }, controllable: { controllerId: player },
      ...(source == "container" ? { container: { amounts: { wood: 3 }, capacity: 10 } } : { good: { type: "wood", amount: 3 }, haulable: {} }) },
    { spatial: { ...state.ecs.spatial[tiles[0]] }, holder: { held: [], capacity: 10 }, stockpile: {}, controllable: { controllerId: player } },
    { spatial: { ...state.ecs.spatial[tiles[0]] }, container: { amounts: { wood: 7 } }, controllable: { controllerId: person } }
  ]);
  if (source == "held") give(state.ecs, supply, player);
  if (source == "stockpile") give(state.ecs, supply, stockpile);
  const total = owner => Object.entries(state.ecs.good || {}).reduce((n, [id, good]) => n + (state.ecs.controllable[id]?.controllerId == owner && good.type == "wood" ? good.amount : 0), 0) +
    Object.entries(state.ecs.container || {}).reduce((n, [id, c]) => n + (state.ecs.controllable[id]?.controllerId == owner ? c.amounts.wood || 0 : 0), 0);
  const choice = giftChoices(state, player).find(c => c.gift.sourceId == supply);
  const metadata = JSON.parse(JSON.stringify(choice.gift));
  const task = enqueueTask(state, { key: "give_gift" }, person, { gift: choice.gift });
  for (let i = 0; i < 500 && task.progress < 1; i++) step(0.02);
  expect(task.progress).toBe(1);
  expect(task.gift).toEqual(metadata);
  expect(total(player)).toBe(2);
  expect(total(person)).toBe(8);
  expect(state.ecs.container[foreign].amounts.wood).toBe(7);
  expect(state.ecs.good[task.giftItem]).toMatchObject({ type: "wood", amount: 1 });
  expect(state.ecs.controllable[task.giftItem].controllerId).toBe(person);
});

it("leaves a collected choice in hand on cancellation and waits if the chosen source disappears", () => {
  const { state, player, person, tiles, step } = peopleWorld();
  const [supply] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[0]] }, good: { type: "wood", amount: 2 }, haulable: {}, controllable: { controllerId: player } }]);
  const gift = giftChoices(state, player)[0].gift;
  const task = enqueueTask(state, { key: "give_gift" }, person, { gift });
  step(0.02);
  expect(task.giftItem).toBeDefined();
  cancelTask(state, task.id);
  expect(state.ecs.haulable[task.giftItem].heldBy).toBe(player);
  expect(state.ecs.controllable[task.giftItem].controllerId).toBe(player);
  expect(state.ecs.good[supply].amount).toBe(1);
  expect(state.ecs.relationships[person].known[player]).toBeUndefined();
  const unavailable = enqueueTask(state, { key: "give_gift" }, person, { gift });
  state.ecs.controllable[supply].controllerId = person;
  step(0.1);
  expect(unavailable.waiting).toBe("Gift no longer available");
  expect(unavailable.progress).toBe(0);
  expect(state.ecs.good[supply].amount).toBe(1);
});
