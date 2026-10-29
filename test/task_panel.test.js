import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { TaskPanel } from "../src/components/task_panel";
import { SelectedPerson } from "../src/components/selected_person";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));
jest.mock("components/name", () => ({ Name: ({ nameable }) => nameable.nickname }), { virtual: true });
jest.mock("components/trait_list", () => ({ TraitList: () => null }), { virtual: true });

it("shows the approved task layout, amount, hunger warning, favour metadata and player status", () => {
  const state = { ui: { playerId: "p", actions: {} }, ecs: {
    manager: { p: { jobs: [{ id: "t1", job: { key: "cut_tree_down" }, targetId: "tree", assignedId: "p", progress: 0.6, detail: "3 of 5 logs" },
      { id: "t2", job: { key: "forage" }, targetId: "bush", forId: "a", expectedGoodwill: "about +9 goodwill" }] } },
    personable: { p: { hunger: 1.2 } }, nameable: { p: { nickname: "Will Ashdown" }, a: { nickname: "Agnes Miller" } },
    spatial: { tree: { x: 0, y: 0 }, bush: { x: 100, y: 100 } }, planner: { p: { world: {}, task: ["chop_tree", "tree"] } },
    shelter: {}
  } };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><TaskPanel/><SelectedPerson entityId="p"/></GameState.Provider>);
  expect(html.match(/Will Ashdown/g)).toHaveLength(1);
  for (const text of ["Your tasks", "2 IN QUEUE", "Hungry", "Working more slowly", "Chop wood", "3 of 5 logs", "60%",
    "Forage &amp; eat", "For Agnes Miller", "Favour · about +9 goodwill", "Drag ⠿ to reorder · × to cancel · You do each job.",
    "Will Ashdown", "You · Stranger · Camp at the edge", "Cancel Chop wood", "Move earlier", "Move later"]) expect(html).toContain(text);
});

it("includes walking and work estimates alongside queued tasks", () => {
  const state = { ui: { playerId: "p", actions: {} }, ecs: {
    manager: { p: { jobs: [{ id: "t1", job: { key: "cut_tree_down" }, targetId: "tree", assignedId: "p", progress: 0.5, workRemaining: 1 / 96 },
      { id: "t2", job: { key: "forage" }, targetId: "bush" }] } },
    personable: { p: { hunger: 0 } }, nameable: { p: { nickname: "Will" } },
    spatial: { p: { x: 0, y: 0 }, tree: { x: 120, y: 0 }, bush: { x: 240, y: 0 } },
    planner: { p: { world: {} } }, shelter: {}
  } };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><TaskPanel/></GameState.Provider>);
  expect(html).toMatch(/50% · ~\d+m left/);
  expect(html).toMatch(/Your work · land · ~\d+m/);
});

it("dims waiting work and highlights the assigned chop task instead of the first row", () => {
  const state = { ui: { playerId: "p", actions: {} }, ecs: {
    manager: { p: { jobs: [{ id: "build", job: { key: "build_shelter" }, targetId: "site", waiting: "Waiting for logs", detail: "Waiting for logs · 1 of 4" },
      { id: "chop", job: { key: "cut_tree_down" }, targetId: "tree", assignedId: "p", progress: 0.5 }] } },
    personable: { p: { hunger: 0 } }, nameable: { p: { nickname: "Will" } },
    spatial: { p: { x: 0, y: 0 }, site: { x: 0, y: 0 }, tree: { x: 240, y: 0 } },
    planner: { p: { world: {}, task: ["chop_tree", "tree"] } }, shelter: {},
    construction: { site: { stage: "lean-to", delivered: 1, work: 0 } }
  } };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><TaskPanel/></GameState.Provider>);
  expect(html).toMatch(/class="task waiting"[^]*?Waiting for logs · 1 of 4/);
  expect(html).toMatch(/class="task current"[^]*?Chop wood/);
  expect(html).toContain("⌛");
  expect(html).toContain("Cancel Build the lean-to");
});
