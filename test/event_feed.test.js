import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventFeed } from "../src/components/event_feed";
import { GameState } from "../src/components/contexts";
import { peopleWorld } from "./support/people";
import { recordEvent, learnEvent } from "game/events";
jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));
it("renders dated live weddings in a collapsible feed with selectable people", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  s.ecs.relationships[player].known[person] = { ring: "public" }; s.ecs.relationships[player].known[sibling] = { ring: "public" };
  s.events = []; const event = recordEvent(s, "marriage", [person, sibling]); learnEvent(s, player, event);
  const html = renderToStaticMarkup(<GameState.Provider value={s}><EventFeed/></GameState.Provider>);
  expect(html).toContain("Village news"); expect(html).toContain("<details");
  expect(html).toContain("Agnes Miller and Alice Miller married in Withyford");
  expect(html).toContain("Select Agnes Miller");
});

it("hides distant unwitnessed live events and generated history even with raw personName installed", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  s.ecs.spatial[player].x -= 2000;
  s.personName = id => s.ecs.nameable[id]?.nickname;
  recordEvent(s, "marriage", [person, sibling]);
  s.generatingHistory = true; s.days = -3; recordEvent(s, "birth", [person, sibling]);
  const html = renderToStaticMarkup(<GameState.Provider value={s}><EventFeed/></GameState.Provider>);
  expect(html).not.toContain("married"); expect(html).not.toContain("was born");
  expect(html).not.toContain("Agnes Miller"); expect(html).not.toContain("Alice Miller");
});

it("shows legitimately learned news without naming its unknown participant", () => {
  const { state: s, player, person, sibling } = peopleWorld();
  s.ecs.spatial[player].x -= 2000;
  const event = recordEvent(s, "marriage", [person, sibling]);
  s.ecs.relationships[player].known[person] = { ring: "public", goodwill: 0 };
  learnEvent(s, player, event);
  s.personName = id => s.ecs.nameable[id]?.nickname;
  const html = renderToStaticMarkup(<GameState.Provider value={s}><EventFeed/></GameState.Provider>);
  expect(html).toContain("Select Agnes Miller"); expect(html).toContain("married");
  expect(html).toContain("an unknown person"); expect(html).not.toContain("Alice Miller");
});

it("keeps witnessed news selectable and Ask about can legitimately reveal a distant historical move", () => {
  const { beginInteraction, askAbout } = require("game/people");
  const { state: s, player, person, sibling } = peopleWorld();
  beginInteraction(s, player, person);
  s.events = []; recordEvent(s, "visit", [person, sibling], [], { toVillage: "village" });
  let html = renderToStaticMarkup(<GameState.Provider value={s}><EventFeed/></GameState.Provider>);
  expect(html).toContain("Select Agnes Miller"); expect(html).toContain("visited");
  s.ecs.spatial[player].x -= 2000; s.days = -3; s.generatingHistory = true;
  const event = recordEvent(s, "move", [sibling], [], { toHouse: s.ecs.household[sibling].houseId, toVillage: "village" });
  html = renderToStaticMarkup(<GameState.Provider value={s}><EventFeed/></GameState.Provider>);
  expect(html).not.toContain("moved");
  s.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16 };
  learnEvent(s, person, event); expect(askAbout(s, player, person, sibling).ok).toBe(true);
  html = renderToStaticMarkup(<GameState.Provider value={s}><EventFeed/></GameState.Provider>);
  expect(html).toContain("Alice Miller moved to Miller cottage in Withyford");
  // Exercise the real button handler without a DOM or browser-state injection.
  const select = jest.fn(); s.ui.actions = { select_entity: select };
  const context = jest.spyOn(React, "useContext").mockReturnValue(s);
  try {
    const tree = EventFeed(), button = tree.props.children[1].props.children[0];
    button.props.onClick(); expect(select).toHaveBeenCalledWith(sibling, false);
  } finally { context.mockRestore(); }
});
