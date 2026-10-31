import { growingAt } from "game/climate";
import { treeAllowed } from "game/tree_clearance";
import { Hex, Grid, HEX_SIZE } from "game/hex";
import { newEntities } from "game/entities";
import { biomeOf, homeOf } from "game/overworld";
import { HOUR } from "game/time";
import { hashUnit } from "game/math";

// Forage densities are plants per land tile. Seeding is saplings per mature tree
// per growing day; forageDays is growing days to replace one meal.
export const BIOME_ECOLOGY = {
  jungle: { seeding: 0.5, forageDensity: 1.5, forageDays: 2.5, berries: 0.8 },
  taiga: { seeding: 0.2, forageDensity: 0.7, forageDays: 3, berries: 0.7 },
  grassland: { seeding: 0.2, forageDensity: 0.9, forageDays: 3, berries: 0.65 },
  marsh: { seeding: 0.2, forageDensity: 1.1, forageDays: 2.5, berries: 0.4 },
  savanna: { seeding: 0.07, forageDensity: 0.45, forageDays: 4, berries: 0.3 },
  steppe: { seeding: 0.07, forageDensity: 0.35, forageDays: 4, berries: 0.15 },
  snowfield: { seeding: 0.025, forageDensity: 0.2, forageDays: 5, berries: 0.1 },
  tundra: { seeding: 0.025, forageDensity: 0.25, forageDays: 5, berries: 0.2 },
  desert: { seeding: 0.003, forageDensity: 0.12, forageDays: 6, berries: 0 },
};

export const TREE_SEED_REACH = HEX_SIZE * 1.5;
const YOUNG_AFTER = 3;
const MATURE_AFTER = 6;

function tileBiome(state, tile) {
  if (tile.biome) return tile.biome;
  const home = state.world && homeOf(state.world);
  return home ? biomeOf(tile.temperature || home.temperature, home.moisture) : "grassland";
}

export function initializeEcology(state, seed = state.map && state.map.seed || 0) {
  const tiles = {};
  for (const id in state.ecs.mappable) {
    const tile = state.ecs.mappable[id];
    if (tile.terrain != "grassland") continue;
    const biome = tileBiome(state, tile);
    const hex = Hex().fromPoint(state.ecs.spatial[id]);
    tiles[hex] = { id, biome };
  }
  const counts = {};
  state.ecs.tree = state.ecs.tree || {};
  for (const id in state.ecs.good) {
    if (state.ecs.good[id].type != "wood" || state.ecs.haulable && state.ecs.haulable[id]) continue;
    const tile = tiles[Hex().fromPoint(state.ecs.spatial[id])];
    const biome = tile ? tile.biome : "grassland";
    if (!state.ecs.tree[id]) state.ecs.tree[id] = {
      id, stage: "mature", growth: MATURE_AFTER, fullLogs: state.ecs.good[id].amount, biome
    };
    const treeBiome = state.ecs.tree[id].biome;
    counts[treeBiome] = (counts[treeBiome] || 0) + 1;
  }
  // The generated woodland is the biome's natural density on this map.
  // Felling frees room for new trees, which can spread onto neighbouring tiles.
  state.ecology = { seed, tiles, treeCaps: counts };
}

function plantAt(state, point, biome, key) {
  const profile = BIOME_ECOLOGY[biome];
  const kind = hashUnit(key + ":kind") < profile.berries ? "berries" : "roots";
  const [id] = newEntities(state, [{
    spatial: { ...point, immovable: true },
    nameable: { nickname: kind == "berries" ? "Berry bush" : "Wild roots" },
    forageable: { kind, biome, amount: 1, growth: 0 }
  }]);
  return id;
}

export function generateForage(state, seed, start = state.map && state.map.playerStartTile, { onlyStart = false } = {}) {
  if (!state.ecology) initializeEcology(state, seed);
  for (const [key, tile] of onlyStart ? [] : Object.entries(state.ecology.tiles)) {
    if (state.ecs.mappable[tile.id].villagePlot) continue;
    if ((state.space[key] || []).some(id => state.ecs.building?.[id])) continue;
    const density = BIOME_ECOLOGY[tile.biome].forageDensity;
    const count = Math.floor(density) + (hashUnit(seed + ":forage:" + key) < density % 1 ? 1 : 0);
    const centre = state.ecs.spatial[tile.id];
    for (let i = 0; i < count; i++) {
      const token = seed + ":forage:" + key + ":" + i;
      plantAt(state, { x: centre.x + (hashUnit(token + ":x") - 0.5) * 55,
        y: centre.y + (hashUnit(token + ":y") - 0.5) * 55 }, tile.biome, token);
    }
  }
  // Like starting wood, food must be reachable even in the sparsest biome.
  if (start) {
    const reached = new Set();
    let frontier = [state.ecology.tiles[Hex(start)]?.id];
    for (let d = 0; d <= 3; d++) {
      const next = [];
      for (const id of frontier.filter(Boolean)) {
        if (reached.has(id)) continue;
        reached.add(id);
        for (const neighbour of Object.values(state.ecs.walkable[id].neighbours)) next.push(neighbour);
      }
      frontier = next;
    }
    const spots = [...reached].filter(id => !state.ecs.mappable[id].villagePlot && !(state.space[Hex().fromPoint(state.ecs.spatial[id])] || [])
      .some(e => state.ecs.building?.[e]));
    let near = Object.keys(state.ecs.forageable || {}).filter(id => {
      const tile = state.ecology.tiles[Hex().fromPoint(state.ecs.spatial[id])];
      return tile && reached.has(tile.id);
    }).length;
    for (const id of spots) {
      if (near >= 3) break;
      const p = state.ecs.spatial[id];
      const tile = state.ecology.tiles[Hex().fromPoint(p)];
      plantAt(state, { x: p.x + 22, y: p.y - 18 }, tile.biome, seed + ":start:" + id);
      near++;
    }
  }
}

export const forageAvailable = (state, plant) => plant && plant.amount > 0 && growingAt(state,plant.id);

export function updateEcology(state) {
  for (const plant of Object.values(state.ecs.forageable || {})) {
    if (plant.amount > 0 || !growingAt(state,plant.id)) continue;
    plant.growth += HOUR;
    if (plant.growth + 1e-12 >= BIOME_ECOLOGY[plant.biome].forageDays) {
      plant.amount = 1;
      plant.growth = 0;
      state.redraws.push(plant.id);
    }
  }
  if (!state.ecs.tree || !Object.keys(state.ecs.tree).length) return;
  if (!state.ecology) initializeEcology(state);
  const { seed, tiles, treeCaps } = state.ecology;
  const counts = {};
  const mature = [];
  for (const id in state.ecs.tree) {
    const tree = state.ecs.tree[id];
    counts[tree.biome] = (counts[tree.biome] || 0) + 1;
    if (tree.stage == "mature") {
      mature.push(id);
    } else if (growingAt(state,id)) {
      tree.growth += HOUR;
      const stage = tree.growth + 1e-12 >= MATURE_AFTER ? "mature" : tree.growth + 1e-12 >= YOUNG_AFTER ? "young" : "sapling";
      if (stage != tree.stage) {
        tree.stage = stage;
        state.ecs.good[id].amount = stage == "mature" ? tree.fullLogs : stage == "young" ? 1 : 0;
        state.redraws.push(id);
      }
    }
  }
  if (!Object.keys(treeCaps).some(biome => (counts[biome] || 0) < treeCaps[biome])) return;
  for (const id of mature) {
    const tree = state.ecs.tree[id];
    if (!growingAt(state,id)) continue;
    const rate = BIOME_ECOLOGY[tree.biome].seeding;
    tree.seeding = (tree.seeding ?? hashUnit(seed + ":seeding:" + id)) + rate * HOUR;
    if (tree.seeding < 1) continue;
    tree.seeding -= 1;
    const hour = Math.round(state.days * 24);
    const token = seed + ":sapling:" + id + ":" + hour;
    const angle = hashUnit(token) * Math.PI * 2;
    const radius = 30 + hashUnit(token + ":radius") * (TREE_SEED_REACH - 30);
    const source = state.ecs.spatial[id];
    const point = { x: source.x + Math.cos(angle) * radius, y: source.y + Math.sin(angle) * radius };
    if (!treeAllowed(state, point)) continue;
    const hex = Hex().fromPoint(point);
    const tile = tiles[hex];
    if (!tile || !growingAt(state,tile.id) || (counts[tile.biome] || 0) >= (treeCaps[tile.biome] || 0)) continue;
    const space = state.space[hex] || [];
    if (space.some(e => state.ecs.mappable?.[e]?.villagePlot || state.ecs.building?.[e] || state.ecs.camp?.[e] || state.ecs.shelter?.[e] || state.ecs.farmable && state.ecs.farmable[e] || state.ecs.stockpile && state.ecs.stockpile[e])) continue;
    // Inspect only this tile and its six neighbours, never the whole forest.
    const crowded = Grid.hexagon({ center: hex, radius: 1 }).some(h => (state.space[h] || []).some(e => {
      if (!state.ecs.tree[e] && !state.ecs.forageable?.[e]) return false;
      const p = state.ecs.spatial[e];
      return (p.x - point.x) ** 2 + (p.y - point.y) ** 2 < 18 ** 2;
    }));
    if (crowded) continue;
    const fullLogs = 2 + Math.floor(hashUnit(token + ":logs") * 2);
    const ids = newEntities(state, [{
      spatial: { ...point, immovable: true }, nameable: { nickname: "Tree" },
      tree: { biome: tile.biome, stage: "sapling", growth: 0, fullLogs },
      good: { type: "wood", amount: 0 }
    }]);
    state.redraws.push(...ids);
    counts[tile.biome] = (counts[tile.biome] || 0) + 1;
  }
}
