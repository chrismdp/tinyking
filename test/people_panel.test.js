import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonPanel, FamilyTree, layoutFamily } from "../src/components/person_panel";
import { GameState } from "../src/components/contexts";
import { peopleWorld } from "./support/people";
import { knownFamilyTree, askAbout } from "game/people";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));

const render = (state, view) => renderToStaticMarkup(<GameState.Provider value={state}>{view}</GameState.Provider>);

it("shows only an impression and learned traits at Public, and the true ring at Social", () => {
  const { state, player, person, parent } = peopleWorld();
  const panel = () => render(state, <PersonPanel entityId={person}/>);
  let html = panel();
  for (const text of ["Agnes Miller", "30 years · Withyford", "Miller cottage", "Traits you know", "seems polite", "Public", "An impression.", "Goodwill with Agnes", "0 / 10", "10 more towards Social", "People seen with", "Open family tree", "Chat", "Ask about someone", "Give a gift"]) expect(html).toContain(text);
  expect(html).not.toContain("Generous");
  expect(html).not.toContain("Edith Miller");
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  html = panel();
  for (const text of ["trusts you", "Social", "family tree and gossip", "Generous", "Proud", "closest people", "Edith Miller", "16 / 30"]) expect(html).toContain(text);
  expect(html).not.toContain("An impression.");
  expect(knownFamilyTree(state, player, person).nodes[parent]).toBeDefined();
});

it("renders connected placeholders and replaces them after a conversation, with selectable known people", () => {
  const { state, player, person, parent, sibling } = peopleWorld();
  const tree = () => render(state, <FamilyTree entityId={sibling}/>);
  let html = tree();
  expect(html).toContain("Not yet known");
  expect(html).not.toContain("Edith Miller");
  expect(html).toContain("kinline");
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  askAbout(state, player, person, sibling);
  state.ecs.personable[parent].dead = true;
  html = tree();
  for (const text of ["The family of Alice Miller", "3 of 3 names known", "† Edith Miller", "Unmarried adult", "Heir", "Select Agnes Miller"]) expect(html).toContain(text);
  expect(html).not.toContain("Not yet known");
});

it("lays out large families without card overlap and keeps spouses on the same row", () => {
  const nodes = { root: { id: "root", parents: [], children: [], spouse: null, siblings: [] } };
  for (let i = 0; i < 25; i++) {
    const id = "c" + i, spouse = "s" + i;
    nodes.root.children.push(id);
    nodes[id] = { id, parents: ["root"], children: [], siblings: [], spouse };
    nodes[spouse] = { id: spouse, parents: [], children: [], siblings: [], spouse: id };
  }
  const { positions, width } = layoutFamily({ rootId: "root", nodes });
  expect(Object.keys(positions)).toHaveLength(51);
  expect(width).toBeGreaterThan(1000);
  for (const a in positions) for (const b in positions) if (a != b && positions[a].y == positions[b].y) {
    expect(Math.abs(positions[a].x - positions[b].x)).toBeGreaterThanOrEqual(164);
  }
  expect(positions.c24.y).toBe(positions.s24.y);
});

it("uses household family names and the correct object pronoun in the public panel", () => {
  const { state, person, parent, tiles } = peopleWorld();
  state.ecs.nameable[person].male = true;
  state.ecs.nameable[tiles[3]].nickname = "Log cabin";
  state.ecs.nameable[parent].nickname = "Edith Miller";
  const html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("Miller cottage · Miller household");
  expect(html).toContain("People seen with him");
  expect(html).toContain("1 name known");
});

it("marks the eldest living child as the heir even when they live in another household", () => {
  const { state, player, person, parent, sibling, tiles } = peopleWorld();
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  state.ecs.household[person].houseId = tiles[4];
  state.ecs.controllable[tiles[4]] = { controllerId: person };
  const html = render(state, <FamilyTree entityId={person}/>);
  expect(html).toMatch(/aria-label="Select Agnes Miller[^\"]*◇ Heir/);
  state.ecs.personable[person].dead = true;
  const after = render(state, <FamilyTree entityId={person}/>);
  expect(after).toMatch(/aria-label="Select Alice Miller[^\"]*◇ Heir/);
  expect(state.ecs.kinship[parent].children).toEqual([person, sibling]);
});
