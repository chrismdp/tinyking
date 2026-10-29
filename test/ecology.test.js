import { rowOfTiles } from "./support/world";
import { newEntities, deleteEntity } from "game/entities";
import { initializeEcology, generateForage, updateEcology, BIOME_ECOLOGY, TREE_SEED_REACH } from "game/ecology";
import { Hex } from "game/hex";
import { HOUR } from "game/time";

function wood(biome = "jungle", cleared = true) {
  const { state, tiles } = rowOfTiles(8);
  state.world = { home: { x: 0, y: 0 }, hexes: [{ x: 0, y: 0, biome, moisture: biome == "jungle" ? "wet" : "normal", temperature: "hot" }] };
  state.map = { seed: 1234, playerStartTile: { x: 0, y: 0 } };
  for (const id of tiles) state.ecs.mappable[id].biome = biome;
  const [mature] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[tiles[3]], immovable: true }, good: { type: "wood", amount: 3 },
    tree: { stage: "mature", growth: 6, fullLogs: 3, biome }
  }]);
  const others = newEntities(state, Array.from({ length: 23 }, (_, i) => ({
    spatial: { ...state.ecs.spatial[tiles[i % tiles.length]], immovable: true },
    good: { type: "wood", amount: 3 }
  })));
  initializeEcology(state, 1234);
  if (cleared) for (const id of others) deleteEntity(state, id);
  return { state, tiles, mature };
}

function hours(state, count) {
  for (let h = 0; h < count; h++) {
    state.days += HOUR;
    updateEcology(state);
  }
}

it("new saplings appear only within seed reach of a mature tree, then grow young and mature", () => {
  const { state, mature } = wood();
  const source = { ...state.ecs.spatial[mature] };
  hours(state, 48);
  const saplings = Object.keys(state.ecs.tree).filter(id => id != mature);
  expect(saplings.length).toBeGreaterThan(0);
  for (const id of saplings) {
    const p = state.ecs.spatial[id];
    expect(Math.hypot(p.x - source.x, p.y - source.y)).toBeLessThanOrEqual(TREE_SEED_REACH);
    expect(state.ecs.tree[id].stage).toBe("sapling");
    expect(state.ecs.good[id].amount).toBe(0);
  }
  const tree = saplings[0];
  hours(state, 72);
  expect(state.ecs.tree[tree].stage).toBe("young");
  expect(state.ecs.good[tree].amount).toBeLessThan(state.ecs.tree[tree].fullLogs);
  hours(state, 72);
  expect(state.ecs.tree[tree].stage).toBe("mature");
  expect(state.ecs.good[tree].amount).toBe(state.ecs.tree[tree].fullLogs);
});

it("young trees cannot seed a bare plain", () => {
  const { state, mature } = wood();
  state.ecs.tree[mature].stage = "young";
  state.ecs.tree[mature].growth = 3;
  hours(state, 48);
  expect(Object.keys(state.ecs.tree)).toEqual([mature]);
});

it("stops at each biome's natural tree density, including repeated hourly updates", () => {
  for (const biome of Object.keys(BIOME_ECOLOGY)) {
    const { state } = wood(biome);
    hours(state, 24 * 60);
    const cap = state.ecology.treeCaps[biome];
    expect(Object.keys(state.ecs.tree).length).toBeLessThanOrEqual(cap);
    expect(cap).toBe(24);
  }
});

it("neither trees nor depleted forage grow during winter", () => {
  const { state, tiles, mature } = wood();
  state.days = 9;
  state.ecs.tree[mature].stage = "sapling";
  state.ecs.tree[mature].growth = 1;
  const [bush] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    forageable: { kind: "berries", amount: 0, growth: 0, biome: "jungle" }
  }]);
  const before = structuredClone({ trees: state.ecs.tree, forage: state.ecs.forageable });
  hours(state, 70);
  expect(state.ecs.tree).toEqual(before.trees);
  expect(state.ecs.forageable).toEqual(before.forage);
  expect(state.ecs.forageable[bush].amount).toBe(0);
});

it("depleted forage slowly regrows outside winter", () => {
  const { state, tiles } = wood();
  const [plant] = newEntities(state, [{
    spatial: { ...state.ecs.spatial[tiles[0]], immovable: true },
    forageable: { kind: "roots", amount: 0, growth: 0, biome: "jungle" }
  }]);
  hours(state, 24);
  expect(state.ecs.forageable[plant].amount).toBe(0);
  hours(state, 60);
  expect(state.ecs.forageable[plant].amount).toBe(1);
});

it("generates deterministic forage on walkable land, with food near even a desert start", () => {
  const a = wood("desert").state;
  const b = wood("desert").state;
  generateForage(a, 1234);
  generateForage(b, 1234);
  expect(a.ecs.forageable).toEqual(b.ecs.forageable);
  expect(a.ecs.spatial).toEqual(b.ecs.spatial);
  const near = Object.keys(a.ecs.forageable).filter(id => Hex().fromPoint(a.ecs.spatial[id]).distance(Hex(0, 0)) <= 3);
  expect(near.length).toBeGreaterThanOrEqual(3);
});

it("vegetation regrowth is deterministic per seed, independent of Math.random", () => {
  const a = wood().state;
  const b = wood().state;
  hours(a, 24 * 8);
  hours(b, 24 * 8);
  expect(a.ecs.tree).toEqual(b.ecs.tree);
  expect(a.ecs.spatial).toEqual(b.ecs.spatial);
});

it("uses the generated woodland density as its cap, leaving room only after trees are felled", () => {
  const { state } = wood("jungle", false);
  expect(state.ecology.treeCaps.jungle).toBe(24);
  hours(state, 24 * 20);
  expect(Object.keys(state.ecs.tree)).toHaveLength(24);
});

it("does not exceed a neighbouring biome's zero natural tree density", () => {
  const { state, mature } = wood();
  const source = Hex().fromPoint(state.ecs.spatial[mature]).toString();
  for (const [key, tile] of Object.entries(state.ecology.tiles)) {
    if (key != source) tile.biome = "taiga";
  }
  expect(state.ecology.treeCaps.taiga).toBeUndefined();
  hours(state, 24 * 8);
  expect(Object.values(state.ecs.tree).every(tree => tree.biome == "jungle")).toBe(true);
});
