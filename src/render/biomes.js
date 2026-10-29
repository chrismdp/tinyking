import * as THREE from "three";
import SimplexNoise from "simplex-noise";

import { biomeOf, homeOf } from "game/overworld";
import { COLOURS } from "render/colours";

// NOTE: How each biome looks. The ground is two shades that tiles are
// blended between, so a map in one biome still reads tile by tile; the
// trees take one of a few shapes, in the biome's leaf colour.
export const BIOME_LOOKS = {
  desert: { ground: [0xE2C489, 0xD4AE6C], tree: "cactus", leaves: 0x5F8F45 },
  savanna: { ground: [0xD0B456, 0xC0A64C], tree: "acacia", leaves: 0x7A8C3A },
  jungle: { ground: [0x2F8C3B, 0x237531], tree: "round", leaves: 0x1E6B2A },
  steppe: { ground: [0xA9AD6E, 0x9EA466], tree: "scrub", leaves: 0x6F7F3C },
  grassland: { ground: [0x86C35F, 0x76B552], tree: "conifer", leaves: COLOURS.tree },
  marsh: { ground: [0x6F8A4F, 0x627C4A], tree: "conifer", leaves: 0x2C4A33 },
  tundra: { ground: [0xC2C6B4, 0xB2B9A6], tree: "pine", leaves: 0x3E5E4C },
  taiga: { ground: [0x4E7A6C, 0x58857A], tree: "pine", leaves: 0x24432F },
  snowfield: { ground: [0xEDF1F4, 0xDCE4EA], tree: "pine", leaves: 0x2B4A3A, snow: true },
};

export const BIOME_COLOURS = Object.fromEntries(
  Object.entries(BIOME_LOOKS).map(([biome, look]) => [biome, look.ground[0]]));

const SNOW = 0xE8EEF3;
const ROCK = 0x6A5A50;
const GOLD = new THREE.Color(0xFFD27A);
const SHADOW = new THREE.Color(0x4A3560);

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

// NOTE: What a tile looks like: its own temperature (high ground is
// colder) with its world hex's moisture and morality.
export function lookOf(state, id) {
  const home = homeOf(state.world);
  const tile = state.ecs.mappable[id];
  if (!tile) {
    return { biome: home.biome, morality: home.morality };
  }
  return { biome: biomeOf(tile.temperature || home.temperature, home.moisture), morality: home.morality };
}

const WATER = ["shallow water", "deep water"];

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
