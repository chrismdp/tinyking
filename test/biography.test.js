import { peopleWorld } from "./support/people";
import { biography } from "game/biography";
import { chat, askAbout } from "game/people";
import { recordEvent, learnEvent } from "game/events";
import { createPossession, transferPossession } from "game/possessions";
const read = (s, viewer, person) => biography(s, viewer, person, id => s.ecs.nameable[id]?.nickname);

it("does not disclose a private quarrel at acquaintance trust, and learns it at friendship without granting contact with the subject", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  const event = recordEvent(s, "quarrel", [person, sibling]);
  s.knowledge[player] = { people: {}, feelings: {}, events: [] };
  s.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  chat(s, player, person);
  expect(s.knowledge[player].events).not.toContain(event.id);
  expect(JSON.stringify(read(s, player, person))).not.toContain("Fell out");
  s.ecs.relationships[person].known[player].ring = "personal";
  askAbout(s, player, person, sibling);
  expect(s.knowledge[player].events).toContain(event.id);
  expect(read(s, player, person).some(f => f.eventId == event.id)).toBe(true);
  expect(s.knowledge[player].people[sibling].conversation).toBeUndefined();
});

it("uses learned parent loss without claiming care; keeps the exact date after kin move or die", () => {
  const { state: s, player, person, parent, sibling, tiles } = peopleWorld();
  s.days = -15;
  const death = recordEvent(s, "death", [parent]);
  s.ecs.personable[parent].dead = true;
  s.ecs.household[sibling].houseId = tiles[5];
  s.knowledge[player] = { people: {}, feelings: {}, events: [] };
  s.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  chat(s, player, person);
  const facts = read(s, player, person);
  expect(facts).toContainEqual({ key: death.id, text: "Lost their mother, Edith Miller, in winter of year -1.", eventId: death.id });
  expect(JSON.stringify(facts)).not.toMatch(/raised|looked after/);
  s.residents = { [player]: true };
  delete s.ecs.spatial[parent]; delete s.ecs.spatial[person];
  expect(read(s, player, person)).toEqual(facts);
});

it("requires the actual learned inheritance event and current custody; a gift chain cannot become inherited from the maker", () => {
  const { state: s, player, person, parent, sibling } = peopleWorld();
  const item = createPossession(s, parent, "Old adze", "tool");
  transferPossession(s, item, sibling, "gift");
  transferPossession(s, item, person, "inheritance");
  s.ecs.relationships[person].known[player] = { ring: "personal", goodwill: 36 };
  chat(s, player, person);
  let facts = read(s, player, person);
  expect(facts[0].text).toBe("Still carries Old adze, inherited from Alice Miller.");
  expect(facts[0].itemId).toBe(item);
  s.ecs.possession[item].carried = false;
  expect(read(s, player, person).some(f => f.text.startsWith("Still carries"))).toBe(false);
  s.ecs.possession[item].carried = true;
  s.knowledge[player].events = [];
  expect(read(s, player, person).some(f => f.itemId == item)).toBe(false);
});

it("returns two stable distinctive facts from learned evidence and does not use unlearned world events", () => {
  const { state: s, player, person, sibling, parent } = peopleWorld();
  s.knowledge ||= {};
  s.knowledge[player] = { people: { [person]: { conversation: { day: 0 } } }, feelings: {}, events: [] };
  const unknown = recordEvent(s, "marriage", [person, sibling]);
  s.knowledge[player].events = [];
  expect(read(s, player, person)[0].key).toBe("unknown");
  const move = recordEvent(s, "move", [person], [], { toHouse: "lost-home", toVillage: "village" });
  const born = recordEvent(s, "birth", [parent, person, sibling]);
  learnEvent(s, player, move); learnEvent(s, player, born);
  s.knowledge[player].events = [move.id, born.id];
  const before = JSON.stringify(s), facts = read(s, player, person);
  expect(facts).toHaveLength(2);
  expect(facts.map(f => f.eventId)).not.toContain(unknown.id);
  expect(read(s, player, person)).toEqual(facts);
  expect(JSON.stringify(s)).toBe(before);
});
