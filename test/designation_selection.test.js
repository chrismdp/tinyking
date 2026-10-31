jest.mock("../scripts/game-register", () => ({}));
import { designationTerrain } from "../scripts/designation-selection";
import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { Hex } from "game/hex";

function view() {
  const w = peopleWorld(), s = w.state;
  s.ecs.playable[w.player].known = w.tiles.map(id => Hex().fromPoint(s.ecs.spatial[id]));
  global.window = { tinyking: s };
  return { ...w, page: { evaluate: async fn => JSON.parse(JSON.stringify(fn())) } };
}
afterEach(() => { delete global.window; });

it("selects reachable legal natural forage without a single-entity assumption or editing the world", async () => {
  const { state: s, tiles, page } = view();
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, forageable: { kind: "roots", amount: 0 } }]);
  const before = JSON.stringify(s);
  expect((await designationTerrain(page)).map(c => c.id)).toContain(tiles[0]);
  expect(JSON.stringify(s)).toBe(before);
});

it("returns standing trees only for explicit clearing and excludes foreign plants, real objects and hidden terrain", async () => {
  const { state: s, tiles, player, person, page } = view();
  const [tree] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, good: { type: "wood", amount: 4 } }]);
  expect((await designationTerrain(page)).map(c => c.id)).not.toContain(tiles[0]);
  const before = JSON.stringify(s);
  expect((await designationTerrain(page, true)).find(c => c.id == tiles[0]).trees).toEqual([tree]);
  expect(JSON.stringify(s)).toBe(before);
  s.ecs.building = { [tree]: {} };
  expect((await designationTerrain(page, true)).map(c => c.id)).not.toContain(tiles[0]);
  delete s.ecs.building[tree];
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]], immovable: true }, forageable: { kind: "roots", amount: 1 }, controllable: { controllerId: person } }]);
  expect((await designationTerrain(page, true)).map(c => c.id)).not.toContain(tiles[0]);
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[5]], immovable: true }, stockpile: {} }]);
  expect((await designationTerrain(page, true)).map(c => c.id)).not.toContain(tiles[5]);
  s.ecs.playable[player].known = [];
  expect(await designationTerrain(page, true)).toEqual([]);
});

it("does not select disconnected known terrain", async () => {
  const { state: s, tiles, page } = view();
  for (const walk of Object.values(s.ecs.walkable)) {
    for (const [side, id] of Object.entries(walk.neighbours)) if (id == tiles[5]) delete walk.neighbours[side];
  }
  expect((await designationTerrain(page)).map(c => c.id)).not.toContain(tiles[5]);
});
