import { peopleWorld } from "./support/people";
import { createPossession, transferPossession } from "game/possessions";
import { disclosedPossessions } from "game/biography";
import { displayName, knownKinship } from "game/knowledge";
import { giftChoices } from "game/gift_choices";

it("keeps disclosed possession makers and previous owners anonymous until their names are learned", () => {
  const {state: s, player, person, parent, sibling} = peopleWorld();
  s.ecs.relationships[player].known[person] = {ring: "public", goodwill: 0};
  const item = createPossession(s, parent, "Miller ring");
  transferPossession(s, item, sibling, "gift");
  transferPossession(s, item, person, "inheritance");
  s.knowledge[player] = {people: {[person]: {possessions: [item]}}, feelings: {}, events: []};
  const before = JSON.stringify(s);
  const [possession] = disclosedPossessions(s, player, person);
  const names = () => possession.owners.map(o => displayName(s, o.personId));
  expect(possession.name).toBe("Miller ring");
  expect(displayName(s, possession.maker)).toBe("an unknown person");
  expect(displayName(s, possession.originalOwner)).toBe("an unknown person");
  expect(names()).toEqual(["an unknown person", "an unknown person", "Agnes Miller"]);
  expect(JSON.stringify(s)).toBe(before);
  s.ecs.relationships[player].known[parent] = {ring: "public", goodwill: 0};
  s.knowledge[player].people[sibling] = {};
  expect(displayName(s, possession.maker)).toBe("Edith Miller");
  expect(names()).toEqual(["Edith Miller", "Alice Miller", "Agnes Miller"]);
  expect(s.ecs.relationships[person].known[player]).toBeUndefined();
});

it("keeps an owned gift's identity and provenance without introducing its earlier owners", () => {
  const {state: s, player, parent, sibling} = peopleWorld();
  const item = createPossession(s, parent, "Ashdown keepsake");
  transferPossession(s, item, sibling, "gift");
  transferPossession(s, item, player, "inheritance");
  const before = JSON.stringify(s);
  const choice = giftChoices(s, player).find(c => c.gift.sourceId == item);
  expect(choice.gift.possession.name).toBe("Ashdown keepsake");
  expect(choice.amount).toBe(1);
  const names = () => choice.gift.possession.owners.map(o => displayName(s, o.personId));
  expect(names()).toEqual(["an unknown person", "an unknown person", "Will Ashdown"]);
  expect(JSON.stringify(s)).toBe(before);
  s.ecs.relationships[player].known[parent] = {ring: "public", goodwill: 0};
  s.knowledge[player] = {people: {[sibling]: {}}, feelings: {}, events: []};
  expect(names()).toEqual(["Edith Miller", "Alice Miller", "Will Ashdown"]);
  expect(s.ecs.possession[item].ownerId).toBe(player);
  expect(s.ecs.possession[item].owners.map(o => o.personId)).toEqual([parent, sibling, player]);
});

it("requires a disclosed kin link even when all names and a close bond are known", () => {
  const {state: s, player, person, parent, sibling} = peopleWorld();
  s.ecs.relationships[person].known[player] = {ring: "personal", goodwill: 36};
  s.knowledge = {[player]: {people: Object.fromEntries([person, parent, sibling].map(id => [id, {traits: []}])), feelings: {}}};
  expect(knownKinship(s, player, person, parent)).toBe(false);
  expect(knownKinship(s, player, person, sibling)).toBe(false);
  s.knowledge[player].kinLinks = {sister: {speaker_id: person, relative_id: sibling, kinship: "sibling"}};
  expect(knownKinship(s, player, person, sibling)).toBe(true);
  expect(knownKinship(s, player, person, parent)).toBe(false);
});
