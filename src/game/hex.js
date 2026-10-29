import * as Honeycomb from "honeycomb-grid";

// NOTE: The hex geometry everything else is built on. It lives apart from
// map generation so that modules map.js uses (such as height.js) can share
// it without importing map.js back.
export const HEX_SIZE = 60;
const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3);

export const Hex = Honeycomb.extendHex({
  size: HEX_SIZE,
  orientation: "flat",
  origin: [ HEX_SIZE, HEX_HEIGHT * 0.5 ]
});

export const InnerHex = Honeycomb.extendHex({
  size: 0.5 * HEX_SIZE,
  orientation: "flat",
  origin: [ HEX_SIZE * 0.5, HEX_HEIGHT * 0.25 ]
});

export const Grid = Honeycomb.defineGrid(Hex);

export const ALL_SIDES = Array.from({length: 6}, (x, i) => i);
