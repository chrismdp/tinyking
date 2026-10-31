import Engine from "json-rules-engine-simplified";
import rules from "../src/data/jobs.json";
import { peopleWorld } from "./support/people";
import { newEntities, fullEntity } from "game/entities";
import { enqueueTask, cancelTask } from "game/manager";
import { Hex } from "game/hex";
import { Task } from "game/htn";
import { HOUR } from "game/time";
import { create_field, create_stockpile, chop_tree } from "game/tasks";
import { designationPlants } from "game/designation";
import { canPlaceField, reserveRoad } from "game/land_use";
import { updateEcology } from "game/ecology";

const kinds = [["create_field", create_field, "farmable"], ["create_stockpile", create_stockpile, "stockpile"]];
function plot() {
  const w = peopleWorld(), { state: s, tiles } = w;
  const plants = newEntities(s, [0, 2].map(amount => ({
    spatial: { ...s.ecs.spatial[tiles[0]], immovable: true },
    nameable: { nickname: "Wild roots" }, forageable: { kind: "roots", biome: "grassland", amount, growth: 0 }
  })));
  return { ...w, plants, tile: tiles[0] };
}
async function offers(s, tile) {
  const result = await new Engine(rules).run({
    target: fullEntity(s.ecs, tile), actor: fullEntity(s.ecs, s.ui.playerId), job_targets: [],
    other: s.space[Hex().fromPoint(s.ecs.spatial[tile])].filter(id => id != tile),
    canDesignate: designationPlants(s, s.ui.playerId, tile) !== null
  });
  return result.flatMap(r => r.jobs).filter(j => j.key != "create_field" || canPlaceField(s, tile)).map(j => j.key);
}

it("offers both designations on legal natural forage, including exhausted plants", async () => {
  const { state: s, tile } = plot();
  expect(await offers(s, tile)).toEqual(expect.arrayContaining(["create_field", "create_stockpile"]));
});

it.each(kinds)("%s completes real queued work, clears only its plants and creates no goods", (key, run, component) => {
  const { state: s, player, tile, plants, step } = plot();
  const before = JSON.stringify({ goods: s.ecs.good, held: s.ecs.holder[player], rights: s.ecs.village });
  const job = enqueueTask(s, { key }, tile);
  step(0.05);
  expect(job.progress).toBeGreaterThan(0);
  expect(job.progress).toBeLessThan(1);
  expect(plants.every(id => s.ecs.forageable[id])).toBe(true);
  expect(Object.keys(s.ecs[component] || {})).toHaveLength(0);
  // At 19 elapsed minutes even a fully fed worker cannot have finished.
  step(16 / 60);
  expect(Object.keys(s.ecs[component] || {})).toHaveLength(0);
  step(3 / 60);
  expect(job.progress).toBe(1);
  expect(Object.keys(s.ecs[component])).toHaveLength(1);
  const id = Object.keys(s.ecs[component])[0];
  expect(s.ecs.controllable[id].controllerId).toBe(player);
  expect(s.space[Hex().fromPoint(s.ecs.spatial[tile])]).toContain(id);
  for (const plant of plants) {
    expect(Object.values(s.ecs).some(c => c?.[plant])).toBe(false);
    expect(Object.values(s.space).flat()).not.toContain(plant);
    expect(s.redraws).toContain(plant);
  }
  expect(JSON.stringify({ goods: s.ecs.good, held: s.ecs.holder[player], rights: s.ecs.village })).toBe(before);
  if (component == "stockpile") expect(s.ecs.holder[id]).toMatchObject({ capacity: 19, held: [] });
  else expect(s.ecs.farmable[id].slots.every(slot => slot.state == "empty")).toBe(true);
  expect(run(s, player, { places: {} }, HOUR, true, tile)).toBe(Task.ABORT);
  expect(Object.keys(s.ecs[component])).toHaveLength(1);
  updateEcology(s);
  expect(plants.every(plant => !s.ecs.forageable[plant])).toBe(true);
});

const obstacles = [
  { good: { type: "wood", amount: 4 } }, { tree: { stage: "sapling" }, good: { type: "wood", amount: 0 } },
  { building: {} }, { camp: {} }, { farmable: { slots: [] } }, { stockpile: {} },
  { good: { type: "forage", amount: 1 }, haulable: {} }, { personable: { age: 30 } },
  { container: { amounts: {} } }, { meetingPlace: {} }
];
it.each(obstacles)("blocks real indexed obstacles %j in menus and completion without clearing", async obstacle => {
  const { state: s, player, tile, plants } = plot();
  const [id] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tile], immovable: true }, ...obstacle }]);
  expect(await offers(s, tile)).not.toEqual(expect.arrayContaining(["create_field"]));
  expect(await offers(s, tile)).not.toEqual(expect.arrayContaining(["create_stockpile"]));
  for (const [,run] of kinds) expect(run(s, player, { places: {} }, HOUR, true, tile)).toBe(Task.ABORT);
  expect(plants.every(plant => s.ecs.forageable[plant])).toBe(true);
  expect(s.ecs.spatial[id]).toBeDefined();
});

it.each(kinds)("%s rechecks every plant's current permission and content at completion", async (key, run, component) => {
  for (const change of ["owner", "commons", "object", "plantObject"]) {
    const { state: s, player, person, tile, plants, step } = plot();
    const job = enqueueTask(s, { key }, tile);
    step(.05);
    const progress = job.progress;
    if (change == "owner") s.ecs.controllable[plants[1]] = { controllerId: person };
    if (change == "commons") {
      s.villages.village = { id: "village", houses: [], sharedPlaces: [tile] };
      s.ecs.household[player] = { houseId: null };
    }
    if (change == "object") newEntities(s, [{ spatial: { ...s.ecs.spatial[tile], immovable: true }, camp: {} }]);
    if (change == "plantObject") s.ecs.good = { [plants[1]]: { type: "forage", amount: 1 } };
    expect(await offers(s, tile)).not.toContain(key);
    expect(run(s, player, s.ecs.planner[player].world, HOUR, false, tile)).toBe(Task.ABORT);
    step(.5);
    expect(job.progress).toBe(progress);
    expect(Object.keys(s.ecs[component] || {})).toHaveLength(0);
    expect(plants.every(id => s.ecs.forageable[id])).toBe(true);
  }
});

it.each(kinds)("%s cancellation or death leaves unfinished plants intact", (key, run, component) => {
  for (const death of [false, true]) {
    const { state: s, player, tile, plants, step } = plot();
    const job = enqueueTask(s, { key }, tile);
    step(.05);
    expect(job.progress).toBeGreaterThan(0);
    if (death) s.ecs.personable[player].dead = true;
    else cancelTask(s, job.id);
    step(.5);
    expect(plants.every(id => s.ecs.forageable[id])).toBe(true);
    expect(Object.keys(s.ecs[component] || {})).toHaveLength(0);
    if (death) expect(run(s, player, { places: {} }, HOUR, true, tile)).toBe(Task.ABORT);
  }
});

it("retains field access and reservation checks with forage present", async () => {
  const { state: s, player, tile, tiles, plants } = plot();
  // A middle tile in this row would sever the public route.
  const [bush] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[1]], immovable: true }, forageable: { kind: "roots", amount: 0 } }]);
  expect(await offers(s, tiles[1])).not.toContain("create_field");
  expect(create_field(s, player, { places: {} }, HOUR, true, tiles[1])).toBe(Task.ABORT);
  expect(s.ecs.forageable[bush]).toBeDefined();
  expect(reserveRoad(s, [tile, tiles[1]])).toBe(true);
  expect(await offers(s, tile)).not.toContain("create_field");
  expect(create_field(s, player, { places: {} }, HOUR, true, tile)).toBe(Task.ABORT);
  expect(plants.every(id => s.ecs.forageable[id])).toBe(true);
});


it("allows the indexed working actor on their own tile and never clears that person", async () => {
  const { state: s, player, tile } = plot();
  s.space[Hex().fromPoint(s.ecs.spatial[tile])].push(player);
  expect(await offers(s, tile)).toContain("create_field");
  expect(create_field(s, player, { places: {} }, HOUR / 3, true, tile)).toBe(Task.FINISH);
  expect(s.ecs.personable[player]).toBeDefined();
  expect(s.space[Hex().fromPoint(s.ecs.spatial[tile])]).toContain(player);
});


it("requires a separate real timed chop before forage can be cleared, and conserves its wood", async () => {
  const { state: s, player, tile, plants } = plot();
  const [tree] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tile], immovable: true }, good: { type: "wood", amount: 4 } }]);
  expect(await offers(s, tile)).not.toContain("create_field");
  const work = { places: {} };
  expect(chop_tree(s, player, work, HOUR / 4, true, tree)).toBe(Task.CONTINUE);
  expect(s.ecs.good[tree].amount).toBe(4);
  expect(chop_tree(s, player, work, HOUR / 4, false, tree)).toBe(Task.FINISH);
  expect(s.ecs.spatial[tree]).toBeUndefined();
  expect(plants.every(id => s.ecs.forageable[id])).toBe(true);
  expect(await offers(s, tile)).toContain("create_field");
  expect(create_field(s, player, { places: {} }, HOUR / 3, true, tile)).toBe(Task.FINISH);
  expect(Object.values(s.ecs.good).reduce((n, good) => n + good.amount, 0)).toBe(4);
  expect(Object.values(s.ecs.good).every(good => good.type == "wood")).toBe(true);
});
