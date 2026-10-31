import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { enqueueTask, reorderTask } from "game/manager";
import { createSimulation } from "game/simulation";
import { canPlaceField, fieldAtTile, reserveRoad, reserveFieldLane } from "game/land_use";
import { Hex } from "game/hex";

// A single two-log tree on eligible, unclaimed ground, reached through actual
// walking tiles. Only initial resources/needs are fixtures; all work is queued.
function clearing(siteIndex = 4) {
  const { state: s, villager: player, tiles } = rowOfTiles(5);
  s.ui.playerId = player;
  s.game_speed = "fast";
  Object.assign(s.ecs, {
    personable: { [player]: { age: 24, hunger: 0, tiredness: 0 } },
    planner: { [player]: { id: player, world: { places: {}, no_place_for: {}, feeling: {}, holding: {}, days: s.days, ordered: true } } },
    manager: { [player]: { ordered: true, jobs: [] } }, building: {}, interior: {}
  });
  const site = tiles[siteIndex];
  const [camp, tree, plant] = newEntities(s, [
    { spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, camp: {}, controllable: { controllerId: player },
      container: { capacity: 20, amounts: { grain: 4 } }, sleepable: { capacity: 1, occupiers: [] } },
    { spatial: { ...s.ecs.spatial[site], immovable: true }, good: { type: "wood", amount: 2 } },
    { spatial: { ...s.ecs.spatial[site], immovable: true }, forageable: { kind: "roots", biome: "grassland", amount: 2, growth: 0 } }
  ]);
  const sim = createSimulation(s), planner = s.ecs.planner[player];
  const until = condition => {
    for (let n = 0; n < 1200; n++) {
      sim.step(1);
      if (condition()) return;
    }
    throw new Error("Work visit did not reach its expected phase: " + JSON.stringify(planner));
  };
  const step = minutes => { for (let n = 0; n < minutes; n++) sim.step(1); };
  const cleanSite = () => {
    expect(s.ecs.walkable[site].worn).toEqual({});
    expect(s.ecs.walkable[site].trackReserved).toBeFalsy();
    expect(canPlaceField(s, site)).toBe(true);
  };
  return { s, player, tiles, site, camp, tree, plant, planner, until, step, cleanSite };
}

it("queues the first chop, hauls both logs, then completes a real twenty-minute field designation without editing wear", () => {
  const { s, player, tiles, site, camp, tree, plant, until, step, cleanSite } = clearing();
  cleanSite();
  const chop = enqueueTask(s, { key: "cut_tree_down" }, tree);
  until(() => chop.progress > 0 && chop.progress < 1);
  expect(Hex().fromPoint(s.ecs.spatial[player]).equals(Hex().fromPoint(s.ecs.spatial[tree]))).toBe(true);
  expect(s.ecs.good[tree].amount).toBe(2);
  cleanSite();
  const chopStarted = s.days;
  step(28);
  expect(s.ecs.good[tree].amount).toBe(2);
  expect(chop.gatheredDone).toBeFalsy();
  until(() => chop.gatheredDone);
  // The first observed work tick already consumed one of the thirty minutes.
  expect((s.days - chopStarted) * 24 * 60).toBeCloseTo(29, 8);
  cleanSite();
  until(() => !s.ecs.manager[player].jobs.length);
  expect(chop.progress).toBe(1);
  expect(s.ecs.spatial[tree]).toBeUndefined();
  expect(s.ecs.container[camp].amounts.wood).toBe(2);
  expect(Object.values(s.ecs.good).filter(g => g.type == "wood")).toEqual([]);
  expect(s.ecs.holder[player].held).toEqual([]);
  expect(s.ecs.forageable[plant]).toBeDefined();
  cleanSite();
  for (const id of tiles.slice(1, -1)) {
    expect(s.ecs.walkable[id].trackReserved).toBe(true);
    expect(Object.values(s.ecs.walkable[id].worn).some(n => n > 0)).toBe(true);
  }
  const field = enqueueTask(s, { key: "create_field" }, site);
  until(() => field.progress > 0);
  const started = s.days;
  step(18);
  expect(fieldAtTile(s, site)).toBe(false);
  expect(s.ecs.forageable[plant]).toBeDefined();
  until(() => !s.ecs.manager[player].jobs.length);
  // One minute of work elapsed before the first positive-progress observation.
  expect((s.days - started) * 24 * 60).toBeCloseTo(19, 8);
  expect(field.progress).toBe(1);
  expect(fieldAtTile(s, site)).toBe(true);
  const [id] = Object.keys(s.ecs.farmable);
  expect(s.ecs.controllable[id].controllerId).toBe(player);
  expect(s.ecs.farmable[id].slots.every(slot => slot.state == "empty")).toBe(true);
  expect(s.ecs.forageable[plant]).toBeUndefined();
  expect(s.ecs.container[camp].amounts.wood).toBe(2);
  expect(s.ecs.walkable[site].worn).toEqual({});
  expect(s.ecs.walkable[site].trackReserved).toBeFalsy();
});

it.each(["cut_tree_down", "forage"])("%s approaches, leaves for a native meal, resumes and delivers without reserving its work tile", key => {
  const { s, player, site, camp, tree, plant, planner, until, cleanSite } = clearing();
  const job = enqueueTask(s, { key }, key == "forage" ? plant : tree);
  until(() => job.progress > 0.1 && job.progress < 1);
  const progress = job.progress;
  s.ecs.personable[player].hunger = 1.2;
  until(() => !job.assignedId && planner.task?.[0] == "eat");
  expect(job.progress).toBe(progress);
  expect(Hex().fromPoint(s.ecs.spatial[player]).equals(Hex().fromPoint(s.ecs.spatial[site]))).toBe(false);
  cleanSite();
  until(() => job.assignedId == player && job.progress > progress);
  expect(s.ecs.personable[player].hunger).toBeLessThan(0.9);
  until(() => !s.ecs.manager[player].jobs.length);
  expect(s.ecs.container[camp].amounts.grain).toBe(3);
  expect(s.ecs.container[camp].amounts[key == "forage" ? "forage" : "wood"]).toBe(key == "forage" ? 1 : 2);
  expect(job.progress).toBe(1);
  cleanSite();
});

it("keeps the deleted tree's work endpoint free during a native meal interruption of hauling", () => {
  const { s, player, tree, camp, planner, until, cleanSite } = clearing();
  const job = enqueueTask(s, { key: "cut_tree_down" }, tree);
  until(() => job.gatheredDone && !s.ecs.holder[player].held.length);
  expect(s.ecs.spatial[tree]).toBeUndefined();
  s.ecs.personable[player].hunger = 1.2;
  until(() => !job.assignedId && planner.task?.[0] == "eat");
  cleanSite();
  until(() => !s.ecs.manager[player].jobs.length);
  expect(s.ecs.container[camp].amounts.wood).toBe(2);
  expect(s.ecs.container[camp].amounts.grain).toBe(3);
  cleanSite();
});

it("records a Move here departure even with an unfinished resource job on that tile", () => {
  const { s, tiles, site, tree, until } = clearing();
  const chop = enqueueTask(s, { key: "cut_tree_down" }, tree);
  until(() => chop.progress > 0.1);
  const move = enqueueTask(s, { key: "move_to_here" }, tiles[0]);
  reorderTask(s, move.id, 0);
  until(() => move.progress == 1);
  expect(chop.progress).toBeLessThan(1);
  expect(s.ecs.walkable[site].trackReserved).toBe(true);
  expect(Object.values(s.ecs.walkable[site].worn).some(n => n > 0)).toBe(true);
  expect(canPlaceField(s, site)).toBe(false);
});

it("records actual through traffic on a resource job's tile while care interrupts the approach", () => {
  const { s, player, tiles, site, tree, camp, until } = clearing(2);
  // The actual food store is beyond the worksite, making that site an
  // intermediate step of the care journey rather than its endpoint.
  Object.assign(s.ecs.spatial[camp], s.ecs.spatial[tiles[4]]);
  enqueueTask(s, { key: "cut_tree_down" }, tree);
  until(() => Hex().fromPoint(s.ecs.spatial[player]).equals(Hex().fromPoint(s.ecs.spatial[tiles[1]])));
  s.ecs.personable[player].hunger = 1.2;
  until(() => s.ecs.container[camp].amounts.grain == 3);
  expect(s.ecs.good[tree].amount).toBe(2);
  expect(s.ecs.walkable[site].trackReserved).toBe(true);
  expect(Object.entries(s.ecs.walkable[site].worn).some(([track, wear]) => !track.includes("C") && wear > 0)).toBe(true);
});

it.each(["road", "lane", "track"])("work visits preserve an existing public %s reservation and cannot turn it into a field", kind => {
  const { s, player, tiles, site, tree, until, step } = clearing();
  if (kind == "road") expect(reserveRoad(s, [tiles[3], site])).toBe(true);
  if (kind == "lane") expect(reserveFieldLane(s, [tiles[3], site])).toBe(true);
  if (kind == "track") {
    const move = enqueueTask(s, { key: "move_to_here" }, site);
    until(() => move.progress == 1);
  }
  const route = [...(s.ecs.mappable[site].route || [])];
  const worn = Object.keys(s.ecs.walkable[site].worn);
  const chop = enqueueTask(s, { key: "cut_tree_down" }, tree);
  until(() => !s.ecs.manager[player].jobs.length);
  expect(chop.progress).toBe(1);
  expect(s.ecs.mappable[site].route || []).toEqual(route);
  for (const track of worn) expect(s.ecs.walkable[site].worn[track]).toBeGreaterThan(0);
  if (kind == "road") expect(s.ecs.walkable[site].routeWear).toBeGreaterThan(0);
  if (kind == "lane") expect(s.ecs.mappable[site].fieldLane).toBe(true);
  if (kind == "track") expect(s.ecs.walkable[site].trackReserved).toBe(true);
  expect(canPlaceField(s, site)).toBe(false);
  enqueueTask(s, { key: "create_field" }, site);
  step(30);
  expect(fieldAtTile(s, site)).toBe(false);
});
