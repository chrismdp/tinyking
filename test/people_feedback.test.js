import { biography } from "game/biography";
import { chooseLine, chatChoices, closeChat } from "game/chat";

import { peopleWorld } from "./support/people";
import { askAbout, beginInteraction, feelingHint } from "game/people";
import { talk } from "game/tasks";
import { Task } from "game/htn";
import { learnEvent, recordEvent } from "game/events";
import { createPossession, transferPossession } from "game/possessions";
import { enqueueTask } from "game/manager";

jest.mock("game/name", () => ({ name: n => n.nickname }));

it("requires this actor's completed physical talk, never selection, gossip, introduction or another actor's talk", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  s.ecs.relationships[person].known[player] = { ring: "personal", goodwill: 36 };

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
  expect(talk(s, player, pw, 1 / 24, false, person, "chat")).toBe(Task.CONTINUE);
  expect(feelingHint(s, person, player)).toEqual({});
  // Reading and elapsed time grant no contact until the player actually speaks.
  chooseLine(s,chatChoices(s)[0].key); closeChat(s);
  expect(feelingHint(s, person, player).ring).toBe("personal");

  s.ecs.personable[person].dead = true;

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
  expect(s.ecs.personable[player].energy).toBe(100);
  enqueueTask(s, { key: "move_to_here" }, tiles[2]);
  step(1);
  expect(s.ecs.spatial[player]).not.toEqual(start);
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
  expect(s.ecs.personable[player].energy).toBe(52);
  expect(s.ecs.personable[player].tiredness).toBeGreaterThan(1.5);
  expect(s.ecs.container[store].amounts.grain).toBe(2);
  expect(s.ecs.manager[player].jobs).toHaveLength(0);
});

it("explicit food, movement and rest complete as successive single orders", () => {
  const { state: s, player, tiles, step } = peopleWorld();
  const { newEntities } = require("game/entities");
  const [store] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[2]] }, container: { capacity: 10, amounts: { grain: 2 } }, controllable: { controllerId: player } }]);
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[2]] }, sleepable: { capacity: 1, occupiers: [] }, controllable: { controllerId: player } }]);
  s.villages.village.sharedPlaces = [];
  s.ecs.personable[player].hunger = 1.2;
  const food = enqueueTask(s,{key:"eat_food"},store,{foodType:"grain"});
  step(3);
  expect(food.progress).toBe(1);
  const move = enqueueTask(s, { key: "move_to_here" }, tiles[4]);
  step(2);
  expect(s.ecs.container[store].amounts.grain).toBe(1);
  expect(food.progress).toBe(1); expect(move.progress).toBe(1);
  step(5); // Rest now spans the actual night, ending after dawn.
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
  expect(s.ecs.personable[player].energy).toBe(52);
});

it("states disclosed asymmetric friendship in the speaker's direction and never invents romance", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  s.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  s.ecs.relationships[person].known[sibling] = { ring: "personal", goodwill: 36 };
  s.ecs.relationships[sibling].known[person] = { ring: "public", goodwill: 0 };
  askAbout(s, player, person, sibling);
  s.ecs.relationships[person].known[sibling].ring = "intimate";

  expect(s.knowledge[player].feelings[person][sibling]).toBe("personal");
  expect(s.ecs.relationships[sibling].known[person].ring).toBe("public");
  askAbout(s, player, person, sibling);

  expect(s.knowledge[player].feelings[person][sibling]).toBe("intimate");
});

it("builds a concise disclosed life from real events and item provenance, including remote/dead kin, with an honest unknown state", () => {
  const { state: s, player, person, parent, sibling } = peopleWorld();
  const item = createPossession(s, parent, "Edith's hammer", "tool");
  transferPossession(s, item, person, "inheritance");
  const death = recordEvent(s, "death", [parent]);
  recordEvent(s, "quarrel", [person, sibling]);
  s.knowledge[player] = { people: {}, feelings: {}, events: [] };
  expect(biography(s, player, person).map(f => f.text).join(" ")).toContain("Their story is not yet known");
  expect(biography(s, player, person).map(f => f.text).join(" ")).not.toContain("Edith's hammer");
  s.ecs.relationships[person].known[player] = { ring: "personal", goodwill: 36 };
  s.knowledge[player] = { people: {}, feelings: {}, events: [] };
  // Knowing a death does not prove that Agnes raised anybody.
  learnEvent(s, player, death);
  beginInteraction(s, player, person);
  Object.assign(s.ecs.spatial[player], s.ecs.spatial[person]);
  talk(s, player, s.ecs.planner[player].world, 1 / 24, true, person, "chat");
  chooseLine(s,chatChoices(s)[0].key); closeChat(s);
  // Provenance requires disclosed evidence, rather than an automatic chat dump.
  askAbout(s,player,person,parent);
  s.ecs.personable[parent].dead = true;
  s.residents = { [player]: true, [person]: true, [sibling]: true };
  const story = biography(s, player, person).map(f => f.text).join(" ");
  expect(story).toContain("Still carries Edith's hammer, inherited from Edith Miller");
  expect(story).not.toMatch(/raised|looked after|brought up/);
  const before = JSON.stringify(s);
  expect(biography(s, player, person).map(f => f.text).join(" ")).toBe(story);
  expect(JSON.stringify(s)).toBe(before);
  s.ecs.personable[person].dead = true;
  expect(biography(s, player, person).map(f => f.text).join(" ")).not.toContain("Still carries");
});
