import * as Honeycomb from 'honeycomb-grid';

export const Hex = Honeycomb.extendHex({
  size: 0.57725,
  orientation: 'pointy'
});

export const Grid = Honeycomb.defineGrid(Hex);

export function neighbours(center) {
  return Grid.spiral({center, radius: 1});
}
