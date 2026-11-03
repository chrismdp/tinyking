import { peopleWorld } from "./support/people";
import { recordEvent, learnEvent, knownEvents, eventSentence } from "game/events";
import { displayName } from "game/knowledge";
import { beginInteraction, askAbout } from "game/people";

const news = s => knownEvents(s, s.ui.playerId).map(e => eventSentence(s, e, id => displayName(s, id))).join(" ");

it("describes a dated learned wedding with known participants", () => {
  const {state: s, player, person, sibling} = peopleWorld();
  s.ecs.relationships[player].known[person] = {ring: "public"};
  s.ecs.relationships[player].known[sibling] = {ring: "public"};
  s.events = [];
  const event = recordEvent(s, "marriage", [person, sibling]);
  learnEvent(s, player, event);
  expect(knownEvents(s, player)).toEqual([event]);
  for(const identity of ["Agnes Miller", "Alice Miller", "Withyford"])expect(news(s)).toContain(identity);
});

it("excludes distant unwitnessed events and generated history even with a raw name resolver", () => {
  const {state: s, player, person, sibling} = peopleWorld();
  s.ecs.spatial[player].x -= 2000;
  s.personName = id => s.ecs.nameable[id]?.nickname;
  recordEvent(s, "marriage", [person, sibling]);
  s.generatingHistory = true; s.days = -3;
  recordEvent(s, "birth", [person, sibling]);
  expect(knownEvents(s, player)).toEqual([]);
});

it("keeps an unknown participant anonymous in legitimately learned news", () => {
  const {state: s, player, person, sibling} = peopleWorld();
  s.ecs.spatial[player].x -= 2000;
  const event = recordEvent(s, "marriage", [person, sibling]);
  s.ecs.relationships[player].known[person] = {ring: "public", goodwill: 0};
  learnEvent(s, player, event);
  s.personName = id => s.ecs.nameable[id]?.nickname;
  expect(news(s)).toContain("Agnes Miller");
  expect(news(s)).toContain("an unknown person");
  expect(news(s)).not.toContain("Alice Miller");
});

it("requires spoken evidence for a visit and real disclosure for a distant historical move", () => {
  const {state: s, player, person, sibling} = peopleWorld();
  beginInteraction(s, player, person);
  s.events = [];
  const visit = recordEvent(s, "visit", [person, sibling], [], {toVillage: "village"});
  expect(knownEvents(s, player)).not.toContain(visit);
  learnEvent(s, player, visit);
  (s.knowledge[player].spokenSources ||= {})[visit.id] = {speakerId: person, day: s.days};
  expect(knownEvents(s, player)).toContain(visit);
  s.ecs.spatial[player].x -= 2000; s.days = -3; s.generatingHistory = true;
  const event = recordEvent(s, "move", [sibling], [], {toHouse: s.ecs.household[sibling].houseId, toVillage: "village"});
  expect(knownEvents(s, player)).not.toContain(event);
  s.ecs.relationships[person].known[player] = {ring: "social", goodwill: 16};
  learnEvent(s, person, event);
  expect(askAbout(s, player, person, sibling).ok).toBe(true);
  for(const identity of ["Alice Miller", "Miller cottage", "Withyford"])expect(news(s)).toContain(identity);
});

it.each(["departure", "world_visit", "return", "world_move", "household_join", "settlement"])("scopes learned %s news and participant names to the current actor", type => {
  const {state: s, player, person, sibling} = peopleWorld();
  s.personName = id => s.ecs.nameable[id]?.nickname;
  s.ecs.relationships[player].known[person] = {ring: "public", goodwill: 0};
  s.ecs.spatial[player].x -= 2000;
  const event = recordEvent(s, type, [person, sibling], [], {fromWorld: "5,3", toWorld: "6,3", villageId: "village"});
  expect(knownEvents(s, player)).not.toContain(event);
  learnEvent(s, player, event);
  if (["world_visit", "return"].includes(type)) (s.knowledge[player].spokenSources ||= {})[event.id] = {speakerId: person, day: s.days};
  expect(knownEvents(s, player)).toContain(event);
  expect(news(s)).toContain("Agnes Miller");
  expect(news(s)).not.toContain("Alice Miller");
  s.ui.playerId = sibling;
  // A participant knows their own event. Their account still cannot identify
  // the other participant without an introduction or disclosed name.
  expect(knownEvents(s, sibling)).toContain(event);
  expect(news(s)).not.toContain("Agnes Miller");
});
