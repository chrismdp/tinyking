import { visualNumber } from "render/variation";
import * as THREE from "three";
import SimplexNoise from "simplex-noise";

import { biomeOf, homeOf } from "game/overworld";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { COLOURS } from "render/colours";

// NOTE: How each biome looks. The ground is two shades that tiles are
// blended between, so a map in one biome still reads tile by tile. Trees
// are the shapes listed, each with its leaf colour; where there are several
// they are mixed, and a desert grows palms by water.
export const BIOME_LOOKS = {
  desert: { ground: [0xE2C489, 0xD4AE6C], trees: { cactus: 0x5F8F45 }, byWater: { palm: 0x3F7F34 } },
  savanna: { ground: [0xD0B456, 0xC0A64C], trees: { acacia: 0x7A8C3A } },
  jungle: { ground: [0x2F8C3B, 0x237531], trees: { round: 0x1E6B2A } },
  steppe: { ground: [0xA9AD6E, 0x9EA466], trees: { scrub: 0x6F7F3C } },
  grassland: { ground: [0x86C35F, 0x76B552], trees: { conifer: COLOURS.tree, round: 0x41703A } },
  marsh: { ground: [0x6F8A4F, 0x627C4A], trees: { willow: 0x768F3F } },
  tundra: { ground: [0xC2C6B4, 0xB2B9A6], trees: { dwarf: 0x6E6A3E } },
  taiga: { ground: [0x4E7A6C, 0x58857A], trees: { pine: 0x24432F } },
  snowfield: { ground: [0xEDF1F4, 0xDCE4EA], trees: { stunted: 0x2B4A3A }, snow: true },
};

// NOTE: which of its biome's shapes a tree takes, steady for each tree
export function treeKind({ biome, byWater }, id) {
  const look = BIOME_LOOKS[biome];
  const kinds = Object.keys(byWater && look.byWater ? look.byWater : look.trees);
  return kinds[(visualNumber(id) * 7) % kinds.length];
}

export const BIOME_COLOURS = Object.fromEntries(
  Object.entries(BIOME_LOOKS).map(([biome, look]) => [biome, look.ground[0]]));

const SNOW = 0xE8EEF3;
const ROCK = 0x6A5A50;
const GOLD = new THREE.Color(0xFFD27A);
const SHADOW = new THREE.Color(0x4A3560);
const WITHERED = new THREE.Color(0x4A2F55);

// NOTE: Morality is a light touch over everything on land: good is a little
// warm and golden, evil a little dark, grey and purple.
export function tintForMorality(colour, morality) {
  if (morality == "good") {
    colour.lerp(GOLD, 0.14);
    colour.multiplyScalar(1.04);
  } else if (morality == "evil") {
    const grey = (colour.r + colour.g + colour.b) / 3;
    colour.lerp(new THREE.Color(grey, grey, grey), 0.35);
    colour.lerp(SHADOW, 0.2);
    colour.multiplyScalar(0.86);
  }
  return colour;
}

// NOTE: A tree's colours in a biome: its trunk, its leaves, and the tip of
// a pine. Good trees are a little brighter but stay green; evil trees look
// withered, their leaves dark and purple.
export function treeColours(biome, morality, kind) {
  const look = BIOME_LOOKS[biome];
  const leaves = (look.byWater && look.byWater[kind]) || look.trees[kind];
  const colours = {
    trunk: new THREE.Color(COLOURS.trunk),
    leaves: new THREE.Color(leaves),
    tip: new THREE.Color(look.snow ? SNOW : leaves),
  };
  for (const part in colours) {
    if (morality == "evil") {
      tintForMorality(colours[part], morality);
      if (part != "trunk") {
        colours[part].lerp(WITHERED, 0.5);
      }
    } else if (morality == "good") {
      colours[part].multiplyScalar(1.1);
    }
  }
  return colours;
}

const WATER = ["shallow water", "deep water"];

const byWater = (state, id) => {
  const hex = Hex().fromPoint(state.ecs.spatial[id]);
  return Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).some(n =>
    (state.space[n.toString()] || []).some(e => state.ecs.mappable[e] && WATER.includes(state.ecs.mappable[e].terrain)));
};

// NOTE: What a tile looks like: its own temperature (high ground is
// colder) with its world hex's moisture and morality, and whether it is by
// water.
export function lookOf(state, id) {
  const home = homeOf(state.world);
  const tile = state.ecs.mappable[id];
  if (!tile) {
    return { biome: home.biome, morality: home.morality, byWater: false };
  }
  return {
    biome: biomeOf(tile.temperature || home.temperature, home.moisture),
    morality: home.morality,
    byWater: byWater(state, id)
  };
}

// NOTE: Gives each tile its ground colour. Tiles are blended between the
// biome's two shades by slow noise, so neighbours mostly agree, with a
// little brightness of their own so each hex still reads as a hex.
export function createGroundColours(state) {
  const simplex = new SimplexNoise("ground:" + state.map.seed);
  const colour = new THREE.Color();
  const other = new THREE.Color();

  return (id, target = new THREE.Color()) => {
    const { terrain } = state.ecs.mappable[id];
    const { x, y } = state.ecs.spatial[id];
    if (WATER.includes(terrain)) {
      return target.setHex(COLOURS[terrain]);
    }
    const { biome, morality } = lookOf(state, id);
    const look = BIOME_LOOKS[biome];
    const blend = 0.5 + 0.5 * simplex.noise2D(x * 0.004, y * 0.004);
    const jitter = 1 + 0.035 * simplex.noise2D(x * 0.37, y * 0.37);
    colour.setHex(look.ground[0]).lerp(other.setHex(look.ground[1]), blend);

    if (terrain == "mountain") {
      // NOTE: bare rock with a little of the land's colour, snow-capped when cold
      colour.lerp(other.setHex(ROCK), 0.72);
      if (state.ecs.mappable[id].temperature == "cold") {
        colour.lerp(other.setHex(SNOW), 0.78);
      }
    } else if (terrain == "stone") {
      colour.lerp(other.setHex(COLOURS.stone), 0.7);
    }
    colour.multiplyScalar(jitter);
    tintForMorality(colour, morality);
    return target.copy(colour);
  };
}
