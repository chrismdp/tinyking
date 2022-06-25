import * as Honeycomb from 'honeycomb-grid';

export const Hex = Honeycomb.extendHex({
  size: 0.57725,
  orientation: 'pointy'
});

export const Grid = Honeycomb.defineGrid(Hex);

export function neighbours(center, radius = 1) {
  return Grid.spiral({ center, radius });
}

export function ring(center, radius = 1) {
  return Grid.ring({ center, radius });
}
