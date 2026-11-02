import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { woodTask } from "game/wood_task";

function arrival() {
  const { state, villager: player, tiles } = rowOfTiles(9);
  Object.assign(state.ui, { playerId: player, actions: {} });
  state.game_speed = "normal";
  Object.assign(state.ecs, {
    personable: { [player]: { hunger: 0, tiredness: 0 } }, nameable: { [player]: { nickname: "Will" } },
    planner: { [player]: { id: player, world: { places: {}, no_place_for: {}, feeling: {}, holding: {}, days: state.days, ordered: true } } },
    manager: { [player]: { id: player, ordered: true, jobs: [] } }, building: {}, container: {}, interior: {}
  });
  const [camp] = newEntities(state, [
    { spatial: { ...state.ecs.spatial[tiles[0]], immovable: true }, camp: {}, controllable: { controllerId: player }, sleepable: { capacity: 1, occupiers: [] } }
  ]);
  return { state, player, camp, tiles, planner: state.ecs.planner[player] };
}

it("uses combined hunger and tiredness for chopping and loaded delivery estimates", () => {
  const { state, player, camp, tiles, planner } = arrival();
  planner.task = ["chop_tree"];
  const job = { job: { key: "cut_tree_down" }, workRemaining: 1 / 48 };
  expect(woodTask(state, job, true).time).toBe("~30m chopping left");
  Object.assign(state.ecs.personable[player], { hunger: 1, tiredness: 2 });
  expect(woodTask(state, job, true).time).toBe("~150m chopping left");
  const [log] = newEntities(state, [{ spatial: { ...state.ecs.spatial[tiles[8]] }, good: { type: "wood", amount: 1 }, haulable: { heldBy: player, speedModifier: .75 } }]);
  state.ecs.holder[player].held = [log];
  Object.assign(state.ecs.spatial[player], state.ecs.spatial[tiles[8]]);
  Object.assign(job, { gatheredDone: true, gathered: [log], gatheredTotal: 1 });
  planner.world.carryTarget = camp;
  const slow = +woodTask(state, job, true).time.match(/~(\d+)m/)[1];
  Object.assign(state.ecs.personable[player], { hunger: 0, tiredness: 0 });
  const normal = +woodTask(state, job, true).time.match(/~(\d+)m/)[1];
  expect(slow).toBeGreaterThan(normal * 2);
  expect(slow).toBeLessThanOrEqual(normal / .2 + 1);
});
