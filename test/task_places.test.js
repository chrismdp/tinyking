import { taskPlace } from "game/task_places";
import { Hex } from "game/hex";

function world() {
  return { ui: { playerId: "p" }, villages: { v: { name: "Withyford", centre: { x: 6, y: 0 }, houses: ["house"] } },
    ecs: { spatial: { camp: Hex(0, 0).toPoint(), home: Hex(1, 0).toPoint(), house: Hex(6, 0).toPoint() },
      camp: { camp: {} }, shelter: {}, controllable: { home: { controllerId: "p" }, p: { controllerId: "p" } },
      mappable: {}, tree: {}, farmable: {} }, space: {} };
}

it("names camp and adjacent owned shelter stages", () => {
  const s = world();
  s.ecs.spatial.target = Hex(0, 1).toPoint();
  expect(taskPlace(s, "target")).toBe("at camp");
  for (const stage of ["lean-to", "hut", "house"]) {
    s.ecs.shelter.home = { stage };
    expect(taskPlace(s, "target")).toBe("by your " + stage);
  }
});

it("names villages and their nearby land", () => {
  const s = world();
  s.ecs.spatial.target = Hex(6, 0).toPoint();
  expect(taskPlace(s, "target")).toBe("in Withyford");
  s.ecs.spatial.target = Hex(8, 0).toPoint();
  expect(taskPlace(s, "target")).toBe("near Withyford");
});

it("uses terrain, compass direction and distance from camp in the wilderness", () => {
  const s = world();
  s.ecs.spatial.target = Hex(-4, 0).toPoint();
  s.ecs.mappable.target = { terrain: "grassland" };
  expect(taskPlace(s, "target")).toBe("grassland west of camp · 4 hexes");
  s.ecs.farmable.target = {};
  expect(taskPlace(s, "target")).toBe("field west of camp · 4 hexes");
  s.ecs.tree.target = {};
  expect(taskPlace(s, "target")).toBe("woods west of camp · 4 hexes");
});
