import { gardenHelp, withGardenHelpIndex, refreshGardenHelpIndex } from "game/household_routines";
import { fenceFootprints, fenceRevision, withFenceCache } from "game/fences";

it("tracks garden claims and releases within the same planner frame", () => {
  const ecs = {personable: {}, planner: {}, household: {}, backyard: {}, farmable: {}};
  const s = {ecs, days: 10/24};
  for (let n = 0; n < 2; n++) {
    const id = "p" + n, home = "h" + n, garden = "g" + n;
    ecs.personable[id] = {age: 20}; ecs.household[id] = {houseId: home};
    ecs.household[home] = {backyards: [garden]}; ecs.backyard[garden] = {kind: "vegetable"};
    ecs.farmable[garden] = {slots: [{state: "sown"}]};
    ecs.planner[id] = {id, world: {}};
  }
  withGardenHelpIndex(s, () => {
    expect(gardenHelp(s, "p0")).toBe("g0");
    expect(gardenHelp(s, "p1")).toBe("g1");
    ecs.planner.p1.world.gardenHelp = "g0"; refreshGardenHelpIndex(s, "p1");
    expect(gardenHelp(s, "p0")).toBeNull();
    delete ecs.planner.p1.world.gardenHelp; refreshGardenHelpIndex(s, "p1");
    expect(gardenHelp(s, "p0")).toBe("g0");
  });
});

it("refreshes fence geometry after edits, removal and replacement between frames", () => {
  const shape = {halfWidth: 20, halfDepth: 15};
  const s = {ecs: {spatial: {pen: {x: 10, y: 20}}, pasture: {pen: shape}}};
  let old;
  withFenceCache(s, () => { old = fenceFootprints(s); });
  shape.halfWidth = 40; s.ecs.spatial.pen.x = 25;
  withFenceCache(s, () => {
    const next = fenceFootprints(s);
    expect(next[0]).toMatchObject({x: 25, halfWidth: 40});
    expect(fenceRevision(next)).not.toBe(fenceRevision(old));
  });
  delete s.ecs.pasture.pen;
  withFenceCache(s, () => expect(fenceFootprints(s)).toEqual([]));
  s.ecs = {spatial: {newPen: {x: 0, y: 0}}, fence: {newPen: {halfWidth: 10, halfDepth: 10}}};
  withFenceCache(s, () => expect(fenceFootprints(s).map(f => f.id)).toEqual(["newPen"]));
});
