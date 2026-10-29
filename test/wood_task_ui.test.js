import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { TaskPanel } from "../src/components/task_panel";
import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { enqueueTask } from "game/manager";
import { createSimulation } from "game/simulation";
import { placeShelter } from "game/construction";

jest.mock("game/name", () => ({ name: n => n.nickname }));
jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });

const render = state => renderToStaticMarkup(<GameState.Provider value={state}><TaskPanel/></GameState.Provider>);
function arrival() {
  const { state, villager: player, tiles } = rowOfTiles(9);
  Object.assign(state.ui, { playerId: player, actions: {} });
  state.game_speed = "fast";
  Object.assign(state.ecs, {
    personable: { [player]: { hunger: 0, tiredness: 0 } }, nameable: { [player]: { nickname: "Will" } },
    planner: { [player]: { id: player, world: { places: {}, no_place_for: {}, feeling: {}, holding: {}, days: state.days, ordered: true } } },
    manager: { [player]: { id: player, ordered: true, jobs: [] } }, building: {}, container: {}, interior: {}
  });
  const [camp, tree, bush] = newEntities(state, [
    { spatial: { ...state.ecs.spatial[tiles[0]], immovable: true }, camp: {}, controllable: { controllerId: player }, sleepable: { capacity: 1, occupiers: [] } },
    { spatial: { ...state.ecs.spatial[tiles[8]], immovable: true }, good: { type: "wood", amount: 2 } },
    { spatial: { ...state.ecs.spatial[tiles[1]], immovable: true }, forageable: { kind: "roots", biome: "grassland", amount: 1, growth: 0 } }
  ]);
  const sim = createSimulation(state);
  const until = condition => {
    for (let n = 0; n < 5000; n++) {
      sim.step(1);
      if (condition()) return;
    }
    throw new Error("Planner did not reach expected phase: " + JSON.stringify(state.ecs.planner[player]));
  };
  return { state, player, camp, tree, bush, tiles, until, planner: state.ecs.planner[player] };
}

it("renders the actual chop, collection, return journeys and delivered counts until the completed order disappears", () => {
  const { state, player, tree, until, planner } = arrival();
  const job = enqueueTask(state, { key: "cut_tree_down" }, tree);
  until(() => planner.task?.[0] == "chop_tree" && job.progress > 0.1);
  expect(render(state)).toContain("Chopping");
  expect(render(state)).toContain("chopping left");
  expect(render(state)).toContain("delivery follows");
  // The first pickup is immediate at the felled tree; collection is visible
  // on the return trip for the second log.
  until(() => job.gatheredDone && !!state.ecs.holder[player].held.length);
  const carrying = render(state);
  expect(carrying).toContain("Carrying wood home");
  expect(carrying).toContain("0 of 2 logs delivered");
  expect(carrying).not.toContain("0 of 1 logs");
  expect(carrying).not.toContain("100%");
  const minutes = +carrying.match(/~(\d+)m to home/)[1];
  expect(minutes).toBeGreaterThan(15);
  expect(carrying).toContain("more wood to collect");
  // Route estimates use the same hunger, terrain and load costs as walking.
  state.ecs.personable[player].hunger = 1;
  expect(+render(state).match(/~(\d+)m to home/)[1]).toBeGreaterThan(minutes);
  state.ecs.personable[player].hunger = 0;
  for (const tile of Object.values(state.ecs.walkable)) tile.speed = 0.5;
  expect(+render(state).match(/~(\d+)m to home/)[1]).toBeGreaterThan(minutes * 1.8);
  for (const tile of Object.values(state.ecs.walkable)) tile.speed = 1;
  until(() => job.gathered.length == 1 && !state.ecs.holder[player].held.length);
  expect(render(state)).toContain("Collecting wood");
  expect(render(state)).toContain("1 of 2 logs delivered");
  expect(render(state)).toContain('aria-valuenow="50"');
  until(() => !state.ecs.manager[player].jobs.length);
  expect(render(state)).not.toContain("Chop wood");
  expect(render(state)).toContain("0 IN QUEUE");
  expect(Object.values(state.ecs.haulable).filter(h => !h.heldBy)).toHaveLength(2);
});

it("labels an interrupted delivery honestly and resumes it after an automatic meal", () => {
  const { state, player, tree, until, planner } = arrival();
  const job = enqueueTask(state, { key: "cut_tree_down" }, tree);
  until(() => job.gatheredDone && !state.ecs.holder[player].held.length);
  state.ecs.personable[player].hunger = 1;
  until(() => !job.assignedId && ["forage", "eat"].includes(planner.task?.[0]));
  const paused = render(state);
  expect(paused).toContain("Wood delivery paused");
  expect(paused).not.toMatch(/~1m/);
  expect(paused).not.toContain('class="task current"');
  until(() => job.assignedId == player && !!state.ecs.holder[player].held.length);
  expect(state.ecs.personable[player].hunger).toBeLessThan(0.9);
  expect(render(state)).toContain("Carrying wood home");
  until(() => !state.ecs.manager[player].jobs.length);
});

it("keeps waiting construction distinct from active wood delivery and actual building progress", () => {
  const { state, player, tree, tiles, until } = arrival();
  const site = placeShelter(state, tiles[1]);
  enqueueTask(state, { key: "build_shelter" }, site);
  const job = enqueueTask(state, { key: "cut_tree_down" }, tree);
  until(() => job.gatheredDone && !!state.ecs.holder[player].held.length);
  const html = render(state);
  expect(html).toMatch(/class="task waiting"[^]*?Waiting for logs · 0 of 4/);
  expect(html).toMatch(/class="task current"[^]*?Carrying wood home/);
  // A separate construction diagnostic starts with enough delivered logs.
  state.ecs.construction[site].delivered = 4;
  until(() => state.ecs.construction[site]?.work > 0);
  expect(render(state)).toContain("Building");
  expect(render(state)).toMatch(/% · ~\d+m left/);
});

it("uses an honest delivery label when an older order lacks the harvest count or a route is unavailable", () => {
  const { state, player, tree, until } = arrival();
  const job = enqueueTask(state, { key: "cut_tree_down" }, tree);
  until(() => job.gatheredDone && !!state.ecs.holder[player].held.length);
  delete job.gatheredTotal;
  state.ecs.planner[player].world.route = null;
  state.space = {};
  const html = render(state);
  expect(html).toContain("Carrying wood home");
  expect(html).toContain("2 logs still to deliver");
  expect(html).not.toContain("~1m");
  expect(html).not.toContain("progressbar");
});
