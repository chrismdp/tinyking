/* global it, expect, jest */
jest.mock("../scripts/game-register", () => ({}));
import { newEntities } from "game/entities";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { addBidirectionalLink } from "game/pathfinding";
import { designationCandidates, treeCandidates, restartCandidates, worldIdentity } from "../scripts/playtest-selection";

function world() {
  const s = { ecs: { nextId: 1 }, space: {}, redraws: [], ui: {}, map: { seed: 9876 } };
  const hexes = Grid.hexagon({ center: Hex(0, 0), radius: 2 });
  const tiles = newEntities(s, hexes.map(hex => ({
    spatial: { ...hex.toPoint(), immovable: true }, mappable: { terrain: "grassland" },
    walkable: { speed: 1, neighbours: {}, worn: {} }
  })));
  hexes.forEach((hex, i) => {
    for (const [side, next] of Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).entries()) {
      const j = hexes.findIndex(h => h.equals(next));
      if (j > i) addBidirectionalLink(s.ecs, tiles[i], side, tiles[j]);
    }
  });
  const [actor] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[0]] }, controllable: {} }]);
  s.ecs.controllable[actor].controllerId = actor;
  s.ecs.controllable.owner = { controllerId: "owner" };
  s.ui.playerId = actor;
  s.ecs.playable = { [actor]: { known: tiles.map(id => Hex().fromPoint(s.ecs.spatial[id])) } };
  s.ecs.manager = { [actor]: { jobs: [] } };
  s.villages = {};
  return { s, tiles, actor };
}
const treeAt = (s, tile, extra = {}) => newEntities(s, [{
  spatial: { ...s.ecs.spatial[tile], immovable: true }, good: { type: "wood", amount: 3 }, ...extra
}])[0];

it("finds known reachable permitted standing timber; ignores loose, exhausted, private and hidden wood", () => {
  const { s, tiles } = world();
  treeAt(s, tiles[0], { haulable: {} });
  treeAt(s, tiles[1], { good: { type: "wood", amount: 0 } });
  const legal = treeAt(s, tiles[2]);
  treeAt(s, tiles[3], { controllable: { controllerId: "owner" } });
  treeAt(s, tiles[7]);
  s.ecs.playable[s.ui.playerId].known = s.ecs.playable[s.ui.playerId].known.filter(h => !h.equals(Hex().fromPoint(s.ecs.spatial[tiles[7]])));
  const before = JSON.stringify(s);
  expect(treeCandidates(s)).toEqual([legal]);
  expect(JSON.stringify(s)).toBe(before);
  for (const walk of Object.values(s.ecs.walkable)) {
    for (const [side, id] of Object.entries(walk.neighbours)) if (id == tiles[2]) delete walk.neighbours[side];
  }
  expect(treeCandidates(s)).toEqual([]);
});

it("finds Cut down clearing sites while retaining every real obstacle and the snapshot", () => {
  const { s, tiles } = world();
  const tree = treeAt(s, tiles[1]);
  treeAt(s, tiles[2], { haulable: {} });
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]], immovable: true }, forageable: { amount: 0 } }]);
  s.ecs.controllable[tiles[4]] = { controllerId: "owner" };
  s.ecs.manager[s.ui.playerId].jobs.push({ targetId: tiles[5] });
  const before = JSON.stringify(s);
  const sites = designationCandidates(s, { allowTrees: true });
  expect(sites.find(c => c.id == tiles[1]).trees).toEqual([tree]);
  expect(sites.map(c => c.id)).toContain(tiles[3]);
  for (const blocked of [tiles[2], tiles[4], tiles[5]]) expect(sites.map(c => c.id)).not.toContain(blocked);
  expect(designationCandidates(s).map(c => c.id)).not.toContain(tiles[1]);
  expect(JSON.stringify(s)).toBe(before);
});

it("uses stockpile rules separately: worn grass can hold storage but cannot be a field", () => {
  const { s, tiles } = world();
  s.ecs.walkable[tiles[1]].worn = { 0: 1 };
  expect(designationCandidates(s).map(c => c.id)).not.toContain(tiles[1]);
  expect(designationCandidates(s, { action: "create_stockpile" }).map(c => c.id)).toContain(tiles[1]);
});

it("rechecks a restart against fresh contents, land use, reservations and excluded sites", () => {
  const { s, tiles } = world();
  const original = tiles[1];
  expect(restartCandidates(s, "create_field", original)[0]).toBe(original);
  s.ecs.walkable[original].worn = { 0: 2 };
  newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[2]] }, stockpile: {} }]);
  s.ecs.manager[s.ui.playerId].jobs.push({ targetId: tiles[3] });
  const candidates = restartCandidates(s, "create_field", original, [tiles[0]]);
  expect(candidates.length).toBeGreaterThan(0);
  for (const blocked of tiles.slice(0, 4)) expect(candidates).not.toContain(blocked);
});

it.each([13, 21])("checks a loaded served world's seed %s against its downloaded template", seed => {
  const { s } = world();
  s.travel = { seed };
  const identity = worldIdentity(s, "http://localhost/", seed);
  expect(identity).toMatchObject({ loaded: true, seed, expectedSeed: seed, matches: true, source: "served world" });
  expect(worldIdentity(s, "http://localhost/", seed + 1).matches).toBe(false);
  expect(worldIdentity(s, "http://localhost/").matches).toBe(false);
});

it("honours an explicit URL seed and rejects an absent or unready world", () => {
  const { s } = world();
  s.travel = { seed: 13 };
  expect(worldIdentity(s, "http://localhost/?seed=13", 21)).toMatchObject({ loaded: true, expectedSeed: 13, matches: true, source: "URL" });
  expect(worldIdentity(s, "http://localhost/?seed=21").matches).toBe(false);
  expect(worldIdentity({}, "http://localhost/?seed=13").loaded).toBe(false);
  delete s.ecs.spatial[s.ui.playerId];
  expect(worldIdentity(s, "http://localhost/?seed=13").loaded).toBe(false);
});
