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
