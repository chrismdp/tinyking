import * as SimplexNoise from "simplex-noise";

export function generate(map, seed) {
  const simplex = new SimplexNoise(seed);
  // Terrain
  const centre = { x: map.width * 0.5, y: map.height * 0.5 };
  map.forEach(hex => {
    const d = { x: (centre.x - hex.x), y: (centre.y - hex.y) };
    const relativeDistance = (d.x * d.x + d.y * d.y) / (map.width * map.width);
    hex.customHeight =
      Math.min(1.5, simplex.noise2D(hex.x * 0.025, hex.y * 0.025) * 1) +
      Math.max(0, simplex.noise2D(hex.x * 0.1, hex.y * 0.1) * 2);
    if (relativeDistance >= 0.19) {
      hex.customHeight -= (relativeDistance - 0.19) * 25;
    }
    if (hex.x == 0 || hex.y == 0 || hex.x == map.width-1 || hex.y == map.height-1) {
      hex.customHeight = -1;
    }
    hex.tile = {};
    if (hex.customHeight > 1.4) {
      hex.tile.terrain = "mountain";
    } else if (hex.customHeight < 0) {
      hex.tile.terrain = "water";
    } else {
      if (simplex.noise2D(hex.x * 0.2, hex.y * 0.2) > 0.45) {
        hex.tile.terrain = "forest";
      } else if (simplex.noise2D(hex.x * 0.5, hex.y * 0.5) > 0.85) {
        hex.tile.terrain = "stone";
      } else {
        hex.tile.terrain = "grassland";
      }
    }
  });
}
