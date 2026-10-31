import React from "react";
import { I18n } from "react-polyglot";
import messages from "../src/data/messages.json";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonPanel, FamilyTree, layoutFamily } from "../src/components/person_panel";
import { GameState } from "../src/components/contexts";
import { peopleWorld } from "./support/people";
import { knownFamilyTree, askAbout, completeConversation } from "game/people";
import { createPossession, transferPossession } from "game/possessions";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));

const render = (state, view) => renderToStaticMarkup(<I18n locale="en" messages={messages}><GameState.Provider value={state}>{view}</GameState.Provider></I18n>);

it.each([
  [false, "She", "her", "her"], [true, "He", "his", "him"], [undefined, "They", "their", "them"]
])("explains earned help in their Personal/Intimate ring with consistent pronouns (%s)", (male, pronoun, possessive, object) => {
  const { state, player, person, sibling } = peopleWorld();
  state.ecs.nameable[person].male = male;
  // The player"s closer opinion alone must not promise help or reveal kin.
  state.ecs.relationships[player].known[person] = { ring: "intimate", goodwill: 65 };
  let html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("You have not spoken together yet");
  expect(html).not.toContain("can help");
  expect(html).not.toContain("Alice Miller");
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  completeConversation(state, player, person);
  html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain(`${pronoun} ${pronoun == "They" ? "share" : "shares"} ${possessive} family tree and gossip.`);
  expect(html).not.toContain("can help");
  for (const ring of ["personal", "intimate"]) {
    state.ecs.relationships[person].known[player] = { ring, goodwill: ring == "personal" ? 36 : 65 };
    state.ecs.planner[person].task = ["help_friend_work"];
    state.ecs.planner[person].world.helpingFriend = { kind: "build" };
    const before = JSON.stringify(state);
    html = render(state, <PersonPanel entityId={person}/>);
    expect(html).toContain(`${pronoun} ${pronoun == "They" ? "consider" : "considers"} you ${ring == "personal" ? "a friend" : "one of " + possessive + " closest friends"}.`);
    expect(html).toContain(`${pronoun} can help with your building or field when free and fed.`);
    expect(html).toContain("Deliver building materials first.");
    expect(html).toContain(`Help comes in ${possessive} own time; you do not control ${object}.`);
    expect(html).not.toContain("marriage");
    expect(html).toContain("Helping build a friend&#x27;s home");
    expect(JSON.stringify(state)).toBe(before);
    expect(state.ecs.relationships[person].known[sibling].ring).toBe("social");
  }
});

it.each(["dead", "child"])("does not add a promise of help to a %s Personal bond", kind => {
  const { state, player, person } = peopleWorld();
  state.ecs.relationships[person].known[player] = { ring: "personal", goodwill: 36 };
  if (kind == "dead") state.ecs.personable[person].dead = true;
  else state.ecs.personable[person].age = 12;
  completeConversation(state, player, person);
  const html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain(kind == "dead" ? "Their feelings are part of the past." : "She shares her family tree and gossip.");
  expect(html).not.toContain("can help");
});

it("keeps unknown possession makers and past owners anonymous until their names are learned", () => {
  const { state, player, person, parent, sibling } = peopleWorld();
  state.ecs.relationships[player].known[person] = { ring: "public", goodwill: 0 };
  const item = createPossession(state, parent, "Miller ring");
  transferPossession(state, item, sibling, "gift");
  transferPossession(state, item, person, "inheritance");
  // A previously disclosed item does not introduce its maker or previous owners.
  state.knowledge[player] = { people: { [person]: { possessions: [item] } }, feelings: {}, events: [] };
  const before = JSON.stringify(state);
  const panel = () => render(state, <PersonPanel entityId={person}/>);
  const tree = render(state, <FamilyTree entityId={person}/>);
  expect(tree).not.toContain("Edith Miller");
  expect(tree).not.toContain("Alice Miller");
  let html = panel();
  expect(html).toContain("Miller ring");
  expect(html).toContain("Made by an unknown person. First owned by an unknown person.");
  expect(html).toContain("an unknown person (made) → an unknown person (gift) → Agnes Miller (inheritance)");
  expect(html).not.toContain("Edith Miller");
  expect(html).not.toContain("Alice Miller");
  expect(JSON.stringify(state)).toBe(before);

  state.ecs.relationships[player].known[parent] = { ring: "public", goodwill: 0 };
  (state.knowledge[player] ||= { people: {}, feelings: {}, events: [] }).people[sibling] = {};
  html = panel();
  expect(html).toContain("Made by Edith Miller. First owned by Edith Miller.");
  expect(html).toContain("Edith Miller (made) → Alice Miller (gift) → Agnes Miller (inheritance)");
  expect(state.ecs.relationships[person].known[player]).toBeUndefined();
});

it("keeps an owned unique gift's identity and history without revealing unknown previous owners", () => {
  const { state, player, person, parent, sibling } = peopleWorld();
  state.ecs.relationships[player].known[person] = { ring: "public", goodwill: 0 };
  const item = createPossession(state, parent, "Ashdown keepsake");
  transferPossession(state, item, sibling, "gift");
  transferPossession(state, item, player, "inheritance");
  const before = JSON.stringify(state);
  const chooser = jest.spyOn(React, "useState").mockImplementation(initial => [initial === null ? "gift" : initial, jest.fn()]);
  try {
    const panel = () => render(state, <PersonPanel entityId={person}/>);
    let html = panel();
    expect(html).toContain("Choose a gift");
    expect(html).toContain("Ashdown keepsake · value 12");
    expect(html).toContain("Personal possession · an unknown person → an unknown person → Will Ashdown");
    expect(html).toContain("1 available");
    expect(html).not.toContain("Edith Miller");
    expect(html).not.toContain("Alice Miller");
    expect(JSON.stringify(state)).toBe(before);

    state.ecs.relationships[player].known[parent] = { ring: "public", goodwill: 0 };
    (state.knowledge[player] ||= { people: {}, feelings: {}, events: [] }).people[sibling] = {};
    html = panel();
    expect(html).toContain("Personal possession · Edith Miller → Alice Miller → Will Ashdown");
    expect(state.ecs.possession[item].ownerId).toBe(player);
    expect(state.ecs.possession[item].owners.map(o => o.personId)).toEqual([parent, sibling, player]);
  } finally { chooser.mockRestore(); }
});

it("shows only an impression and learned traits at Public, and the true ring at Social", () => {
  const { state, player, person, parent } = peopleWorld();
  const panel = () => render(state, <PersonPanel entityId={person}/>);
  let html = panel();
  for (const text of ["an unknown person", "Identity and household not yet known", "Traits you know", "You have not spoken together yet", "People seen with", "Open family tree", "Chat", "Ask about someone", "Give a gift"]) expect(html).toContain(text);
  expect(html).not.toContain("Generous");
  expect(html).not.toContain("Edith Miller");
  completeConversation(state, player, person);
  html = panel();
  for (const text of ["Agnes Miller", "30 years · Withyford", "Miller cottage", "seems polite", "Acquaintance", "An impression from your conversation", "Goodwill with Agnes", "0 / 10", "10 more towards familiar acquaintance"]) expect(html).toContain(text);
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  html = panel();
  for (const text of ["considers you a familiar acquaintance", "Familiar acquaintance", "family tree and gossip", "Generous", "Proud", "closest people", "Edith Miller", "16 / 30"]) expect(html).toContain(text);
  expect(html).not.toContain("An impression from your conversation");
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
  const { state, player, person, parent, tiles } = peopleWorld();
  state.ecs.relationships[player].known[person] = { ring: "public", goodwill: 0 };
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

it("distinguishes a sibling's spouse from an unrelated known companion", () => {
  const { state, player, person, parent, sibling } = peopleWorld();
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  state.ecs.relationships[player].known[sibling] = { ring: "public", goodwill: 0 };
  state.ecs.kinship[parent].children = [person];
  state.ecs.kinship[sibling].parents = [];
  let html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toMatch(/Alice Miller<\/button><span class="kin">Known to you/);
  state.ecs.kinship[parent].children = [person, player];
  state.ecs.kinship[player].parents = [parent];
  state.ecs.kinship[player].spouse = sibling;
  state.ecs.kinship[sibling].spouse = player;
  html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toMatch(/Alice Miller<\/button><span class="kin">Sister-in-law/);
});

it("marks the known householder as in the family-tree mock-up", () => {
  const { state, player, person } = peopleWorld();
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  const html = render(state, <FamilyTree entityId={person}/>);
  expect(html).toMatch(/aria-label="Select Edith Miller[^\"]*Householder/);
});


it("keeps a smith's trade visible through current work, meals, walking and rest", () => {
  const { state, person, tiles } = peopleWorld();
  state.ecs.profession = { [person]: { trade: "smith", workplaceId: tiles[2] } };
  state.ecs.meetingPlace = { [tiles[4]]: { kind: "green" } };
  const planner = state.ecs.planner[person];
  planner.world.places.meet = { id: tiles[4], x: 0, y: 0 };
  // Deliberately stale: never present a planned forge label as current eating/walking.
  planner.world.label = "at_forge";
  for (const [task, activity] of [
    [["trade_work", tiles[2]], "At the forge"], [["eat", "grain"], "Eating"],
    [["walk_to", "meet"], "Walking to the village green"], [["sleep"], "Sleeping"],
    [["wait_for", 1], null], [null, null]
  ]) {
    planner.task = task;
    const html = render(state, <PersonPanel entityId={person}/>);
    expect(html).toContain(activity ? "Smith · " + activity : "Smith");
    if (!activity) expect(html).not.toContain("Idle");
    if (activity != "At the forge") expect(html).not.toContain("At the forge");
  }
});

it("shows household farming, childhood and death without inventing a profession or live activity", () => {
  const { state, person, tiles } = peopleWorld();
  state.ecs.household[tiles[3]] = { farming: true };
  state.ecs.planner[person].task = ["sleep"];
  let html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("Farming household · Sleeping");
  expect(html).not.toContain("Farmer");
  state.ecs.personable[person].age = 10;
  html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("Child · Sleeping");
  expect(html).not.toContain("Farming household");
  state.ecs.personable[person].age = 30;
  state.ecs.profession = { [person]: { trade: "smith" } };
  state.ecs.personable[person].dead = true;
  html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("Smith · Dead");
  expect(html).not.toContain("Sleeping");
  expect(html).not.toContain("Give a gift");
});

it("states the learned speaker-to-subject direction using full names and leaves all bonds untouched", () => {
  const { state, player, person, sibling } = peopleWorld();
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16, base: 16 };
  state.ecs.relationships[person].known[sibling] = { ring: "personal", goodwill: 36, base: 36 };
  state.ecs.relationships[sibling].known[person] = { ring: "intimate", goodwill: 65, base: 65 };
  state.ecs.relationships[sibling].known[player] = { ring: "public", goodwill: 0, base: 0 };
  state.ecs.relationships[player].known[sibling] = { ring: "social", goodwill: 16, base: 16 };
  expect(askAbout(state, player, person, sibling).ok).toBe(true);
  // A learned report also stays distinct from a later live change in the speaker's bond.
  state.ecs.relationships[person].known[sibling].ring = "social";
  const before = JSON.stringify({ relationships: state.ecs.relationships, knowledge: state.knowledge, talking: state.talking });
  const html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("Agnes Miller considers Alice Miller a friend.");
  expect(html).not.toContain("Alice Miller considers Agnes Miller");
  expect(JSON.stringify({ relationships: state.ecs.relationships, knowledge: state.knowledge, talking: state.talking })).toBe(before);
});

it("marks the spouse as household heir before the eldest child, matching real inheritance", () => {
  const { state, player, person, parent, tiles } = peopleWorld();
  const spouse = "dora";
  state.ecs.nameable[spouse] = { nickname: "Dora Taylor" };
  state.ecs.personable[spouse] = { age: 55 };
  state.ecs.kinship[spouse] = { parents: [], children: [], spouse: parent };
  state.ecs.kinship[parent].spouse = spouse;
  state.ecs.household[spouse] = { houseId: tiles[3] };
  state.ecs.relationships[spouse] = { known: {} };
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  const html = render(state, <FamilyTree entityId={person}/>);
  expect(html).toContain("Select Dora Taylor, 55 · Living, ◇ Heir");
});

it("does not reveal an unknown social partner in a selected person's activity", () => {
  const { state, player, person, sibling } = peopleWorld();
  state.personName = id => state.ecs.nameable[id].nickname;
  state.ecs.planner[person].world.social = { partnerId: sibling, courting: true };
  state.ecs.planner[person].task = ["socialise", sibling];
  let html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("Courting an unknown person"); expect(html).not.toContain("Alice Miller");
  state.ecs.relationships[player].known[sibling] = { ring: "public", goodwill: 0 };
  html = render(state, <PersonPanel entityId={person}/>);
  expect(html).toContain("Courting Alice Miller");
});

it("keeps unintroduced inspection anonymous and pure across the sheet, tree and actor switches", () => {
  const { state, player, person, sibling } = peopleWorld();
  state.ui.show = { selected_person: person };
  state.ecs.planner[person].task = ["chop_tree"];
  const before = JSON.stringify(state);
  const panel = () => render(state, <PersonPanel entityId={person}/>);
  let html = panel();
  for (const text of ["Agnes", "Miller", "Withyford"]) expect(html).not.toContain(text);
  for (const text of ["an unknown person", "Felling trees", ">Chat</button>", "Give a gift", "Offer help"]) expect(html).toContain(text);
  expect(render(state, <FamilyTree entityId={person}/>)).not.toContain("Agnes Miller");
  expect(JSON.stringify(state)).toBe(before);
  state.ecs.relationships[player].known[person] = { ring: "public", goodwill: 0 };
  html = panel();
  expect(html).toContain("Agnes Miller"); expect(html).toContain("Withyford");
  expect(html).toContain("You have not spoken together yet");
  state.ui.playerId = sibling;
  expect(panel()).not.toContain("Agnes Miller");
  state.ui.playerId = person;
  expect(panel()).toContain("Agnes Miller");
  state.ui.playerId = player;
  delete state.ecs.relationships[player].known[person];
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  // Genuine speech earns the existing family disclosure, including identities.
  completeConversation(state, player, person);
  expect(panel()).toContain("Agnes Miller");
  expect(render(state, <FamilyTree entityId={person}/>)).toContain("Edith Miller");
});
