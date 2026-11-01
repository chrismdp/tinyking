import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { ActivityDetails, StatusStrip } from "../src/components/status_strip";
import { SelectedPerson } from "../src/components/selected_person";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));
jest.mock("components/name", () => ({ Name: ({ nameable }) => nameable.nickname }), { virtual: true });
jest.mock("components/trait_list", () => ({ TraitList: () => null }), { virtual: true });







it("does not claim a hungry player stopped to eat while they are sleeping", () => {
  const state = { ui: { playerId: "p", actions: {} }, ecs: {
    manager: { p: { jobs: [] } }, personable: { p: { energy: 12 } }, nameable: { p: { nickname: "Will" } },
    spatial: {}, planner: { p: { world: { feeling: { hungry: true }, label: "sleeping" }, task: ["sleep"], plan: [] } }
  } };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><ActivityDetails/></GameState.Provider>);
  expect(html).not.toContain("Stopped to eat");
});

it("keeps an unintroduced queued chat target anonymous until the NPC speaks", () => {
  const {state,player,person}=require("./support/people").peopleWorld();
  state.ui.actions={};state.villages={};
  require("game/manager").enqueueTask(state,{key:"chat"},person);
  const render=()=>renderToStaticMarkup(<GameState.Provider value={state}><ActivityDetails/></GameState.Provider>);
  expect(render()).toContain("an unknown person");
  expect(render()).not.toContain("Agnes Miller");
  Object.assign(state.ecs.spatial[player],state.ecs.spatial[person]);
  require("game/tasks").talk(state,player,state.ecs.planner[player].world,1/24,true,person,"chat");
  expect(render()).toContain("Agnes Miller");
});

it("shows death without work, food, rest or queue instructions even with stale planner activity", () => {
  const state = { ui: { playerId: "p", actions: {} }, ecs: {
    manager: { p: { jobs: [] } }, personable: { p: { dead: true, hunger: 6, tiredness: 2 } },
    nameable: { p: { nickname: "Will" } }, spatial: {},
    planner: { p: { world: { playerWorking: true, feeling: { hungry: true } }, task: ["eat"] } }
  } };
  const html = renderToStaticMarkup(<GameState.Provider value={state}><StatusStrip/></GameState.Provider>);
  expect(html).toContain("Dead");
  for (const instruction of ["Working more slowly", "Find food", "Rest", "Stopped to eat", "resume", "Needs food", "Needs rest", "Choose an action", "You do each job"]) expect(html).not.toContain(instruction);
});
