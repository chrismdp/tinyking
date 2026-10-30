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
  s.events = []; const event = recordEvent(s, "marriage", [person, sibling]); learnEvent(s, player, event);
  const html = renderToStaticMarkup(<GameState.Provider value={s}><EventFeed/></GameState.Provider>);
  expect(html).toContain("Village news"); expect(html).toContain("<details");
  expect(html).toContain("Agnes Miller and Alice Miller married in Withyford");
  expect(html).toContain("Select Agnes Miller");
});
