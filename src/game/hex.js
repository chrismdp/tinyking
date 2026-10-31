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

// NOTE: Small tiles are flat-top; the hexagon they form, and the grid of
// those world hexes, are pointy-top. Each grid has its own offset coordinates.
export const WorldHex = Honeycomb.extendHex({
  size: HEX_SIZE,
  orientation: "pointy",
  origin: [ HEX_HEIGHT * 0.5, HEX_SIZE ]
});
export const WorldGrid = Honeycomb.defineGrid(WorldHex);

export const ALL_SIDES = Array.from({length: 6}, (x, i) => i);

// Native cube distance without repeatedly reconstructing the same Hex through
// the library's distance adapter. Coordinates invalidate the geometry cache.
const cubes = new WeakMap();
export function hexDistance(a, b) {
  const cube = h => {
    let c = cubes.get(h);
    if (!c || c.x != h.x || c.y != h.y) {
      c = { x:h.x, y:h.y, q:h.q, r:h.r, s:h.s };
      cubes.set(h,c);
    }
    return c;
  };
  const aa=cube(a),bb=cube(b);
  return Math.max(Math.abs(aa.q-bb.q),Math.abs(aa.r-bb.r),Math.abs(aa.s-bb.s));
}

const pointHexes = new WeakMap();
export function hexAtPoint(point) {
  let cached = pointHexes.get(point);
  if (!cached || cached.x != point.x || cached.y != point.y) {
    cached = { x:point.x, y:point.y, hex:Hex().fromPoint(point) };
    pointHexes.set(point,cached);
  }
  return cached.hex;
}
