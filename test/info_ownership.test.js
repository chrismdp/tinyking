import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { Info } from "../src/components/info";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("react-polyglot", () => ({ useTranslate: () => key => key }));
jest.mock("components/name", () => ({ Name: ({ nameable }) => nameable?.nickname }), { virtual: true });
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
    nameable: { sheep: { nickname: "Sheep" }, head: { nickname: "Agnes Miller" }, lord: { nickname: "Lord Ash" }, heir: { nickname: "Will Miller" } },
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
