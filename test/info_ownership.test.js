import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { Info } from "../src/components/info";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("react-polyglot", () => ({ useTranslate: () => key => key }));
jest.mock("components/name", () => require("../src/components/name"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));
jest.mock("components/name_list", () => require("../src/components/name_list"), { virtual: true });
jest.mock("components/job_list", () => ({ JobList: () => null }), { virtual: true });
jest.mock("components/trait_list", () => ({ TraitList: () => null }), { virtual: true });
jest.mock("components/farm_progress", () => ({ FarmProgress: () => null }), { virtual: true });
jest.mock("components/sleeping_quarters", () => ({ SleepingQuarters: () => null }), { virtual: true });
jest.mock("components/entity_container", () => ({ EntityContainer: () => null }), { virtual: true });

const render = (state, id) => renderToStaticMarkup(<GameState.Provider value={state}><Info entityId={id}/></GameState.Provider>);
function household() {
  return { ui: { playerId: "p", actions: {} }, villages: { v: { name: "Withyford" }, elsewhere: { name: "Wrong village" } }, ecs: {
    animal: { sheep: { houseId: "house", kind: "sheep" } },
    farmable: { field: { houseId: "house", slots: [] } }, workplace: { forge: { houseId: "house", trade: "smith" } },
    nameable: { sheep: { id: "sheep", nickname: "Sheep" }, head: { id: "head", nickname: "Agnes Miller" }, lord: { id: "lord", nickname: "Lord Ash" }, heir: { id: "heir", nickname: "Will Miller" } },
    personable: { head: {}, lord: {}, heir: {} },
    relationships: { p: { known: { head: { ring: "public" }, heir: { ring: "public" } } } },
    // Asset controllers are deliberately stale: the house owns the household.
    controllable: { house: { controllerId: "head" }, head: { controllerId: "lord" }, field: { controllerId: "lord" }, forge: { controllerId: "lord" } },
    village: { house: { villageId: "v" }, sheep: { villageId: "elsewhere" } }, manager: {}
  } };
}

it("identifies an animal's household and its house's village without an animal controller or the household's liege", () => {
  const state = household();
  const html = render(state, "sheep");
  for (const text of ["Sheep", "Household:", "Agnes Miller", "Village:", "Withyford"]) expect(html).toContain(text);
  expect(html).not.toContain("Lord Ash");
  expect(html).not.toContain("Wrong village");
  expect(state.ecs.controllable.sheep).toBeUndefined();
  state.ecs.controllable.house.controllerId = "heir";
  expect(render(state, "sheep")).toContain("Will Miller");
});

it("uses the same live household owner for fields and workshops", () => {
  const state = household();
  for (const id of ["field", "forge"]) {
    const html = render(state, id);
    for (const text of ["Household:", "Agnes Miller", "Village:", "Withyford"]) expect(html).toContain(text);
    expect(html).not.toContain("Lord Ash");
  }
});

it("handles an unknown household without inventing a person or a village", () => {
  const state = household();
  delete state.ecs.controllable.house;
  delete state.ecs.village.house;
  const html = render(state, "sheep");
  expect(html).toContain("Household:");
  expect(html).toContain("Unknown");
  expect(html).not.toContain("Agnes Miller");
  expect(html).not.toContain("Wrong village");
});

it("describes a fully expanded pub as complete",()=>{
  const s=household();
  s.ecs.meetingPlace={pub:{kind:"alehouse",houseId:"house"}};
  s.ecs.growth={pub:{builtDay:-12,stage:2,supportedSeasons:12,additions:[]}};
  const html=render(s,"pub");
  expect(html).toContain("Both additions are complete.");
  expect(html).not.toContain("towards the next addition");
});

it("keeps an unintroduced household owner and assigned worker anonymous without changing knowledge", () => {
  const state = household();
  delete state.ecs.relationships.p.known.head;
  state.ecs.manager.field = { jobs: [{ job: { key: "build_shelter" }, targetId: "field", assignedId: "head" }] };
  const before = JSON.stringify(state);
  const html = render(state, "field");
  expect(html).toContain("an unknown person");
  expect(html).not.toContain("Agnes Miller");
  expect(html).toContain("Withyford");
  expect(JSON.stringify(state)).toBe(before);
  state.knowledge = { p: { people: { head: {} } } };
  expect(render(state, "field")).toContain("Agnes Miller");
});

it("keeps an unknown controller anonymous while preserving observable asset names and current heirs", () => {
  const state = household();
  state.ecs.nameable.store = { id: "store", nickname: "Wood store" };
  state.ecs.controllable.store = { controllerId: "lord" };
  let html = render(state, "store");
  expect(html).toContain("Wood store"); expect(html).toContain("Controlled by:");
  expect(html).toContain("an unknown person"); expect(html).not.toContain("Lord Ash");
  state.ui.playerId = "lord";
  expect(render(state, "store")).toContain("Lord Ash");
  state.ui.playerId = "heir";
  state.ecs.controllable.store.controllerId = "heir";
  expect(render(state, "store")).toContain("Will Miller");
});
