import { worldPoint } from "game/world_terrain";
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
const ROCK = 0x85898D;
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

// Stored physical habitat, with named regional categories for old fixtures.
export function lookOf(state, id) {
  const home = homeOf(state.world);
  const tile = state.ecs.mappable[id];
  if (!tile) {
    return { biome: home.biome, morality: home.morality, byWater: false };
  }
  return {
    biome: tile.biome || biomeOf(tile.temperature || home.temperature, home.moisture),
    biomeMix:tile.biomeMix,
    morality: tile.biomeMix ? "neutral" : home.morality,
    byWater: byWater(state, id)
  };
}

// Shared physical ground palette for detailed and coarse terrain. Snow is a
// separate seasonal cover; thawed snowfield habitat exposes tundra ground.
const paletteA=new THREE.Color(),paletteB=new THREE.Color();
export function habitatColour(habitat, terrain, p, target=new THREE.Color()) {
  if(WATER.includes(terrain))return target.setHex(COLOURS[terrain]);
  const mix=habitat.biomeMix || {[habitat.biome || "grassland"]:1};
  const blend=.5+.5*Math.sin(p.x*.004+Math.sin(p.y*.004));
  target.setRGB(0,0,0);
  const a=paletteA,b=paletteB;
  for(const biome in mix) {
    const look=BIOME_LOOKS[biome=="snowfield" && habitat.elevation!=null?"tundra":biome];
    a.setHex(look.ground[0]).lerp(b.setHex(look.ground[1]),blend);
    target.r+=a.r*mix[biome];target.g+=a.g*mix[biome];target.b+=a.b*mix[biome];
  }
  if(terrain=="mountain" || terrain=="stone" && habitat.elevation>780)return target.setHex(ROCK);
  if(terrain=="stone")target.lerp(a.setHex(COLOURS.stone),.7);
  return target;
}

export function createGroundColours(state) {
  const simplex = new SimplexNoise("ground:" + state.map.seed);
  return (id, target = new THREE.Color()) => {
    const tile=state.ecs.mappable[id],p=state.ecs.spatial[id];
    if(WATER.includes(tile.terrain))return target.setHex(COLOURS[tile.terrain]);
    const look=lookOf(state,id);
    habitatColour({...look,elevation:tile.elevation},tile.terrain,state.world.climate?worldPoint(state.world.home,p):p,target);
    // Legacy named fixtures retain their morality. Generated landscape has
    // no reach-shaped tint; fine facets come from the existing terrain mesh.
    if(!tile.biomeMix) {
      target.multiplyScalar(1+.035*simplex.noise2D(p.x*.37,p.y*.37));
      if(tile.terrain!="mountain" && !(tile.terrain=="stone" && tile.elevation>780))tintForMorality(target,look.morality);
    }
    return target;
  };
}
