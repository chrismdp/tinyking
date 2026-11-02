import { homeState } from "game/residents";
import { displayName } from "game/knowledge";
import { peopleWorld } from "./support/people";
import { knownFamilyTree, siblingsOf } from "game/people";
import { closeFamily } from "game/events";
import { heirFor } from "game/possessions";

jest.mock("game/name", () => ({ name: n => n.nickname }));

it("reads directory-only subjects, siblings, parents and spouses without mutating or disclosing strangers", () => {
  const { state: s, player, person, parent, sibling } = peopleWorld();
  s.residents = { [player]: true };
  const baseline = knownFamilyTree(s, player, person);
  const family = closeFamily(s, person), heir = heirFor(s, person);
  s.peopleDirectory = {};
  for (const id of Object.keys(s.ecs.personable).filter(id => id != player)) {
    s.peopleDirectory[id] = {};
    for (const key of ["personable", "kinship", "relationships", "personality", "nameable", "household", "village", "controllable"]) {
      s.peopleDirectory[id][key] = s.ecs[key]?.[id];
      delete s.ecs[key]?.[id];
    }
  }
  const before = JSON.stringify(s);
  expect(siblingsOf(s, person)).toContain(sibling);
  expect(closeFamily(s, person)).toEqual(family);
  expect(heirFor(s, person)).toBe(heir);
  expect(knownFamilyTree(s, player, person)).toEqual(baseline);
  expect(knownFamilyTree(s, person, parent).rootId).toBe(parent);

  expect(JSON.stringify(s)).toBe(before);
});

it.each([true, false])("reads a remote household owner and heir from its saved map without disclosing an unknown owner (known=%s)", known => {
  const {state, player, person, parent, tiles} = peopleWorld(), home = tiles[3];
  state.ecs.relationships[player].known[person] = {ring: "public", goodwill: 0};
  if (known) state.ecs.relationships[player].known[parent] = {ring: "public", goodwill: 0};
  state.knowledge = {[player]: {people: {}, feelings: {}, kinLinks: {heard_parent: {speaker_id: person, relative_id: parent, kinship: "parent"}}}};
  const remote = {ecs: structuredClone(state.ecs)};
  state.travel = {maps: {"0,0": remote}, people: {}};
  state.residents = {[player]: true};
  for (const id of [person, parent]) {
    state.travel.people[id] = Object.fromEntries(Object.entries(remote.ecs).filter(([, records]) => records[id]).map(([key, records]) => [key, records[id]]));
    for (const records of Object.values(state.ecs)) if (records && typeof records == "object") delete records[id];
  }
  for (const records of Object.values(state.ecs)) if (records && typeof records == "object") delete records[home];
  const before = JSON.stringify(state);
  const estate = homeState(state, person);
  expect(estate).toBe(remote);
  expect(estate.ecs.controllable[home].controllerId).toBe(parent);
  expect(heirFor({...state, ecs: estate.ecs, residents: estate.residents}, parent)).toBe(person);
  expect(displayName(state, parent)).toBe(known ? "Edith Miller" : "an unknown person");
  expect(JSON.stringify(state)).toBe(before);
});
